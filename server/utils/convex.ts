import { ConvexHttpClient } from 'convex/browser'
import { api } from '~~/convex/_generated/api'

let convexClient: ConvexHttpClient | null = null

export function useServerConvex() {
  const config = useRuntimeConfig()
  const url = config.public.convexUrl
  if (!url) {
    throw createError({
      statusCode: 500,
      statusMessage: 'NUXT_PUBLIC_CONVEX_URL is required to reach Convex.'
    })
  }

  if (!convexClient) {
    convexClient = new ConvexHttpClient(url, { logger: false })
  }

  return convexClient
}

export function getServerWriteSecret() {
  const config = useRuntimeConfig()
  if (!config.convexServerSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'CONVEX_SERVER_SECRET is required for game writes.'
    })
  }
  return config.convexServerSecret
}

export { api }
