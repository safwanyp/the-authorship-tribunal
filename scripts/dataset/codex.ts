import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'

const workRoot = 'dataset/work/codex'

export function callCodexJson<T>(prompt: string, schema: unknown, name: string): T {
  mkdirSync(workRoot, { recursive: true })
  const schemaPath = join(workRoot, `${name}.schema.json`)
  const outputPath = join(workRoot, `${name}.json`)
  writeFileSync(schemaPath, JSON.stringify(schema, null, 2))

  const args = [
    'exec',
    '--ephemeral',
    '--sandbox',
    'read-only',
    '--output-schema',
    schemaPath,
    '--output-last-message',
    outputPath
  ]

  const model = process.env.CODEX_DATASET_MODEL
  if (model) args.push('--model', model)
  args.push('-')

  execFileSync(codexBin(), args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    input: prompt,
    stdio: ['pipe', 'ignore', 'inherit']
  })

  if (!existsSync(outputPath)) {
    throw new Error(`Codex did not write ${outputPath}`)
  }

  return parseJson<T>(readFileSync(outputPath, 'utf8'))
}

export function parseJson<T>(value: string): T {
  const trimmed = value.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return JSON.parse(fenced?.[1] || trimmed) as T
}

export function safeName(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()
}

export function outputSlice<T>(records: T[]) {
  const start = Number(process.env.CODEX_DATASET_START || 0)
  const limit = Number(process.env.CODEX_DATASET_LIMIT || records.length)
  return records.slice(start, start + limit)
}

export function ensureParent(path: string) {
  mkdirSync(dirname(path), { recursive: true })
}

function codexBin() {
  if (process.env.CODEX_BIN) return process.env.CODEX_BIN

  const appBinary = '/Applications/Codex.app/Contents/Resources/codex'
  if (existsSync(appBinary)) return appBinary

  return 'codex'
}
