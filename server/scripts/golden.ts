import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { appendGoldenAudit, type GoldenAuditEntry } from './golden-audit.js'
import { GOLDEN_DIR, preflightGoldenCases } from './golden-fixtures.js'
import { GoldenManifestSchema, GoldenSourceSchema, judge, selectCases } from './judge.js'

const parsed = GoldenManifestSchema.parse(JSON.parse(await readFile(path.join(GOLDEN_DIR, 'manifest.json'), 'utf8')))
const requestedSource = process.env.GOLDEN_SOURCE
const source = requestedSource ? GoldenSourceSchema.parse(requestedSource) : undefined
const cases = selectCases(parsed.cases, source)
const fixtures = await preflightGoldenCases(cases)
const auditPath = process.env.GOLDEN_AUDIT_PATH

const [{ default: OpenAI }, { loadConfig }, { makeRunAnalysis }] = await Promise.all([
  import('openai'),
  import('../src/config.js'),
  import('../src/pipeline/run.js'),
])
const config = loadConfig()
const client = new OpenAI({ apiKey: config.openaiApiKey, timeout: 30_000, maxRetries: 1 })
const run = makeRunAnalysis(client, config)

let failures = 0
const auditEntries: GoldenAuditEntry[] = []
for (const { goldenCase: c, base64 } of fixtures) {
  let auditEntry: GoldenAuditEntry
  try {
    const actual = await run({ base64, mediaType: 'image/jpeg' })
    const judgment = judge(c, actual)
    const { pass, detail } = judgment
    if (!pass) failures++
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${c.file} — ${detail}`)
    auditEntry = {
      kind: 'response',
      file: c.file,
      ...(c.sourceId === undefined ? {} : { sourceId: c.sourceId }),
      expected: {
        expect: c.expect,
        ...(c.errorStepIndex === undefined ? {} : { errorStepIndex: c.errorStepIndex }),
        ...(c.tag === undefined ? {} : { tag: c.tag }),
      },
      actual,
      judgment,
    }
  } catch (err) {
    failures++
    console.log(`FAIL  ${c.file} — pipeline threw: ${err}`)
    auditEntry = {
      kind: 'pipeline-error',
      file: c.file,
      ...(c.sourceId === undefined ? {} : { sourceId: c.sourceId }),
      expected: {
        expect: c.expect,
        ...(c.errorStepIndex === undefined ? {} : { errorStepIndex: c.errorStepIndex }),
        ...(c.tag === undefined ? {} : { tag: c.tag }),
      },
      pipelineError: String(err),
    }
  }
  if (auditPath) {
    auditEntries.push(auditEntry)
    await appendGoldenAudit(auditPath, auditEntries)
  }
}
console.log(`\n${cases.length - failures} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
