import { readFile } from 'node:fs/promises'
import path from 'node:path'
import OpenAI from 'openai'
import { loadConfig } from '../src/config.js'
import { makeRunAnalysis } from '../src/pipeline/run.js'
import { GOLDEN_DIR, preflightGoldenCases } from './golden-fixtures.js'
import { GoldenManifestSchema, GoldenSourceSchema, judge, selectCases } from './judge.js'

const parsed = GoldenManifestSchema.parse(JSON.parse(await readFile(path.join(GOLDEN_DIR, 'manifest.json'), 'utf8')))
const requestedSource = process.env.GOLDEN_SOURCE
const source = requestedSource ? GoldenSourceSchema.parse(requestedSource) : undefined
const cases = selectCases(parsed.cases, source)
const fixtures = await preflightGoldenCases(cases)

const config = loadConfig()
const client = new OpenAI({ apiKey: config.openaiApiKey, timeout: 30_000, maxRetries: 1 })
const run = makeRunAnalysis(client, config)

let failures = 0
for (const { goldenCase: c, base64 } of fixtures) {
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
console.log(`\n${cases.length - failures} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
