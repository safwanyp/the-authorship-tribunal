import { mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { v } from 'convex/values'
import { readAppConfig, type AppConfig } from './config'

const languages = ['js', 'ts', 'python', 'rust', 'cpp'] as const
const languageNames: Record<(typeof languages)[number], string> = {
  js: 'JavaScript',
  ts: 'TypeScript',
  python: 'Python',
  rust: 'Rust',
  cpp: 'C++'
}

const language = v.union(v.literal('js'), v.literal('ts'), v.literal('python'), v.literal('rust'), v.literal('cpp'))
const label = v.union(v.literal('human'), v.literal('ai'))

export const getEnabledLanguages = query({
  args: {},
  handler: async (ctx) => {
    const config = await readAppConfig(ctx)
    const enabledLanguages = new Set(config.enabledLanguages)
    const options = []

    for (const id of languages) {
      const approved = await ctx.db
        .query('pairs')
        .withIndex('by_language_status_dataset', (q) =>
          q.eq('language', id).eq('status', 'approved').eq('datasetVersion', config.datasetVersion)
        )
        .collect()
      options.push({
        id,
        name: languageNames[id],
        approvedPairCount: approved.length,
        enabled: enabledLanguages.has(id) && approved.length >= config.totalQuestions
      })
    }

    return { languages: options, featureFlags: featureFlags(config) }
  }
})

export const startSession = mutation({
  args: {
    language,
    profileCodingExperience: v.optional(v.string()),
    profileAiToolUsage: v.optional(v.string()),
    recentPairIds: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args) => {
    const config = await readAppConfig(ctx)
    if (!config.enabledLanguages.includes(args.language)) {
      throw new Error('Language is not enabled.')
    }

    const enabled = await ctx.db
      .query('pairs')
      .withIndex('by_language_status_dataset', (q) =>
        q.eq('language', args.language).eq('status', 'approved').eq('datasetVersion', config.datasetVersion)
      )
      .collect()

    if (enabled.length < config.totalQuestions) {
      throw new Error('Language is not enabled.')
    }

    const recent = new Set(args.recentPairIds || [])
    const fresh = enabled.filter((pair) => !recent.has(pair.pairId))
    const pool = fresh.length >= config.totalQuestions ? fresh : enabled
    const selected = shuffle(pool).slice(0, config.totalQuestions)
    const labels = balancedLabels(config.totalQuestions)
    const now = Date.now()
    const resultSlug = makeSlug()

    const sessionId = await ctx.db.insert('sessions', {
      resultSlug,
      language: args.language,
      datasetVersion: config.datasetVersion,
      status: 'in_progress',
      profileCodingExperience: args.profileCodingExperience,
      profileAiToolUsage: args.profileAiToolUsage,
      total: config.totalQuestions,
      startedAt: now,
      lastActiveAt: now,
      resumeExpiresAt: now + config.resumeMs
    })

    const questions = []
    for (let order = 0; order < selected.length; order += 1) {
      const pair = selected[order]
      const shownLabel = labels[order]
      if (!pair || !shownLabel) throw new Error('Could not assign quiz questions.')
      const questionId = makeQuestionId(order)
      await ctx.db.insert('sessionQuestions', {
        sessionId,
        questionId,
        order,
        pairDocId: pair._id,
        pairId: pair.pairId,
        shownLabel
      })

      const displayCode = shownLabel === 'human' ? pair.humanDisplayCode : pair.aiDisplayCode
      questions.push({
        questionId,
        displayCode,
        displayLanguage: pair.displayLanguage,
        lineCount: shownLabel === 'human' ? pair.lineCountHuman : pair.lineCountAi
      })
    }

    return {
      sessionId,
      resultSlug,
      language: args.language,
      questions,
      featureFlags: featureFlags(config),
      resumeExpiresAt: now + config.resumeMs
    }
  }
})

export const submitAnswer = mutation({
  args: {
    sessionId: v.id('sessions'),
    questionId: v.string(),
    guess: label,
    responseMs: v.number()
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session || session.status !== 'in_progress') {
      throw new Error('Session is not active.')
    }

    const question = await ctx.db
      .query('sessionQuestions')
      .withIndex('by_session_question', (q) => q.eq('sessionId', args.sessionId).eq('questionId', args.questionId))
      .unique()
    if (!question) throw new Error('Question not found.')

    const existing = await ctx.db
      .query('answers')
      .withIndex('by_session_question', (q) => q.eq('sessionId', args.sessionId).eq('questionId', args.questionId))
      .unique()
    if (existing) {
      if (existing.guess !== args.guess) throw new Error('Answer has already been locked.')
      return { ok: true, idempotent: true }
    }

    const isCorrect = args.guess === question.shownLabel
    await ctx.db.insert('answers', {
      sessionId: args.sessionId,
      questionId: args.questionId,
      guess: args.guess,
      shownLabel: question.shownLabel,
      isCorrect,
      responseMs: Math.max(0, Math.round(args.responseMs)),
      createdAt: Date.now()
    })

    await ctx.db.patch(args.sessionId, { lastActiveAt: Date.now() })
    await incrementPairAggregate(ctx, question.pairId, question.shownLabel, args.guess, isCorrect, args.responseMs)

    return { ok: true, idempotent: false }
  }
})

