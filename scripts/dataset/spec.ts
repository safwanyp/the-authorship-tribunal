import { callOpenAIJson, readJsonl, requireOpenAIKey, writeJsonl, type SpecRecord } from './lib.ts'

const input = process.argv[2] || 'dataset/work/normalized/js.jsonl'
const output = process.argv[3] || 'dataset/work/specs/js.jsonl'
const model = process.env.SPEC_MODEL || 'gpt-5.5'
const apiKey = requireOpenAIKey()
const records = readJsonl<SpecRecord>(input)
const specs: SpecRecord[] = []

for (const record of records) {
  const content = await callOpenAIJson<SpecRecord['spec']['content']>(
    apiKey,
    model,
    `Create a behavior-only JSON spec for this anonymized JavaScript function.
Do not mention variable names, repo names, source paths, or unnecessary algorithmic quirks.
Return JSON with keys summary, signature_intent, behavior, edge_cases, forbidden_details.

Code:
${record.display_code}`
  )
  specs.push({
    ...record,
    spec: {
      schema_version: '1.0.0',
      model,
      generated_at: new Date().toISOString(),
      content
    }
  })
}

writeJsonl(output, specs)
console.log(`Generated ${specs.length} behavioral specs.`)
