<script setup lang="ts">
import type { Guess, StoredQuizRun } from '~/types/game'
import type { BundledLanguage } from 'shiki/bundle/web'

useSeoMeta({
  title: 'Docket / The Authorship Tribunal',
  description: 'Read each code exhibit and decide whether it came from a human or AI.',
  robots: 'noindex, nofollow'
})

interface HighlightedToken {
  content: string
  className?: string
}

interface StampState {
  text: string
  nonce: number
}

const route = useRoute()
const router = useRouter()
const game = useGameClient()

const run = ref<StoredQuizRun | null>(null)
const locked = ref(false)
const flushError = ref('')
const shownAt = ref(Date.now())
const highlightedLines = ref<HighlightedToken[][]>([])
const rulingStamp = ref<StampState | null>(null)
const exhibitShakeNonce = ref(0)
const filedQuestionIds = ref<Set<string>>(new Set())

const currentQuestion = computed(() => run.value?.questions[run.value.currentQuestionIndex])
const isDone = computed(() => Boolean(run.value && run.value.currentQuestionIndex >= run.value.questions.length))
const codeLines = computed(() => currentQuestion.value?.displayCode.split('\n') || [])
const renderedLines = computed<HighlightedToken[][]>(() =>
  highlightedLines.value.length
    ? highlightedLines.value
    : codeLines.value.map((line) => tokenizeFallback(line || ' '))
)
const caseNumber = computed(() => (run.value ? run.value.currentQuestionIndex + 1 : 1))
const caseNumberLabel = computed(() => String(caseNumber.value).padStart(2, '0'))
const caseHex = computed(() => {
  const question = currentQuestion.value
  return question ? stableHex(`${question.questionId}:${question.displayCode}`) : '0000'
})
const languageLabel = computed(() => {
  const question = currentQuestion.value
  if (!question) return ''
  return displayLanguageName(question.displayLanguage)
})

watch(
  currentQuestion,
  async (question) => {
    highlightedLines.value = []
    rulingStamp.value = null
    if (!question) return
    try {
      const { codeToTokens } = await import('shiki/bundle/web')
      const result = await codeToTokens(question.displayCode, {
        lang: displayLanguageToShiki(question.displayLanguage),
        theme: 'github-dark-default'
      })
      highlightedLines.value = result.tokens.map((line) =>
        line.map((token) => ({ content: token.content, className: tokenClass(token.content) }))
      )
    } catch {
      highlightedLines.value = codeLines.value.map((line) => tokenizeFallback(line || ' '))
    }
  },
  { immediate: true }
)

onMounted(() => {
  const stored = game.getStoredRun()
  if (!stored || stored.sessionId !== route.params.sessionId) {
    router.replace('/')
    return
  }

  run.value = {
    ...stored
  }
  filedQuestionIds.value = new Set(stored.pendingAnswers.map((answer) => answer.questionId))
  shownAt.value = Date.now()
  window.addEventListener('keydown', handleKey)
})

onBeforeUnmount(() => {
  if (import.meta.client) window.removeEventListener('keydown', handleKey)
})

async function answer(guess: Guess) {
  const question = currentQuestion.value
  if (!run.value || !question || locked.value) return
  locked.value = true
  flushError.value = ''

  const responseMs = Date.now() - shownAt.value
  const updated = game.queueAnswer(run.value, question.questionId, guess, responseMs)
  run.value = updated

  const pending = updated.pendingAnswers.find((item) => item.questionId === question.questionId)
  if (pending) {
    game
      .submitAnswer(pending)
      .then(() => {
        if (!run.value) return
        pending.submitted = true
        game.saveRun(run.value)
      })
      .catch(() => {
        if (!run.value) return
        pending.attempts += 1
        game.saveRun(run.value)
      })
  }

  slamRuling(`RULED: ${verdictLabel(guess)}`)

  await wait(700)
  markFiled(question.questionId)

  if (!run.value) return
  run.value.currentQuestionIndex += 1
  run.value.lastActiveAt = Date.now()
  game.saveRun(run.value)
  locked.value = false
  shownAt.value = Date.now()

  if (isDone.value) {
    await finish()
  }
}

async function finish() {
  if (!run.value) return
  locked.value = true
  const flushed = await game.flushPendingAnswers(run.value)
  run.value = flushed.run
  if (!flushed.ok) {
    flushError.value = 'One answer did not reach the clerk. Retry to unlock the court record.'
    locked.value = false
    return
  }

  try {
    const response = await game.completeSession(run.value)
    await router.replace(`/results/${response.resultSlug}`)
  } catch {
    flushError.value = 'The court record is not ready to close this session yet. Try once more.'
    locked.value = false
  }
}

