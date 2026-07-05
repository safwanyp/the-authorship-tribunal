import type { LanguageId, QuizPayload } from '~/types/game'
import { api, getServerWriteSecret, useServerConvex } from '../../utils/convex'
import { assertAllowedOrigin, assertRateLimit } from '../../utils/requestGuards'

const languages = new Set<LanguageId>(['js', 'ts', 'python', 'rust', 'cpp'])

export default defineEventHandler(async (event) => {
  assertAllowedOrigin(event)
  assertRateLimit(event, 'start-session', 12, 10 * 60 * 1000)

  const body = await readBody<{
    language?: LanguageId
    profileCodingExperience?: string
    profileAiToolUsage?: string
    recentPairIds?: string[]
  }>(event)

  if (!body.language || !languages.has(body.language)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Choose a supported language.'
    })
  }

  return (await useServerConvex().mutation(api.quiz.startSession, {
    serverSecret: getServerWriteSecret(),
    language: body.language,
    profileCodingExperience: optionalString(body.profileCodingExperience),
    profileAiToolUsage: optionalString(body.profileAiToolUsage),
    recentPairIds: Array.isArray(body.recentPairIds) ? body.recentPairIds.filter(isString).slice(0, 50) : undefined
  })) as QuizPayload
})

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}
