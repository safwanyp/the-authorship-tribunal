import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { readJsonl, sourceUrl, type GeneratedRecord } from './lib.ts'

const input = process.argv[2] || 'dataset/work/generated/js.jsonl'
const output = process.argv[3] || 'dataset/work/review/js.html'
const records = readJsonl<GeneratedRecord>(input)

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>JavaScript Pair Review</title>
  <style>
    body { margin: 24px; background: #07090d; color: #f5f7fb; font-family: system-ui, sans-serif; }
    article { border: 1px solid #293241; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    pre { overflow: auto; background: #06080c; padding: 12px; border-radius: 8px; }
    code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    a { color: #7cf7c7; }
  </style>
</head>
<body>
  <h1>JavaScript Pair Review</h1>
  <p>Accept/reject only. Put decisions in <code>dataset/work/review/decisions.json</code> as {"js_0001":"approved"}.</p>
  ${records
    .map(
      (record) => `<article>
        <h2>${record.pair_id}</h2>
        <p>${escapeHtml(record.spec.content.summary)}</p>
        <p><a href="${sourceUrl(record)}">Human source</a> · ${record.license}</p>
        <h3>Human</h3>
        <pre><code>${escapeHtml(record.display_code)}</code></pre>
        <h3>AI</h3>
        <pre><code>${escapeHtml(record.ai.display_code)}</code></pre>
      </article>`
    )
    .join('\n')}
</body>
</html>`

mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, html)
console.log(`Wrote review artifact: ${output}`)

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
