import { format } from 'prettier'
import { readJsonl, writeJsonl, type DatasetRecord, type LanguageId } from './lib.ts'

const paths = process.argv.slice(2)
const inputPaths = paths.length > 0 ? paths : ['dataset/v1/js.jsonl']

for (const path of inputPaths) {
  const records = readJsonl<DatasetRecord>(path)
  const formatted = []
  let changed = 0

  for (const record of records) {
    const next = {
      ...record,
      human: {
        ...record.human,
        display_code: await formatSnippet(record.human.display_code, record.language)
      },
      ai: {
        ...record.ai,
        display_code: await formatSnippet(record.ai.display_code, record.language)
      }
    }

    if (
      next.human.display_code !== record.human.display_code ||
      next.ai.display_code !== record.ai.display_code
    ) {
      changed += 1
    }

    formatted.push(next)
  }

  writeJsonl(path, formatted)
  console.log(`Formatted ${changed} of ${records.length} records in ${path}.`)
}

async function formatSnippet(code: string, language: LanguageId) {
  const cleaned = code.replace(/\n[ \t]+\n/g, '\n\n').replace(/\n{3,}/g, '\n\n').trim()
  const parser = language === 'ts' ? 'typescript' : 'babel'

  try {
    return (await format(cleaned, {
      parser,
      semi: false,
      singleQuote: true,
      trailingComma: 'none',
      printWidth: 100
    })).trim()
  } catch {
    return cleaned
  }
}
