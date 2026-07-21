import { mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { AnalyzeResponseSchema, type AnalyzeResponse } from '@snap/shared'
import type { GoldenCase, judge } from './judge.js'

type GoldenAuditExpected = Pick<GoldenCase, 'expect' | 'errorStepIndex' | 'errorStepAnchor' | 'tag'>
type GoldenJudgment = ReturnType<typeof judge>

type GoldenAuditCommon = {
  file: string
  sourceId?: string
  expected: GoldenAuditExpected
}

export type GoldenAuditEntry = GoldenAuditCommon & (
  | {
    kind: 'response'
    actual: AnalyzeResponse
    judgment: GoldenJudgment
  }
  | {
    kind: 'pipeline-error'
    pipelineError: string
  }
)

function safePipelineError(message: string): string {
  return /timed?\s*out|timeout/i.test(message) ? 'timeout' : 'pipeline-error'
}

function serializableEntry(entry: GoldenAuditEntry): GoldenAuditEntry {
  const common: GoldenAuditCommon = {
    file: entry.file,
    ...(entry.sourceId === undefined ? {} : { sourceId: entry.sourceId }),
    expected: {
      expect: entry.expected.expect,
      ...(entry.expected.errorStepIndex === undefined ? {} : { errorStepIndex: entry.expected.errorStepIndex }),
      ...(entry.expected.errorStepAnchor === undefined ? {} : { errorStepAnchor: entry.expected.errorStepAnchor }),
      ...(entry.expected.tag === undefined ? {} : { tag: entry.expected.tag }),
    },
  }

  if (entry.kind === 'pipeline-error') {
    return {
      ...common,
      kind: 'pipeline-error',
      pipelineError: safePipelineError(entry.pipelineError),
    }
  }

  return {
    ...common,
    kind: 'response',
    actual: AnalyzeResponseSchema.parse(entry.actual),
    judgment: {
      pass: entry.judgment.pass,
      detail: entry.judgment.detail,
    },
  }
}

export async function appendGoldenAudit(auditPath: string, entries: GoldenAuditEntry[]): Promise<void> {
  await mkdir(path.dirname(auditPath), { recursive: true })
  const temporaryPath = `${auditPath}.partial`
  const document = {
    version: 1,
    generatedAt: new Date().toISOString(),
    entries: entries.map(serializableEntry),
  }
  await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, auditPath)
}
