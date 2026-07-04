import { callOpenAIJson, readJsonl, requireOpenAIKey, writeJsonl, type GeneratedRecord, type SpecRecord } from './lib.ts'

const input = process.argv[2] || 'dataset/work/specs/js.jsonl'
const output = process.argv[3] || 'dataset/work/generated/js.jsonl'
const model = process.env.AI_MODEL || 'gpt-5.5'
const apiKey = requireOpenAIKey()
const records = readJsonl<SpecRecord>(input)
const generated: GeneratedRecord[] = []

for (const record of records) {
  const response = await callOpenAIJson<{ display_code: string }>(
    apiKey,
    model,
    `Write a standalone JavaScript function named candidate that satisfies this spec.
Do not copy the original implementation or force the same local variable names.
Return JSON with one key: display_code.

Spec:
${JSON.stringify(record.spec.content, null, 2)}`
  )

  generated.push({
    ...record,
    ai: {
      model,
      generation_prompt_version: 'ai-code-v1',
      generated_at: new Date().toISOString(),
      display_code: response.display_code.trim(),
      retry_count: 0
    }
  })
}

writeJsonl(output, generated)
console.log(`Generated ${generated.length} AI implementations.`)
