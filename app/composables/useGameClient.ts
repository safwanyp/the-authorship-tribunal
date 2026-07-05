import type {
  FeatureFlags,
  Guess,
  LanguageId,
  LanguageOption,
  PendingAnswer,
  QuizPayload,
  ResultPayload,
  StoredQuizRun
} from '~/types/game'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '~~/convex/_generated/api'

const activeRunKey = 'isitai.activeRun'
const recentPairsKey = 'isitai.recentPairs'
const resumeWindowMs = 5 * 60 * 1000
let convexClient: ConvexHttpClient | null = null

interface StartSessionInput {
  language: LanguageId
  profileCodingExperience?: string
  profileAiToolUsage?: string
}

export function useGameClient() {
  const getLanguages = () =>
    convex().query(api.quiz.getEnabledLanguages, {}) as Promise<{
      languages: LanguageOption[]
      featureFlags: FeatureFlags
    }>

  const startSession = async (input: StartSessionInput) => {
    const recentPairIds = getRecentPairs(input.language)
    const payload = await $fetch<QuizPayload>('/api/game/start-session', {
      method: 'POST',
      body: {
        ...input,
        recentPairIds
      }
    })
    saveRun({
      ...payload,
      currentQuestionIndex: 0,
      pendingAnswers: [],
      startedAt: Date.now(),
      lastActiveAt: Date.now()
    })
    return payload
  }

  const submitAnswer = async (answer: PendingAnswer) => {
    await $fetch('/api/game/submit-answer', {
      method: 'POST',
      body: {
        sessionId: answer.sessionId,
        questionId: answer.questionId,
        guess: answer.guess,
        responseMs: answer.responseMs
      }
    })
  }

  const flushPendingAnswers = async (run: StoredQuizRun) => {
    const next = { ...run, pendingAnswers: [...run.pendingAnswers] }
    for (const answer of next.pendingAnswers) {
      if (answer.submitted) continue
      answer.attempts += 1
      try {
        await submitAnswer(answer)
        answer.submitted = true
      } catch {
        saveRun(next)
        return { ok: false, run: next }
      }
    }
    saveRun(next)
    return { ok: true, run: next }
  }

  const completeSession = async (run: StoredQuizRun) => {
    const response = await $fetch<{ resultSlug: string; seenPairIds: string[] }>('/api/game/complete-session', {
      method: 'POST',
      body: {
        sessionId: run.sessionId
      }
    })
    rememberPairs(run.language, response.seenPairIds)
    clearRun()
    return response
  }

  const getResult = (slug: string) =>
    convex().query(api.quiz.getResultBySlug, { resultSlug: slug }) as Promise<ResultPayload>

  const queueAnswer = (run: StoredQuizRun, questionId: string, guess: Guess, responseMs: number) => {
    const existing = run.pendingAnswers.find((answer) => answer.questionId === questionId)
    if (existing) return run

    const next: StoredQuizRun = {
      ...run,
      pendingAnswers: [
        ...run.pendingAnswers,
        {
          sessionId: run.sessionId,
          questionId,
          guess,
          responseMs,
          submitted: false,
          attempts: 0
        }
      ],
      lastActiveAt: Date.now()
    }
    saveRun(next)
    return next
  }

  return {
    getLanguages,
    startSession,
    submitAnswer,
    flushPendingAnswers,
    completeSession,
    getResult,
    queueAnswer,
    getStoredRun,
    saveRun,
    clearRun
  }
}

function convex() {
  const config = useRuntimeConfig()
  const url = config.public.convexUrl
  if (!url) {
    throw new Error('NUXT_PUBLIC_CONVEX_URL is required to use the Convex backend.')
  }

  if (!convexClient) {
    convexClient = new ConvexHttpClient(url, { logger: false })
  }
  return convexClient
}

function getStoredRun() {
  if (!import.meta.client) return null
  const raw = localStorage.getItem(activeRunKey)
  if (!raw) return null

  try {
    const run = JSON.parse(raw) as StoredQuizRun
    const isExpired = Date.now() - run.lastActiveAt > resumeWindowMs || Date.now() > run.resumeExpiresAt
    if (isExpired) {
      localStorage.removeItem(activeRunKey)
      return null
    }
    return run
  } catch {
    localStorage.removeItem(activeRunKey)
    return null
  }
}

function saveRun(run: StoredQuizRun) {
  if (!import.meta.client) return
  localStorage.setItem(activeRunKey, JSON.stringify(run))
}

function clearRun() {
  if (!import.meta.client) return
  localStorage.removeItem(activeRunKey)
}

function getRecentPairs(language: LanguageId) {
  if (!import.meta.client) return []
  const all = readRecentPairs()
  return all[language] || []
}

function rememberPairs(language: LanguageId, pairIds: string[]) {
  if (!import.meta.client) return
  const all = readRecentPairs()
  const merged = [...pairIds, ...(all[language] || [])]
  all[language] = Array.from(new Set(merged)).slice(0, 50)
  localStorage.setItem(recentPairsKey, JSON.stringify(all))
}

function readRecentPairs() {
  try {
    return JSON.parse(localStorage.getItem(recentPairsKey) || '{}') as Partial<Record<LanguageId, string[]>>
  } catch {
    return {}
  }
}
