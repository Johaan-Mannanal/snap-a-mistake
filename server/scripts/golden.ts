import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import OpenAI from 'openai'
import { loadConfig } from '../src/config.js'
import { makeRunAnalysis } from '../src/pipeline/run.js'
import { GoldenManifestSchema, GoldenSourceSchema, judge, selectCases } from './judge.js'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'golden')
const parsed = GoldenManifestSchema.parse(JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8')))
const requestedSource = process.env.GOLDEN_SOURCE
const source = requestedSource ? GoldenSourceSchema.parse(requestedSource) : undefined
const cases = selectCases(parsed.cases, source)

const config = loadConfig()
const client = new OpenAI({ apiKey: config.openaiApiKey, timeout: 30_000, maxRetries: 1 })
const run = makeRunAnalysis(client, config)

let failures = 0
let skipped = 0
for (const c of cases) {
  const photo = path.join(dir, 'photos', c.file)
  if (!existsSync(photo)) { skipped++; console.log(`SKIP  ${c.file} (photo not added yet)`); continue }
  const base64 = (await readFile(photo)).toString('base64')
  try {
    const actual = await run({ base64, mediaType: 'image/jpeg' })
    const { pass, detail } = judge(c, actual)
    if (!pass) failures++
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${c.file} — ${detail}`)
  } catch (err) {
    failures++
    console.log(`FAIL  ${c.file} — pipeline threw: ${err}`)
  }
}
console.log(`\n${cases.length - failures - skipped} passed, ${failures} failed, ${skipped} skipped`)
process.exit(failures > 0 ? 1 : 0)
