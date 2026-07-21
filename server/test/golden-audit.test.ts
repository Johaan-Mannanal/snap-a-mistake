import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AnalyzeResponse } from '@snap/shared'
import {
  appendGoldenAudit,
  buildGoldenAuditEntry,
  type GoldenAuditEntry,
} from '../scripts/golden-audit.js'
import type { GoldenCase } from '../scripts/judge.js'

const temporaryDirectories: string[] = []

async function temporaryAuditPath(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'snap-golden-audit-'))
  temporaryDirectories.push(directory)
  return path.join(directory, 'nested', 'audit.json')
}

const actual = Object.assign({
  kind: 'analysis' as const,
  steps: [{
    index: 0,
    latex: 'x = 1',
    plain: 'x equals 1',
    yBandTopPct: 10,
    yBandBottomPct: 20,
    verdict: 'ok' as const,
  }],
  errorStepIndex: null,
  misconceptionTag: null,
  explanation: null,
  followUp: null,
  verifierAgreed: true,
}, {
  base64: 'secret-image-data',
  apiKey: 'secret-api-key',
  headers: { Authorization: 'Bearer secret-authorization' },
}) satisfies AnalyzeResponse

const judgedEntry: GoldenAuditEntry = {
  kind: 'response',
  file: 'correct.jpg',
  expected: { expect: 'correct' },
  actual,
  judgment: { pass: true, detail: 'ok' },
}

const pipelineErrorEntry: GoldenAuditEntry = {
  kind: 'pipeline-error',
  file: 'error.jpg',
  sourceId: 'img_123_pert_3.1',
  expected: { expect: 'error', errorStepAnchor: { all: ['x^{-1}'] }, tag: 'sign-error' },
  pipelineError: 'request timed out; Authorization: Bearer secret-authorization; apiKey=secret-api-key; base64=secret-image-data',
}

const anchoredFermatCase: GoldenCase = {
  file: 'fermat.jpg',
  source: 'fermat',
  sourceId: 'img_123_pert_3.1',
  expect: 'error',
  errorStepAnchor: { all: ['x^{-1}'] },
  tag: 'sign-error',
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })))
})

describe('appendGoldenAudit', () => {
  it('emits golden-runner response and pipeline entries with FERMAT semantic locators', async () => {
    const response = buildGoldenAuditEntry(anchoredFermatCase, {
      actual,
      judgment: { pass: false, detail: 'missed the error entirely' },
    })
    const pipelineError = buildGoldenAuditEntry(anchoredFermatCase, {
      pipelineError: 'request timed out',
    })

    expect(response).toMatchObject({
      kind: 'response',
      sourceId: 'img_123_pert_3.1',
      expected: { errorStepAnchor: { all: ['x^{-1}'] } },
    })
    expect(pipelineError).toMatchObject({
      kind: 'pipeline-error',
      sourceId: 'img_123_pert_3.1',
      expected: { errorStepAnchor: { all: ['x^{-1}'] } },
    })

    const auditPath = await temporaryAuditPath()
    await appendGoldenAudit(auditPath, [response, pipelineError])
    const document = JSON.parse(await readFile(auditPath, 'utf8'))
    expect(document.entries.map((entry: GoldenAuditEntry) => entry.expected.errorStepAnchor))
      .toEqual([{ all: ['x^{-1}'] }, { all: ['x^{-1}'] }])
  })

  it('writes response and pipeline-error entries as sanitized version-1 JSON while preserving steps', async () => {
    const auditPath = await temporaryAuditPath()

    await appendGoldenAudit(auditPath, [judgedEntry, pipelineErrorEntry])

    const raw = await readFile(auditPath, 'utf8')
    const document = JSON.parse(raw)
    expect(document).toMatchObject({
      version: 1,
      entries: [
        { kind: 'response', actual: { steps: actual.steps }, judgment: { pass: true, detail: 'ok' } },
        {
          kind: 'pipeline-error', sourceId: 'img_123_pert_3.1',
          expected: { errorStepAnchor: { all: ['x^{-1}'] } },
        },
      ],
    })
    expect(document.generatedAt).toEqual(expect.any(String))
    expect(Number.isNaN(Date.parse(document.generatedAt))).toBe(false)
    expect(raw).not.toMatch(/base64|apiKey|Authorization|secret-image-data|secret-api-key|secret-authorization/i)
  })

  it('creates the requested file on first append and atomically rewrites ordered accumulated entries', async () => {
    const auditPath = await temporaryAuditPath()
    await expect(access(auditPath)).rejects.toMatchObject({ code: 'ENOENT' })

    await appendGoldenAudit(auditPath, [judgedEntry])
    expect(JSON.parse(await readFile(auditPath, 'utf8')).entries.map((entry: GoldenAuditEntry) => entry.file))
      .toEqual(['correct.jpg'])

    await appendGoldenAudit(auditPath, [judgedEntry, pipelineErrorEntry])
    expect(JSON.parse(await readFile(auditPath, 'utf8')).entries.map((entry: GoldenAuditEntry) => entry.file))
      .toEqual(['correct.jpg', 'error.jpg'])
    await expect(access(`${auditPath}.partial`)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
