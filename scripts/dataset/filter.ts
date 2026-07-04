import { meaningfulLineCount, readJsonl, writeJsonl, type CandidateRecord } from './lib.ts'

const input = process.argv[2] || 'dataset/work/candidates/js.jsonl'
const output = process.argv[3] || 'dataset/work/filtered/js.jsonl'
const records = readJsonl<CandidateRecord>(input)

const filtered = records.filter((record) => {
  const lines = meaningfulLineCount(record.display_code)
  const path = record.source_path.toLowerCase()
  return (
    lines >= 8 &&
    lines <= 70 &&
    !path.includes('test') &&
    !path.includes('fixture') &&
    !path.includes('vendor') &&
    !record.display_code.includes('class ')
  )
})

writeJsonl(output, filtered)
console.log(`Filtered ${records.length} candidates down to ${filtered.length}.`)