export const completeSession = mutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error('Session not found.')

    const questions = await ctx.db
      .query('sessionQuestions')
      .withIndex('by_session_order', (q) => q.eq('sessionId', args.sessionId))
      .collect()

    if (session.status === 'completed') {
      return { resultSlug: session.resultSlug, seenPairIds: questions.map((question) => question.pairId) }
    }

    const answers = await ctx.db
      .query('answers')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    if (answers.length !== session.total) throw new Error('All questions must be answered first.')

    const score = answers.filter((answer) => answer.isCorrect).length
    await ctx.db.patch(args.sessionId, { status: 'completed', score, completedAt: Date.now() })
    await incrementLanguageAggregate(ctx, session.language, score, session.total)

    return { resultSlug: session.resultSlug, seenPairIds: questions.map((question) => question.pairId) }
  }
})

export const getResultBySlug = query({
  args: { resultSlug: v.string() },
  handler: async (ctx, args) => {
    const config = await readAppConfig(ctx)
    const flags = featureFlags(config)
    const session = await ctx.db
      .query('sessions')
      .withIndex('by_result_slug', (q) => q.eq('resultSlug', args.resultSlug))
      .unique()
    if (!session) return { status: 'missing' as const, featureFlags: flags }
    if (session.status !== 'completed') return { status: session.status, featureFlags: flags }

    const questions = await ctx.db
      .query('sessionQuestions')
      .withIndex('by_session_order', (q) => q.eq('sessionId', session._id))
      .collect()
    const answers = await ctx.db
      .query('answers')
      .withIndex('by_session', (q) => q.eq('sessionId', session._id))
      .collect()
    const languageAggregate = await ctx.db
      .query('languageAggregates')
      .withIndex('by_language', (q) => q.eq('language', session.language))
      .unique()

    const cards = []
    for (const question of questions.sort((a, b) => a.order - b.order)) {
      const pair = await ctx.db.get(question.pairDocId)
      const answer = answers.find((item) => item.questionId === question.questionId)
      if (!pair || !answer) continue
      const aggregate = await ctx.db
        .query('pairAggregates')
        .withIndex('by_pair_label', (q) => q.eq('pairId', pair.pairId).eq('shownLabel', question.shownLabel))
        .unique()
      const shownCount = aggregate?.shownCount || 0
      cards.push({
        questionNumber: question.order + 1,
        pairId: pair.pairId,
        userGuess: answer.guess,
        correctLabel: question.shownLabel,
        isCorrect: answer.isCorrect,
        crowd:
          flags.enablePublicAggregates && aggregate && shownCount > 0
            ? {
                shownCount,
                guessedHumanPercent: Math.round((aggregate.humanGuesses / shownCount) * 100),
                guessedAiPercent: Math.round((aggregate.aiGuesses / shownCount) * 100),
                averageResponseMs: Math.round(aggregate.totalResponseMs / shownCount)
              }
            : undefined,
        provenance: {
          license: pair.licenseSpdx,
          sourceRepo: pair.humanSourceRepo,
          sourceUrl: pair.humanSourceUrl,
          aiModel: pair.aiModel,
          aiGeneratedAt: pair.aiGeneratedAt,
          specSummary: pair.specSummary
        },
        deprecated: pair.status === 'deprecated'
      })
    }

    return {
      status: 'completed' as const,
      resultSlug: session.resultSlug,
      score: session.score || 0,
      total: session.total,
      language: session.language,
      completedAt: session.completedAt || session.lastActiveAt,
      featureFlags: flags,
      aggregateSummary: languageAggregate
        ? {
            completedSessions: languageAggregate.completedSessions,
            averageScore: Math.round((languageAggregate.totalScore / languageAggregate.completedSessions) * 10) / 10
          }
        : undefined,
      answers: cards
    }
  }
})

