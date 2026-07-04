import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  extractJsFunctions,
  git,
  listFiles,
  relativePath,
  writeJsonl,
  type CandidateRecord,
  type LanguageId
} from './lib.ts'

interface RepoConfig {
  slug: string
  url: string
  source_url_base: string
  ref: string
  license: string
  language: LanguageId
  include_extensions: string[]
  exclude_path_fragments: string[]
}

const repos = JSON.parse(readFileSync('scripts/dataset/repos.yml', 'utf8')) as RepoConfig[]
const workRoot = '.dataset-work/repos'
const candidates: CandidateRecord[] = []
mkdirSync(workRoot, { recursive: true })

for (const repo of repos) {
  if (repo.language !== 'js') continue
  const localName = repo.slug.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const repoRoot = join(workRoot, localName)

  if (!existsSync(repoRoot)) {
    git(['clone', repo.url, repoRoot])
  }
  git(['fetch', '--all', '--tags'], repoRoot)
  git(['checkout', repo.ref], repoRoot)
  const commit = git(['rev-parse', 'HEAD'], repoRoot)

  const files = listFiles(repoRoot, (path) => {
    const rel = `/${relativePath(repoRoot, path)}`
    return (
      repo.include_extensions.some((extension) => rel.endsWith(extension)) &&
      !repo.exclude_path_fragments.some((fragment) => rel.includes(fragment))
    )
  })

  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const sourcePath = relativePath(repoRoot, file)
    for (const fn of extractJsFunctions(source)) {
      candidates.push({
        language: 'js',
        source_repo: repo.slug,
        source_url_base: repo.source_url_base,
        source_commit: commit,
        source_path: sourcePath,
        source_start_line: fn.startLine,
        source_end_line: fn.endLine,
        license: repo.license,
        display_code: fn.code
      })
    }
  }
}

writeJsonl('dataset/work/candidates/js.jsonl', candidates)
console.log(`Collected ${candidates.length} JavaScript function candidates.`)
