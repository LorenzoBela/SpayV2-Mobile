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

export const trpc = createTRPCReact<AppRouter>()

export const trpcVanillaClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getApiUrl()}/api/trpc`,
      async headers() {
        const { data: { session } } = await supabase.auth.getSession()
        let impersonateUserId: string | null = null
        try {
          const stored = await expoSecureStorage.getItem('impersonated_user')
          if (stored) {
            const parsed = JSON.parse(stored)
            if (parsed?.id) impersonateUserId = parsed.id
          }
        } catch (e) {}
        return {
          Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
          ...(impersonateUserId ? { 'x-impersonate-user-id': impersonateUserId } : {}),
        }
      },
      transformer: superjson as any,
    }),
  ],
})
