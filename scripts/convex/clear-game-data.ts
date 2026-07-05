import { existsSync, readFileSync } from 'node:fs'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../convex/_generated/api.js'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const confirmed = args.includes('--yes')
const batchSize = readNumberArg('--batch-size') || 100
const env = readEnv()
const convexUrl = readStringArg('--url') || env.CONVEX_CLEANUP_URL || env.NUXT_PUBLIC_CONVEX_URL || env.CONVEX_URL
const adminSecret = env.CONFIG_ADMIN_SECRET

if (!convexUrl) {
  throw new Error('Set NUXT_PUBLIC_CONVEX_URL or CONVEX_CLEANUP_URL, or pass --url https://your-deployment.convex.cloud.')
}

if (!adminSecret) {
  throw new Error('Set CONFIG_ADMIN_SECRET in your environment or .env before running this cleanup.')
}

if (!dryRun && !confirmed) {
  throw new Error('Refusing to clear game data without --yes. Run with --dry-run first, then add --yes to delete.')
}

const client = new ConvexHttpClient(convexUrl, { logger: false })
const totals = {
  answers: 0,
  sessionQuestions: 0,
  sessions: 0,
  pairAggregates: 0,
  languageAggregates: 0
}

console.log(`${dryRun ? 'Checking' : 'Clearing'} launch-test game data on ${convexUrl}`)
console.log('Preserving pairs and appConfig.')

let pass = 0
let hasMore = true
while (hasMore) {
  pass += 1
  const result = await client.mutation(api.admin.clearGameData, {
    adminSecret,
    dryRun,
    batchSize
  })
  const counts = dryRun ? result.scanned : result.deleted
  for (const table of Object.keys(totals) as Array<keyof typeof totals>) {
    totals[table] += counts[table]
  }

  console.log(`Pass ${pass}: ${formatCounts(counts)}`)

  if (dryRun) break
  hasMore = result.hasMore
}

console.log(`${dryRun ? 'Found up to' : 'Deleted'}: ${formatCounts(totals)}`)

function readStringArg(name: string) {
  const index = args.indexOf(name)
  if (index === -1) return ''
  return args[index + 1] || ''
}

function readNumberArg(name: string) {
  const value = Number(readStringArg(name))
  return Number.isFinite(value) && value > 0 ? value : 0
}

function readEnv() {
  const values: Record<string, string> = { ...process.env } as Record<string, string>
  for (const path of ['.env', '.env.local']) {
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(?:#.*)?$/)
      if (!match) continue
      values[match[1]] ??= match[2].replace(/^['"]|['"]$/g, '')
    }
  }
  return values
}

function formatCounts(counts: Record<string, number>) {
  return Object.entries(counts)
    .map(([table, count]) => `${table}=${count}`)
    .join(', ')
}
