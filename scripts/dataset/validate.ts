import { readFileSync } from 'node:fs'

type JsonObject = Record<string, unknown>

const [jsonlPath, schemaPath] = process.argv.slice(2)

if (!jsonlPath || !schemaPath) {
  throw new Error('Usage: tsx scripts/dataset/validate.ts <records.jsonl> <schema.json>')
}

const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as JsonObject
const records = readFileSync(jsonlPath, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line, index) => ({ index: index + 1, value: JSON.parse(line) as JsonObject }))

for (const record of records) {
  validateObject(record.value, schema, `line ${record.index}`)
}

console.log(`Validated ${records.length} dataset records.`)

function validateObject(value: unknown, schemaNode: JsonObject, path: string): void {
  if (schemaNode.enum && !Array.isArray(schemaNode.enum)) {
    throw new Error(`${path}: schema enum must be an array`)
  }

  if (Array.isArray(schemaNode.enum) && !schemaNode.enum.includes(value)) {
    throw new Error(`${path}: expected one of ${schemaNode.enum.join(', ')}`)
  }

  if (schemaNode.type === 'object') {
    if (!isObject(value)) throw new Error(`${path}: expected object`)
    const required = (schemaNode.required || []) as string[]
    for (const key of required) {
      if (!(key in value)) throw new Error(`${path}.${key}: required`)
    }

    const properties = (schemaNode.properties || {}) as Record<string, JsonObject>
    for (const [key, childValue] of Object.entries(value)) {
      if (!properties[key]) {
        if (schemaNode.additionalProperties === false) {
          throw new Error(`${path}.${key}: unknown property`)
        }
        continue
      }
      validateObject(childValue, properties[key], `${path}.${key}`)
    }
  }

  if (schemaNode.type === 'array') {
    if (!Array.isArray(value)) throw new Error(`${path}: expected array`)
    for (let index = 0; index < value.length; index += 1) {
      validateObject(value[index], schemaNode.items as JsonObject, `${path}[${index}]`)
    }
  }

  if (schemaNode.type === 'string') {
    if (typeof value !== 'string') throw new Error(`${path}: expected string`)
    if (typeof schemaNode.minLength === 'number' && value.length < schemaNode.minLength) {
      throw new Error(`${path}: expected at least ${schemaNode.minLength} characters`)
    }
    if (schemaNode.pattern && !new RegExp(schemaNode.pattern as string).test(value)) {
      throw new Error(`${path}: did not match pattern`)
    }
  }

  if (schemaNode.type === 'integer') {
    if (!Number.isInteger(value)) throw new Error(`${path}: expected integer`)
    if (typeof schemaNode.minimum === 'number' && (value as number) < schemaNode.minimum) {
      throw new Error(`${path}: expected minimum ${schemaNode.minimum}`)
    }
  }
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