function handleKey(event: KeyboardEvent) {
  if (event.key.toLowerCase() === 'h') answer('human')
  if (event.key.toLowerCase() === 'a') answer('ai')
}

function markFiled(questionId: string) {
  filedQuestionIds.value = new Set([...filedQuestionIds.value, questionId])
}

function sealState(index: number) {
  const question = run.value?.questions[index]
  if (!run.value || !question) return ''
  if (filedQuestionIds.value.has(question.questionId)) return 'filed'
  return index === run.value.currentQuestionIndex ? 'current' : ''
}

function slamRuling(text: string) {
  exhibitShakeNonce.value += 1
  rulingStamp.value = { text, nonce: Date.now() }
}

function verdictLabel(label: Guess) {
  return label === 'human' ? 'HUMAN' : 'MACHINE'
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function displayLanguageToShiki(language: string): BundledLanguage {
  const map: Record<string, BundledLanguage> = {
    js: 'javascript',
    ts: 'typescript',
    python: 'python',
    rust: 'javascript',
    cpp: 'cpp'
  }
  return map[language] || 'javascript'
}

function displayLanguageName(language: string) {
  const map: Record<string, string> = {
    js: 'JavaScript',
    ts: 'TypeScript',
    python: 'Python',
    rust: 'Rust',
    cpp: 'C++'
  }
  return map[language] || language
}

function tokenizeFallback(line: string) {
  return line.split(/(\s+|[()[\]{}.,;:+\-*/=<>!&|?'"]+)/).filter(Boolean).map((content) => ({
    content,
    className: tokenClass(content)
  }))
}

function tokenClass(content: string) {
  if (/^(['"`]).*\1$/.test(content) || /^(['"`])/.test(content)) return 'str'
  if (/^\d+(\.\d+)?$/.test(content)) return 'num'
  if (/^(abstract|async|await|boolean|break|case|catch|class|const|continue|def|do|else|enum|export|extends|false|final|fn|for|from|function|if|impl|import|in|interface|let|match|mod|new|null|private|pub|public|return|self|static|struct|switch|this|throw|trait|true|try|type|typeof|var|void|while)$/.test(content)) return 'kw'
  if (/^[A-Za-z_$][\w$]*$/.test(content)) return 'fn'
  return undefined
}

function stableHex(value: string) {
  return hashString(value).toString(16).toUpperCase().padStart(4, '0').slice(-4)
}

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

</script>

<template>
  <main id="main" class="court quiz-court">
    <TribunalHeader />

    <section v-if="run && currentQuestion" class="quiz-shell">
      <div class="docket" aria-label="Round progress">
        <span>Docket</span>
        <div class="docket-track" aria-hidden="true">
          <span
            v-for="(_, index) in run.questions"
            :key="index"
            class="seal-dot"
            :class="sealState(index)"
          />
        </div>
        <span>Case {{ caseNumberLabel }} of {{ run.questions.length }}</span>
      </div>

      <section class="case-title">
        <h2>In re: Snippet {{ caseHex }}</h2>
      </section>

      <section
        class="exhibit"
        :class="{ shake: exhibitShakeNonce > 0 }"
        :key="`exhibit-${currentQuestion.questionId}-${exhibitShakeNonce}`"
      >
        <div class="exhibit-tag">
          <span class="label">Exhibit A</span>
          <span>{{ languageLabel }} · {{ currentQuestion.lineCount }} lines</span>
        </div>
        <pre class="code-panel" aria-label="Code snippet"><code><span v-for="(line, index) in renderedLines" :key="index" class="ln"><span v-for="(token, tokenIndex) in line" :key="tokenIndex" :class="token.className">{{ token.content }}</span></span></code></pre>
        <div
          v-if="rulingStamp"
          :key="rulingStamp.nonce"
          class="stamp ruling slam stamp-tilt-ruling"
        >
          {{ rulingStamp.text }}
        </div>
      </section>

      <div class="bench">
        <button class="verdict ai" :disabled="locked" @click="answer('ai')">
          <span class="big">Machine</span>
          <span class="desc">generated by AI</span>
          <span class="key">Press A</span>
        </button>
        <button class="verdict human" :disabled="locked" @click="answer('human')">
          <span class="big">Human</span>
          <span class="desc">written by hand</span>
          <span class="key">Press H</span>
        </button>
      </div>

      <section v-if="flushError" class="panel">
        <p class="error">{{ flushError }}</p>
        <button class="btn primary mt-12" :disabled="locked" @click="finish">Retry final filing</button>
      </section>
    </section>

    <section v-else class="panel">
      <p>Looking for your active council…</p>
    </section>
  </main>
</template>
