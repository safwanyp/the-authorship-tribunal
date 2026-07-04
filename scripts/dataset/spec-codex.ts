import { callCodexJson, outputSlice, safeName } from './codex.ts'
import { readJsonl, writeJsonl, type SpecRecord } from './lib.ts'

const input = process.argv[2] || 'dataset/work/normalized/js.jsonl'
const output = process.argv[3] || 'dataset/work/specs/js.jsonl'
const records = readJsonl<SpecRecord>(input)
const selected = outputSlice(records)
const existing = new Map(readJsonl<SpecRecord>(output).map((record) => [record.pair_id, record]))
const overwrite = process.env.CODEX_DATASET_OVERWRITE === '1'

const schema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    signature_intent: { type: 'string' },
    behavior: { type: 'array', items: { type: 'string' } },
    edge_cases: { type: 'array', items: { type: 'string' } },
    forbidden_details: { type: 'array', items: { type: 'string' } }
  },
  required: ['summary', 'signature_intent', 'behavior', 'edge_cases', 'forbidden_details'],
  additionalProperties: false
}

for (const record of selected) {
  if (existing.has(record.pair_id) && !overwrite) {
    console.log(`Skipping existing spec for ${record.pair_id}.`)
    continue
  }

  const content = callCodexJson<SpecRecord['spec']['content']>(
    `Create a behavior-only JSON spec for this anonymized JavaScript function.

Rules:
- Do not mention variable names.
- Do not mention repo names.
- Do not mention source paths.
- Do not include unnecessary algorithmic quirks.
- The summary must be one sentence.
- Behavior and edge_cases must be arrays of concise strings.
- Return only JSON matching the schema.

Code:
${record.display_code}`,
    schema,
    `spec-${safeName(record.pair_id)}`
  )

  existing.set(record.pair_id, {
    ...record,
    spec: {
      schema_version: '1.0.0',
      model: process.env.CODEX_DATASET_MODEL || 'codex',
      generated_at: new Date().toISOString(),
      content
    }
  })
  writeJsonl(output, ordered(records, existing))
  console.log(`Generated spec for ${record.pair_id}.`)
}

writeJsonl(output, ordered(records, existing))
console.log(`Wrote ${existing.size} behavioral specs with Codex.`)

function ordered(records: SpecRecord[], generated: Map<string, SpecRecord>) {
  return records.map((record) => generated.get(record.pair_id)).filter((record): record is SpecRecord => Boolean(record))
}
