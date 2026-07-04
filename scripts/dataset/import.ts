import { execFileSync } from 'node:child_process'
import { readJsonl, toConvexPair, writeJsonl, type DatasetRecord } from './lib.ts'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const append = args.includes('--append')
const positionalArgs = args.filter((arg) => !arg.startsWith('--'))
const jsonlPath = positionalArgs.at(-1) || 'dataset/dev/js.jsonl'
const output = 'dataset/work/convex/pairs.jsonl'

const records = readJsonl<DatasetRecord>(jsonlPath)
if (records.length === 0) throw new Error(`No records found in ${jsonlPath}.`)

const pairs = records.map(toConvexPair)
const now = Date.now()
const rows = pairs.map((pair) => ({ ...pair, createdAt: now, updatedAt: now }))
if (dryRun) {
  console.log(`Dry run transformed ${pairs.length} pairs for Convex import.`)
  console.log(JSON.stringify(pairs[0], null, 2))
  process.exit(0)
}

writeJsonl(output, rows)
execFileSync(
  'pnpm',
  [
    'convex',
    'import',
    '--table',
    'pairs',
    output,
    '--format',
    'jsonLines',
    append ? '--append' : '--replace',
    ...(append ? [] : ['--yes'])
  ],
  { stdio: 'inherit' }
)
