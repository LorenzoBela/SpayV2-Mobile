import { createTRPCReact } from '@trpc/react-query'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import superjson from 'superjson'
export type AppRouter = any
import { supabase, expoSecureStorage } from './supabase'

const getApiUrl = () => {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim()
  if (url) return url.replace(/\/$/, '')
  return 'https://nootspaytracker.vercel.app'
}

export const trpc = createTRPCReact<AppRouter>() as any

// In-memory cache for impersonated user ID (0ms RAM read)
let cachedImpersonatedUserId: string | null | undefined = undefined

export const setCachedImpersonatedUserId = (id: string | null) => {
  cachedImpersonatedUserId = id
}

export const getCachedImpersonatedUserId = () => cachedImpersonatedUserId

export const getTrpcHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (cachedImpersonatedUserId === undefined) {
    try {
      const stored = await expoSecureStorage.getItem('impersonated_user')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed?.id) {
          cachedImpersonatedUserId = parsed.id
        } else {
          cachedImpersonatedUserId = null
        }
      } else {
        cachedImpersonatedUserId = null
      }
    } catch (e) {
      cachedImpersonatedUserId = null
    }
  }

  return {
    Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
    ...(cachedImpersonatedUserId ? { 'x-impersonate-user-id': cachedImpersonatedUserId } : {}),
  }
}

export const fetchWithTimeout = (url: RequestInfo | URL, options?: RequestInit) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)
  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId))
}

export const trpcVanillaClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getApiUrl()}/api/trpc`,
      headers: getTrpcHeaders,
      fetch: fetchWithTimeout,
      transformer: superjson as any,
    }),
  ],
})

