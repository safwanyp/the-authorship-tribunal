import {
  makePairId,
  normalizeJs,
  readJsonl,
  sha256,
  writeJsonl,
  type CandidateRecord,
  type DatasetRecord,
  type SpecRecord
} from './lib.ts'

const input = process.argv[2] || 'dataset/work/filtered/js.jsonl'
const output = process.argv[3] || 'dataset/work/normalized/js.jsonl'
const records = readJsonl<CandidateRecord | DatasetRecord>(input).map(toCandidate)

const normalized = records.map<SpecRecord>((record, index) => {
  const displayCode = normalizeJs(record.display_code)
  return {
    ...record,
    pair_id: makePairId(record.language, index),
    display_code: displayCode,
    normalized_hash: sha256(displayCode),
    spec: {
      schema_version: '1.0.0',
      model: '',
      generated_at: '',
      content: {
        summary: '',
        signature_intent: '',
        behavior: [],
        edge_cases: [],
        forbidden_details: ['Do not mention the source project.']
      }
    }
  }
})

writeJsonl(output, normalized)
console.log(`Normalized ${normalized.length} JavaScript candidates.`)

function toCandidate(record: CandidateRecord | DatasetRecord): CandidateRecord {
  if ('display_code' in record) return record
  return {
    language: record.language,
    source_repo: record.human.source_repo,
    source_url_base: record.human.source_url.replace(/\/blob\/.*$/, ''),
    source_commit: record.human.source_commit,
    source_path: record.human.source_path,
    source_start_line: record.human.source_start_line,
    source_end_line: record.human.source_end_line,
    license: record.license,
    display_code: record.human.display_code
  }
}
