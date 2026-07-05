import { createError, getHeader, getRequestIP, type H3Event } from 'h3'

const requestBuckets = new Map<string, { count: number; resetAt: number }>()

export function assertAllowedOrigin(event: H3Event) {
  const origin = getHeader(event, 'origin')
  const allowedOrigins = getAllowedOrigins(event)

  if (!origin || !allowedOrigins.has(origin)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'This action is only available from the deployed app.'
    })
  }
}

export function assertRateLimit(event: H3Event, action: string, limit: number, windowMs: number) {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const key = `${action}:${ip}`
  const now = Date.now()
  const current = requestBuckets.get(key)

  if (!current || current.resetAt <= now) {
    requestBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  if (current.count >= limit) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many requests. Please wait a moment and try again.'
    })
  }

  current.count += 1
}

function getAllowedOrigins(event: H3Event) {
  const config = useRuntimeConfig(event)
  const configured = String(config.allowedOrigins || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  const appOrigin = toOrigin(config.public.appBaseUrl)
  return new Set([
    ...configured,
    ...(appOrigin ? [appOrigin] : []),
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ])
}

function toOrigin(value: unknown) {
  if (typeof value !== 'string' || !value) return ''
  try {
    return new URL(value).origin
  } catch {
    return ''
  }
}
