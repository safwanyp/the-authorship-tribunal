<script setup lang="ts">
import type { CompleteResult, Guess, ResultPayload } from '~/types/game'

const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const resultSlug = computed(() => String(route.params.resultSlug))
const appBaseUrl = computed(() => String(config.public.appBaseUrl || '').replace(/\/$/, ''))
const resultUrl = computed(() => absolutePublicUrl(`/results/${resultSlug.value}`))
const resultOgImage = computed(() => absolutePublicUrl(`/og/results/${resultSlug.value}.png`))

useSeoMeta({
  title: 'Court Record / The Authorship Tribunal',
  description: 'A completed Authorship Tribunal record with score, precedent, and source notes.',
  ogTitle: 'Court Record / The Authorship Tribunal',
  ogDescription: 'A completed Authorship Tribunal record with score, rank, precedent, and source notes.',
  ogUrl: resultUrl,
  ogImage: resultOgImage,
  twitterCard: 'summary_large_image',
  twitterTitle: 'Court Record / The Authorship Tribunal',
  twitterDescription: 'A completed Authorship Tribunal record with score and rank.',
  twitterImage: resultOgImage,
  robots: 'noindex, nofollow'
})

const game = useGameClient()
const result = ref<ResultPayload | null>(null)
const loading = ref(true)
const error = ref('')
const unsealed = ref(false)
const expandedCases = ref<Set<string>>(new Set())

const complete = computed(() => (result.value?.status === 'completed' ? (result.value as CompleteResult) : null))
const languageName = computed(() => {
  const map = { js: 'JavaScript', ts: 'TypeScript', python: 'Python', rust: 'Rust', cpp: 'C++' }
  return complete.value ? map[complete.value.language] : ''
})
const shareText = computed(() => {
  if (!complete.value || !import.meta.client) return ''
  const url = window.location.href
  return `I upheld ${complete.value.score} of ${complete.value.total} verdicts in The Authorship Tribunal. Try it: ${url} #TATHumanOrAI`
})
const shareUrl = computed(() => `https://x.com/intent/tweet?text=${encodeURIComponent(shareText.value)}`)
const showShare = computed(() => complete.value?.featureFlags?.enableShareCard !== false)
const completedAtDisplay = computed(() => {
  if (!complete.value) return ''
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(complete.value.completedAt))
})
const rank = computed(() => {
  const score = complete.value?.score || 0
  if (score >= 9) return { label: 'Honored Adjudicator', tone: 'gold' }
  if (score >= 7) return { label: 'Sound Judgment', tone: 'gold' }
  if (score >= 5) return { label: 'Under Review', tone: 'red' }
  return { label: 'Recused', tone: 'red' }
})
const misses = computed(() => (complete.value ? complete.value.total - complete.value.score : 0))
const precedent = computed(() => {
  if (!complete.value?.aggregateSummary) return 'Precedent: awaiting more councils'
  const summary = complete.value.aggregateSummary
  return `Precedent: ${summary.averageScore} of ${complete.value.total} across ${summary.completedSessions} ${summary.completedSessions === 1 ? 'council' : 'councils'}`
})
const highScoreDisplay = computed(() => {
  const highScore = complete.value?.aggregateSummary?.highScore
  if (!highScore) return 'Record high: awaiting first entry'
  return `Record high: ${highScore.score} of ${highScore.total}`
})

onMounted(async () => {
  try {
    result.value = await game.getResult(String(route.params.resultSlug))
  } catch {
    error.value = 'Could not load that record. The docket may not exist yet.'
  } finally {
    loading.value = false
  }
})

function toggleCase(pairId: string) {
  const next = new Set(expandedCases.value)
  if (next.has(pairId)) next.delete(pairId)
  else next.add(pairId)
  expandedCases.value = next
}

async function restart() {
  game.clearRun()
  await router.push('/')
}

function verdictLabel(label: Guess) {
  return label === 'human' ? 'HUMAN' : 'MACHINE'
}

function verdictClass(label: Guess) {
  return label === 'human' ? 'human' : 'machine'
}

function crowdCorrectPercent(answer: CompleteResult['answers'][number]) {
  if (!answer.crowd) return 0
  return answer.correctLabel === 'human' ? answer.crowd.guessedHumanPercent : answer.crowd.guessedAiPercent
}

function crowdWrongPercent(answer: CompleteResult['answers'][number]) {
  return Math.max(0, 100 - crowdCorrectPercent(answer))
}

function absolutePublicUrl(path: string) {
  return appBaseUrl.value ? `${appBaseUrl.value}${path}` : path
}
</script>

