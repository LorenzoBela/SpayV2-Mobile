import { createTRPCReact } from '@trpc/react-query'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import superjson from 'superjson'
export type AppRouter = any
import { supabase, expoSecureStorage } from './supabase'
import { SPLIT_READER_HEADERS } from './split-reader-contract'
import type { getSessionWithTimeout } from './authProfile'
import * as authProfileNamespace from './authProfile'
import { withDeadline } from './networkResilience'

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
  let getCachedTokenFn: (() => string | null) | undefined
  let getSessionFn: typeof getSessionWithTimeout | undefined
  try {
    const authProfileMod = authProfileNamespace as Record<string, any>
    getCachedTokenFn = authProfileMod.getCachedAccessToken
    getSessionFn = authProfileMod.getSessionWithTimeout
  } catch {
    // Partial Vitest mocks of authProfile may omit helpers.
  }

  let accessToken = typeof getCachedTokenFn === 'function' ? getCachedTokenFn() : null
  if (!accessToken) {
    const session = typeof getSessionFn === 'function'
      ? await getSessionFn(3000)
      : await withDeadline(
          async () => {
            const res = await supabase.auth.getSession()
            return res?.data?.session ?? null
          },
          3000,
          undefined,
          'trpc.getSession',
        )
    accessToken = session?.access_token ?? null
  }
  
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
    ...SPLIT_READER_HEADERS,
    Authorization: accessToken ? `Bearer ${accessToken}` : '',
    ...(cachedImpersonatedUserId ? { 'x-impersonate-user-id': cachedImpersonatedUserId } : {}),
  }
}

export const fetchWithTimeout = (url: RequestInfo | URL, options?: RequestInit) =>
  withDeadline(
    (signal) => fetch(url, { ...options, signal }),
    7000,
    options?.signal ?? undefined,
    'trpc.fetch',
  )

export const trpcVanillaClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getApiUrl()}/api/trpc`,
      headers: getTrpcHeaders,
      fetch: fetchWithTimeout,
      transformer: superjson as any,
      maxURLLength: 2083,
    }),
  ],
})

