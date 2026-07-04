import { callCodexJson, outputSlice, safeName } from './codex.ts'
import { readJsonl, writeJsonl, type GeneratedRecord, type SpecRecord } from './lib.ts'

const input = process.argv[2] || 'dataset/work/specs/js.jsonl'
const output = process.argv[3] || 'dataset/work/generated/js.jsonl'
const records = readJsonl<SpecRecord>(input)
const selected = outputSlice(records)
const existing = new Map(readJsonl<GeneratedRecord>(output).map((record) => [record.pair_id, record]))
const overwrite = process.env.CODEX_DATASET_OVERWRITE === '1'

const schema = {
  type: 'object',
  properties: {
    display_code: { type: 'string' }
  },
  required: ['display_code'],
  additionalProperties: false
}

for (const record of selected) {
  if (existing.has(record.pair_id) && !overwrite) {
    console.log(`Skipping existing AI implementation for ${record.pair_id}.`)
    continue
  }

  const response = callCodexJson<{ display_code: string }>(
    `Write a standalone JavaScript function named candidate that satisfies this behavior spec.

Rules:
- Return only JSON matching the schema.
- The function must be named candidate.
- Do not copy the original implementation.
- Do not force the same local variable names as the human source.
- Do not add comments.
- Do not include markdown fences inside display_code.

Spec:
${JSON.stringify(record.spec.content, null, 2)}`,
    schema,
    `generate-${safeName(record.pair_id)}`
  )

  existing.set(record.pair_id, {
    ...record,
    ai: {
      model: process.env.CODEX_DATASET_MODEL || 'codex',
      generation_prompt_version: 'codex-ai-code-v1',
      generated_at: new Date().toISOString(),
      display_code: response.display_code.trim(),
      retry_count: 0
    }
  })
  writeJsonl(output, ordered(records, existing))
  console.log(`Generated AI implementation for ${record.pair_id}.`)
}

writeJsonl(output, ordered(records, existing))
console.log(`Wrote ${existing.size} AI implementations with Codex.`)

function ordered(records: SpecRecord[], generated: Map<string, GeneratedRecord>) {
  return records
    .map((record) => generated.get(record.pair_id))
    .filter((record): record is GeneratedRecord => Boolean(record))
}
