import type { Id } from '~~/convex/_generated/dataModel'

export type LanguageId = 'js' | 'ts' | 'python' | 'rust' | 'cpp'
export type Guess = 'human' | 'ai'

export interface FeatureFlags {
  enableDemographicPrompts: boolean
  enablePairReporting: boolean
  enablePublicAggregates: boolean
  enablePercentiles: boolean
  enableShareCard: boolean
}

export interface LanguageOption {
  id: LanguageId
  name: string
  approvedPairCount: number
  enabled: boolean
}

export interface QuizQuestion {
  questionId: string
  displayCode: string
  displayLanguage: string
  lineCount: number
}

export interface QuizPayload {
  sessionId: Id<'sessions'>
  resultSlug: string
  language: LanguageId
  questions: QuizQuestion[]
  featureFlags: FeatureFlags
  resumeExpiresAt: number
}

export interface PendingAnswer {
  sessionId: Id<'sessions'>
  questionId: string
  guess: Guess
  responseMs: number
  submitted: boolean
  attempts: number
}

export interface StoredQuizRun extends QuizPayload {
  currentQuestionIndex: number
  pendingAnswers: PendingAnswer[]
  startedAt: number
  lastActiveAt: number
}

export interface ResultAnswerCard {
  questionNumber: number
  pairId: string
  userGuess: Guess
  correctLabel: Guess
  isCorrect: boolean
  crowd?: {
    shownCount: number
    guessedHumanPercent: number
    guessedAiPercent: number
    averageResponseMs: number
  }
  provenance: {
    license: string
    sourceRepo: string
    sourceUrl: string
    aiModel: string
    aiGeneratedAt: string
    specSummary: string
  }
  deprecated: boolean
}

export interface CompleteResult {
  status: 'completed'
  resultSlug: string
  score: number
  total: number
  language: LanguageId
  completedAt: number
  featureFlags?: FeatureFlags
  aggregateSummary?: {
    completedSessions: number
    averageScore: number
  }
  answers: ResultAnswerCard[]
}

export interface IncompleteResult {
  status: 'in_progress' | 'expired' | 'missing'
  featureFlags?: FeatureFlags
}

export type ResultPayload = CompleteResult | IncompleteResult
