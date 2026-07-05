import type { Guess } from '~/types/game'
import type { Id } from '~~/convex/_generated/dataModel'
import { api, getServerWriteSecret, useServerConvex } from '../../utils/convex'
import { assertAllowedOrigin, assertRateLimit } from '../../utils/requestGuards'

const guesses = new Set<Guess>(['human', 'ai'])

export default defineEventHandler(async (event) => {
  assertAllowedOrigin(event)
  assertRateLimit(event, 'submit-answer', 240, 10 * 60 * 1000)

  const body = await readBody<{
    sessionId?: Id<'sessions'>
    questionId?: string
    guess?: Guess
    responseMs?: number
  }>(event)

  if (!body.sessionId || !body.questionId || !body.guess || !guesses.has(body.guess)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Answer payload is invalid.'
    })
  }

  return await useServerConvex().mutation(api.quiz.submitAnswer, {
    serverSecret: getServerWriteSecret(),
    sessionId: body.sessionId,
    questionId: body.questionId,
    guess: body.guess,
    responseMs: Math.max(0, Math.round(Number(body.responseMs) || 0))
  })
})
