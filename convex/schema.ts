import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const language = v.union(v.literal('js'), v.literal('ts'), v.literal('python'), v.literal('rust'), v.literal('cpp'))
const label = v.union(v.literal('human'), v.literal('ai'))

export default defineSchema({
  appConfig: defineTable({
    key: v.string(),
    enabledLanguages: v.array(language),
    datasetVersion: v.string(),
    totalQuestions: v.number(),
    resumeMs: v.number(),
    enableDemographicPrompts: v.boolean(),
    enablePairReporting: v.boolean(),
    enablePublicAggregates: v.boolean(),
    enablePercentiles: v.boolean(),
    enableShareCard: v.boolean(),
    updatedAt: v.number()
  }).index('by_key', ['key']),

  pairs: defineTable({
    pairId: v.string(),
    datasetVersion: v.string(),
    language,
    status: v.union(v.literal('approved'), v.literal('deprecated')),
    humanDisplayCode: v.string(),
    aiDisplayCode: v.string(),
    displayLanguage: v.string(),
    lineCountHuman: v.number(),
    lineCountAi: v.number(),
    licenseSpdx: v.string(),
    humanSourceRepo: v.string(),
    humanSourceCommit: v.string(),
    humanSourcePath: v.string(),
    humanSourceStartLine: v.number(),
    humanSourceEndLine: v.number(),
    humanSourceUrl: v.string(),
    aiModel: v.string(),
    aiGeneratedAt: v.string(),
    specModel: v.string(),
    specGeneratedAt: v.string(),
    specSummary: v.string(),
    aiProvenanceUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_language_status_dataset', ['language', 'status', 'datasetVersion'])
    .index('by_pair_id', ['pairId']),

  sessions: defineTable({
    resultSlug: v.string(),
    language,
    datasetVersion: v.string(),
    status: v.union(v.literal('in_progress'), v.literal('completed'), v.literal('expired')),
    profileCodingExperience: v.optional(v.string()),
    profileAiToolUsage: v.optional(v.string()),
    score: v.optional(v.number()),
    total: v.number(),
    startedAt: v.number(),
    lastActiveAt: v.number(),
    completedAt: v.optional(v.number()),
    resumeExpiresAt: v.number()
  })
    .index('by_result_slug', ['resultSlug'])
    .index('by_status_language', ['status', 'language']),

  sessionQuestions: defineTable({
    sessionId: v.id('sessions'),
    questionId: v.string(),
    order: v.number(),
    pairDocId: v.id('pairs'),
    pairId: v.string(),
    shownLabel: label
  })
    .index('by_session_order', ['sessionId', 'order'])
    .index('by_session_question', ['sessionId', 'questionId']),

  answers: defineTable({
    sessionId: v.id('sessions'),
    questionId: v.string(),
    guess: label,
    shownLabel: label,
    isCorrect: v.boolean(),
    responseMs: v.number(),
    createdAt: v.number()
  })
    .index('by_session_question', ['sessionId', 'questionId'])
    .index('by_session', ['sessionId']),

  pairAggregates: defineTable({
    pairId: v.string(),
    shownLabel: label,
    shownCount: v.number(),
    humanGuesses: v.number(),
    aiGuesses: v.number(),
    correctCount: v.number(),
    totalResponseMs: v.number(),
    updatedAt: v.number()
  }).index('by_pair_label', ['pairId', 'shownLabel']),

  languageAggregates: defineTable({
    language,
    completedSessions: v.number(),
    totalScore: v.number(),
    scoreHistogram: v.array(v.number()),
    updatedAt: v.number()
  }).index('by_language', ['language'])
})
