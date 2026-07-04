import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { readJsonl, toDatasetRecord, writeJsonl, type GeneratedRecord } from './lib.ts'

const input = process.argv[2] || 'dataset/work/generated/js.jsonl'
const output = process.argv[3] || 'dataset/v1/js.jsonl'
const decisionsPath = process.argv[4] || 'dataset/work/review/decisions.json'
const records = readJsonl<GeneratedRecord>(input)
const decisions = existsSync(decisionsPath)
  ? (JSON.parse(readFileSync(decisionsPath, 'utf8')) as Record<string, 'approved' | 'rejected'>)
  : {}

const approved = records
  .filter((record) => decisions[record.pair_id] === 'approved')
  .map((record) => toDatasetRecord(record, 'v1'))

writeJsonl(output, approved)
writeFileSync('dataset/v1/ATTRIBUTIONS.md', attributionMarkdown(approved))
console.log(`Exported ${approved.length} approved pairs to ${output}.`)

function attributionMarkdown(records: ReturnType<typeof toDatasetRecord>[]) {
  return `# Attributions

Human snippets are sourced from permissively licensed pre-2021 open-source references.

${records
  .map(
    (record) =>
      `- ${record.pair_id}: [${record.human.source_repo}](${record.human.source_url}) · ${record.license} · ${record.human.source_commit}`
  )
  .join('\n')}
`
}
