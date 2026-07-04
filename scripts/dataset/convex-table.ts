import { writeJsonl, readJsonl, toConvexPair, type DatasetRecord } from './lib.ts'

const [input = 'dataset/dev/js.jsonl', output = 'dataset/work/convex/pairs.jsonl'] = process.argv.slice(2)
const now = Date.now()
const records = readJsonl<DatasetRecord>(input)
const rows = records.map((record) => ({
  ...toConvexPair(record),
  createdAt: now,
  updatedAt: now
}))

writeJsonl(output, rows)
console.log(`Wrote ${rows.length} Convex table rows to ${output}.`)
