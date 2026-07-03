import { createTRPCReact } from '@trpc/react-query'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import superjson from 'superjson'
import type { AppRouter } from '../../../web/src/server/routers/_app'
import { supabase } from './supabase'

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
        return {
          Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
        }
      },
      transformer: superjson as any,
    }),
  ],
})