<template>
  <main id="main" class="court results-court">
    <TribunalHeader />

    <section v-if="loading" class="panel">
      <p>Loading the court record…</p>
    </section>

    <section v-else-if="error" class="panel">
      <p class="error">{{ error }}</p>
    </section>

    <section v-else-if="result?.status !== 'completed'" class="panel">
      <p class="kicker">Not final</p>
      <h2>This council has not adjourned.</h2>
      <p class="mt-12">Public records stay sealed until all 10 answers are locked.</p>
      <NuxtLink class="btn primary button-inline mt-18" to="/">
        Convene a new council
      </NuxtLink>
    </section>

    <template v-else-if="complete">
      <WaxSeal
        v-if="!unsealed"
        label="All ten cases have been heard. Break the seal to unseal the record."
        @unsealed="unsealed = true"
      >
        <span>All ten cases have been heard.<br />Break the seal to unseal the record.</span>
      </WaxSeal>

      <div v-if="unsealed" class="record open">
        <section class="judgment">
          <div class="rank-stamp slam" :class="rank.tone">{{ rank.label }}</div>
          <div class="label">Judgment of the Council · {{ languageName }}</div>
          <div class="score">{{ complete.score }} <small>of {{ complete.total }}</small></div>
          <div class="high-score">{{ highScoreDisplay }}</div>
          <div class="sub">verdicts upheld · sealed {{ completedAtDisplay }}</div>
        </section>

        <div class="precedent">
          <span>{{ precedent }}</span>
          <span>Misses logged: <b>{{ misses }}</b></span>
        </div>

        <div class="actions">
          <a v-if="showShare && shareText" class="btn primary share-record" :href="shareUrl" target="_blank" rel="noreferrer">
            <img src="/assets/x-logo.svg" width="12" height="12" alt="" class="icon" />
            Share the record
          </a>
          <button class="btn" type="button" @click="restart">Convene a new council</button>
        </div>

        <div class="section-label">— The Docket —</div>
        <section class="docket-list" aria-label="Answer breakdown">
          <article
            v-for="answer in complete.answers"
            :key="answer.pairId"
            class="case-row"
            :class="[answer.isCorrect ? 'upheld' : 'overturned', { expanded: expandedCases.has(answer.pairId) }]"
          >
            <button class="row-main" type="button" @click="toggleCase(answer.pairId)">
              <span class="case-no">CASE {{ String(answer.questionNumber).padStart(2, '0') }}</span>
              <span class="ruling-line">
                You ruled <span class="tag" :class="verdictClass(answer.userGuess)">{{ verdictLabel(answer.userGuess) }}</span>
                <span class="vs"> · truth </span>
                <span class="tag" :class="verdictClass(answer.correctLabel)">{{ verdictLabel(answer.correctLabel) }}</span>
              </span>
              <span class="outcome" :class="answer.isCorrect ? 'upheld' : 'overturned'">
                {{ answer.isCorrect ? '✓ Upheld' : '✗ Overturned' }}
              </span>
            </button>
            <div class="row-detail">
              <p class="detail-desc">{{ answer.provenance.specSummary }}</p>
              <div v-if="answer.crowd" class="crowd-bar-wrap">
                <span>Past councils chose truth:</span>
                <div class="crowd-bar" aria-hidden="true">
                  <i :style="{ width: `${crowdCorrectPercent(answer)}%` }" />
                </div>
                <span class="crowd-split">
                  {{ crowdCorrectPercent(answer) }}% correct
                  <span class="crowd-wrong">· {{ crowdWrongPercent(answer) }}% wrong</span>
                </span>
              </div>
              <div v-else class="crowd-bar-wrap">
                <span>Past councils chose truth:</span>
                <div class="crowd-bar" aria-hidden="true"><i class="crowd-bar-empty" /></div>
                <span>sealed</span>
              </div>
              <div class="origin">
                Origin disclosed:
                <a :href="answer.provenance.sourceUrl" target="_blank" rel="noreferrer">
                  {{ answer.provenance.sourceRepo }}
                </a>
                · {{ answer.provenance.license }} · AI counsel: {{ answer.provenance.aiModel }}
              </div>
              <div v-if="complete.featureFlags?.enablePairReporting" class="origin mt-12">
                <a
                  :href="`https://github.com/safwanyp/isitai/issues/new?title=Issue%20with%20${answer.pairId}&body=Pair:%20${answer.pairId}%0ALanguage:%20${complete.language}%0AResult:%20${complete.resultSlug}%0A%0AChecklist:%0A-%20%5B%20%5D%20Source/provenance%20issue%0A-%20%5B%20%5D%20Snippet%20formatting%20issue%0A-%20%5B%20%5D%20Label%20or%20task%20issue`"
                  target="_blank"
                  rel="noreferrer"
                >
                  Report issue
                </a>
              </div>
              <p v-if="answer.deprecated" class="error mt-12">This item was later removed from active rotation.</p>
            </div>
          </article>
        </section>
      </div>
    </template>
  </main>
</template>
