export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'resultSlug') || ''
  const fallback = () =>
    renderTribunalOgPng({
      title: 'Record sealed.',
      scoreLine: 'This council has not adjourned.',
      rankLabel: 'Sealed Record',
      rankTone: 'gold'
    })

  let png: Uint8Array
  try {
    const result = await useServerConvex().query(api.quiz.getResultBySlug, { resultSlug: slug })
    if (result.status !== 'completed') {
      png = fallback()
    } else {
      const rank = resultRank(result.score)
      png = renderTribunalOgPng({
        eyebrow: `COURT RECORD · ${result.language.toUpperCase()}`,
        title: `${result.score} of ${result.total}`,
        scoreLine: 'verdicts upheld · Exhibits remain sealed.',
        rankLabel: rank.label,
        rankTone: rank.tone,
        footer: 'THE AUTHORSHIP TRIBUNAL · PUBLISHED RECORD'
      })
    }
  } catch {
    png = fallback()
  }

  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'public, max-age=300, s-maxage=86400')
  return png
})
