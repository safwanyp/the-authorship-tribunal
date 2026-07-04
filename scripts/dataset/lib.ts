import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { execFileSync } from 'node:child_process'

export type LanguageId = 'js' | 'ts' | 'python' | 'rust' | 'cpp'

export interface DatasetRecord {
  dataset_version: string
  pair_id: string
  language: LanguageId
  review_status: 'approved' | 'deprecated'
  license: string
  human: {
    source_repo: string
    source_commit: string
    source_path: string
    source_start_line: number
    source_end_line: number
    source_url: string
    display_code: string
    normalized_hash: string
  }
  spec: {
    schema_version: string
    model: string
    generated_at: string
    content: {
      summary: string
      signature_intent: string
      behavior: string[]
      edge_cases: string[]
      forbidden_details: string[]
    }
  }
  ai: {
    model: string
    generation_prompt_version: string
    generated_at: string
    display_code: string
    retry_count: number
  }
}

export interface CandidateRecord {
  language: LanguageId
  source_repo: string
  source_url_base: string
  source_commit: string
  source_path: string
  source_start_line: number
  source_end_line: number
  license: string
  display_code: string
}

export interface SpecRecord extends CandidateRecord {
  pair_id: string
  normalized_hash: string
  spec: DatasetRecord['spec']
}

export interface GeneratedRecord extends SpecRecord {
  ai: DatasetRecord['ai']
}

export function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

export function writeJsonl(path: string, records: unknown[]) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`)
}

export function readEnv() {
  const values: Record<string, string> = { ...process.env } as Record<string, string>
  for (const path of ['.env', '.env.local']) {
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(?:#.*)?$/)
      if (!match) continue
      values[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
    }
  }
  return values
}

export function toConvexPair(record: DatasetRecord) {
  return {
    pairId: record.pair_id,
    datasetVersion: record.dataset_version,
    language: record.language,
    status: record.review_status,
    humanDisplayCode: record.human.display_code,
    aiDisplayCode: record.ai.display_code,
    displayLanguage: record.language,
    lineCountHuman: lineCount(record.human.display_code),
    lineCountAi: lineCount(record.ai.display_code),
    licenseSpdx: record.license,
    humanSourceRepo: record.human.source_repo,
    humanSourceCommit: record.human.source_commit,
    humanSourcePath: record.human.source_path,
    humanSourceStartLine: record.human.source_start_line,
    humanSourceEndLine: record.human.source_end_line,
    humanSourceUrl: record.human.source_url,
    aiModel: record.ai.model,
    aiGeneratedAt: record.ai.generated_at,
    specModel: record.spec.model,
    specGeneratedAt: record.spec.generated_at,
    specSummary: record.spec.content.summary,
    aiProvenanceUrl: `dataset/${record.dataset_version}/${record.language}.jsonl#${record.pair_id}`
  }
}

export function toDatasetRecord(record: GeneratedRecord, datasetVersion = 'v1'): DatasetRecord {
  return {
    dataset_version: datasetVersion,
    pair_id: record.pair_id,
    language: record.language,
    review_status: 'approved',
    license: record.license,
    human: {
      source_repo: record.source_repo,
      source_commit: record.source_commit,
      source_path: record.source_path,
      source_start_line: record.source_start_line,
      source_end_line: record.source_end_line,
      source_url: sourceUrl(record),
      display_code: record.display_code,
      normalized_hash: record.normalized_hash
    },
    spec: record.spec,
    ai: record.ai
  }
}

export function sourceUrl(record: CandidateRecord) {
  return `${record.source_url_base}/blob/${record.source_commit}/${record.source_path}#L${record.source_start_line}-L${record.source_end_line}`
}

export function lineCount(code: string) {
  return code.split('\n').length
}

export function meaningfulLineCount(code: string) {
  return code
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && line !== '{' && line !== '}').length
}

export function sha256(value: string) {
  return `sha256-${createHash('sha256').update(value).digest('hex')}`
}

export function stripJsComments(code: string) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function anonymizeTopLevelName(code: string) {
  return code.replace(
    /^\s*(export\s+)?(async\s+)?function\s+[$A-Z_a-z][$\w]*/m,
    (_match, exported = '', asyncKeyword = '') => `${exported}${asyncKeyword}function candidate`
  )
}

export function normalizeJs(code: string) {
  return anonymizeTopLevelName(stripJsComments(code))
}

export function listFiles(root: string, predicate: (path: string) => boolean) {
  const files: string[] = []
  function visit(dir: string) {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry)
      const stats = statSync(path)
      if (stats.isDirectory()) visit(path)
      if (stats.isFile() && predicate(path)) files.push(path)
    }
  }
  visit(root)
  return files
}

export function git(args: string[], cwd?: string) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

export function extractJsFunctions(source: string) {
  const records: { code: string; startLine: number; endLine: number }[] = []
  const pattern = /(?:export\s+)?(?:async\s+)?function\s+[$A-Z_a-z][$\w]*\s*\([^)]*\)\s*\{/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(source))) {
    const start = match.index
    let depth = 0
    let end = -1
    for (let index = source.indexOf('{', start); index < source.length; index += 1) {
      const char = source[index]
      if (char === '{') depth += 1
      if (char === '}') depth -= 1
      if (depth === 0) {
        end = index + 1
        break
      }
    }
    if (end === -1) continue
    const code = source.slice(start, end)
    records.push({
      code,
      startLine: source.slice(0, start).split('\n').length,
      endLine: source.slice(0, end).split('\n').length
    })
  }
  return records
}

export function relativePath(root: string, path: string) {
  return relative(root, path).replaceAll('\\', '/')
}

export function requireOpenAIKey() {
  const env = readEnv()
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for spec/generate commands.')
  }
  return env.OPENAI_API_KEY
}

export async function callOpenAIJson<T>(apiKey: string, model: string, prompt: string): Promise<T> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: prompt
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`)
  }

  const body = (await response.json()) as { output_text?: string; output?: unknown }
  const text = body.output_text || JSON.stringify(body.output)
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1) throw new Error('Model response did not contain JSON.')
  return JSON.parse(text.slice(firstBrace, lastBrace + 1)) as T
}

export function makePairId(language: LanguageId, index: number) {
  return `${language}_${String(index + 1).padStart(4, '0')}`
}
