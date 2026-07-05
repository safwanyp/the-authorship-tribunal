import type { Id } from '~~/convex/_generated/dataModel'
import { api, getServerWriteSecret, useServerConvex } from '../../utils/convex'
import { assertAllowedOrigin, assertRateLimit } from '../../utils/requestGuards'

export default defineEventHandler(async (event) => {
  assertAllowedOrigin(event)
  assertRateLimit(event, 'complete-session', 60, 10 * 60 * 1000)

  const body = await readBody<{ sessionId?: Id<'sessions'> }>(event)
  if (!body.sessionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Session is required.'
    })
  }

  return (await useServerConvex().mutation(api.quiz.completeSession, {
    serverSecret: getServerWriteSecret(),
    sessionId: body.sessionId
  })) as { resultSlug: string; seenPairIds: string[] }
})
