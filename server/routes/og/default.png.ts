export default defineEventHandler((event) => {
  const png = renderTribunalOgPng({
    eyebrow: 'NO LOGIN · NO HINTS',
    title: 'Read the exhibit.',
    scoreLine: '10 code exhibits. Seal your ruling.',
    rankLabel: 'Public Record',
    rankTone: 'gold',
    footer: 'The Authorship Tribunal · by hand, or by machine'
  })

  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=86400')
  return png
})