async function incrementPairAggregate(
  ctx: MutationCtx,
  pairId: string,
  shownLabel: 'human' | 'ai',
  guess: 'human' | 'ai',
  isCorrect: boolean,
  responseMs: number
) {
  const now = Date.now()
  const existing = await ctx.db
    .query('pairAggregates')
    .withIndex('by_pair_label', (q) => q.eq('pairId', pairId).eq('shownLabel', shownLabel))
    .unique()

  if (!existing) {
    await ctx.db.insert('pairAggregates', {
      pairId,
      shownLabel,
      shownCount: 1,
      humanGuesses: guess === 'human' ? 1 : 0,
      aiGuesses: guess === 'ai' ? 1 : 0,
      correctCount: isCorrect ? 1 : 0,
      totalResponseMs: Math.max(0, Math.round(responseMs)),
      updatedAt: now
    })
    return
  }

  await ctx.db.patch(existing._id, {
    shownCount: existing.shownCount + 1,
    humanGuesses: existing.humanGuesses + (guess === 'human' ? 1 : 0),
    aiGuesses: existing.aiGuesses + (guess === 'ai' ? 1 : 0),
    correctCount: existing.correctCount + (isCorrect ? 1 : 0),
    totalResponseMs: existing.totalResponseMs + Math.max(0, Math.round(responseMs)),
    updatedAt: now
  })
}

async function incrementLanguageAggregate(
  ctx: MutationCtx,
  language: 'js' | 'ts' | 'python' | 'rust' | 'cpp',
  score: number,
  total: number
) {
  const existing = await ctx.db
    .query('languageAggregates')
    .withIndex('by_language', (q) => q.eq('language', language))
    .unique()
  const now = Date.now()

  if (!existing) {
    const scoreHistogram = Array.from({ length: total + 1 }, () => 0)
    scoreHistogram[score] = 1
    await ctx.db.insert('languageAggregates', {
      language,
      completedSessions: 1,
      totalScore: score,
      scoreHistogram,
      updatedAt: now
    })
    return
  }

  const scoreHistogram = [...existing.scoreHistogram]
  while (scoreHistogram.length <= score) scoreHistogram.push(0)
  scoreHistogram[score] = (scoreHistogram[score] || 0) + 1
  await ctx.db.patch(existing._id, {
    completedSessions: existing.completedSessions + 1,
    totalScore: existing.totalScore + score,
    scoreHistogram,
    updatedAt: now
  })
}

function featureFlags(config: AppConfig) {
  return {
    enableDemographicPrompts: config.enableDemographicPrompts,
    enablePairReporting: config.enablePairReporting,
    enablePublicAggregates: config.enablePublicAggregates,
    enablePercentiles: config.enablePercentiles,
    enableShareCard: config.enableShareCard
  }
}

function balancedLabels(totalQuestions: number) {
  const midpoint = Math.round(totalQuestions / 2)
  const humanCount = Math.min(totalQuestions - 1, Math.max(1, midpoint - 1 + Math.floor(Math.random() * 3)))
  return shuffle([
    ...Array.from({ length: humanCount }, () => 'human' as const),
    ...Array.from({ length: totalQuestions - humanCount }, () => 'ai' as const)
  ])
}

function shuffle<T>(items: T[]) {
  const output = [...items]
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    const current = output[index]
    const replacement = output[swap]
    if (current === undefined || replacement === undefined) continue
    output[index] = replacement
    output[swap] = current
  }
  return output
}

function makeSlug() {
  return Math.random().toString(36).slice(2, 8)
}

function makeQuestionId(order: number) {
  return `q${order + 1}_${Math.random().toString(36).slice(2, 10)}`
}
