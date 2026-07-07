import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { internalMutation } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { v } from 'convex/values'

const incompleteStatuses = ['in_progress', 'expired'] as const
const cleanupGraceMs = 10 * 60 * 1000

export const cleanupIncompleteSessions = internalMutation({
  args: {
    batchSize: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const batchSize = clampBatchSize(args.batchSize)
    const cutoff = Date.now() - cleanupGraceMs
    const deleted = {
      sessions: 0,
      answers: 0,
      sessionQuestions: 0
    }
    let hitBatchLimit = false

    for (const status of incompleteStatuses) {
      const remaining = batchSize - deleted.sessions
      if (remaining <= 0) {
        hitBatchLimit = true
        break
      }

      const sessions = await ctx.db
        .query('sessions')
        .withIndex('by_status_and_resume_expires_at', (q) =>
          q.eq('status', status).lte('resumeExpiresAt', cutoff)
        )
        .take(remaining)

      if (sessions.length === remaining) hitBatchLimit = true

      for (const session of sessions) {
        const result = await deleteIncompleteSession(ctx, session._id)
        deleted.sessions += 1
        deleted.answers += result.answers
        deleted.sessionQuestions += result.sessionQuestions
      }
    }

    if (hitBatchLimit) {
      await ctx.scheduler.runAfter(0, internal.cleanup.cleanupIncompleteSessions, { batchSize })
    }

    return {
      cutoff,
      graceMs: cleanupGraceMs,
      batchSize,
      deleted,
      scheduledContinuation: hitBatchLimit
    }
  }
})

async function deleteIncompleteSession(ctx: MutationCtx, sessionId: Id<'sessions'>) {
  let answers = 0
  let sessionQuestions = 0

  const answerDocs = await ctx.db
    .query('answers')
    .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
    .collect()
  for (const answer of answerDocs) {
    await decrementPairAggregate(ctx, answer)
    await ctx.db.delete(answer._id)
    answers += 1
  }

  const questionDocs = await ctx.db
    .query('sessionQuestions')
    .withIndex('by_session_order', (q) => q.eq('sessionId', sessionId))
    .collect()
  for (const question of questionDocs) {
    await ctx.db.delete(question._id)
    sessionQuestions += 1
  }

  await ctx.db.delete(sessionId)
  return { answers, sessionQuestions }
}

async function decrementPairAggregate(ctx: MutationCtx, answer: Doc<'answers'>) {
  const question = await ctx.db
    .query('sessionQuestions')
    .withIndex('by_session_question', (q) => q.eq('sessionId', answer.sessionId).eq('questionId', answer.questionId))
    .unique()
  if (!question) return

  const aggregate = await ctx.db
    .query('pairAggregates')
    .withIndex('by_pair_label', (q) => q.eq('pairId', question.pairId).eq('shownLabel', answer.shownLabel))
    .unique()
  if (!aggregate) return

  const shownCount = Math.max(0, aggregate.shownCount - 1)
  const humanGuesses = Math.max(0, aggregate.humanGuesses - (answer.guess === 'human' ? 1 : 0))
  const aiGuesses = Math.max(0, aggregate.aiGuesses - (answer.guess === 'ai' ? 1 : 0))
  const correctCount = Math.max(0, aggregate.correctCount - (answer.isCorrect ? 1 : 0))
  const totalResponseMs = Math.max(0, aggregate.totalResponseMs - Math.max(0, Math.round(answer.responseMs)))

  if (shownCount === 0) {
    await ctx.db.delete(aggregate._id)
    return
  }

  await ctx.db.patch(aggregate._id, {
    shownCount,
    humanGuesses,
    aiGuesses,
    correctCount,
    totalResponseMs,
    updatedAt: Date.now()
  })
}

function clampBatchSize(value: number | undefined) {
  if (value === undefined) return 25
  return Math.max(1, Math.min(50, Math.floor(value)))
}
