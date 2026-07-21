import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AnalyzeResponse } from '@snap/shared'
import { describe, expect, it } from 'vitest'
import { GoldenManifestSchema, judge } from '../scripts/judge.js'
import { matchStepAnchor } from '../scripts/step-anchor.js'

type ReplayRecord = {
  sourceId: string
  actualIndex: number
  latex: string
  plain: string
  actualTag: NonNullable<Extract<AnalyzeResponse, { kind: 'analysis' }>['misconceptionTag']>
  verifierAgreed: boolean
  verdict: 'wrong'
}

const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = GoldenManifestSchema.parse(
  JSON.parse(await readFile(path.join(serverDir, 'golden', 'manifest.json'), 'utf8')),
)
const fixturePath = path.join(serverDir, 'test', 'fixtures', 'fermat-audit-run2-selected.json')
const fixtureText = await readFile(fixturePath, 'utf8')
const replay = JSON.parse(fixtureText) as ReplayRecord[]
const fermatErrors = manifest.cases.filter((candidate) =>
  candidate.source === 'fermat' && candidate.expect === 'error',
)

const analysisFor = (
  record: ReplayRecord,
  misconceptionTag: ReplayRecord['actualTag'],
): AnalyzeResponse => ({
  kind: 'analysis',
  steps: [{
    index: record.actualIndex,
    latex: record.latex,
    plain: record.plain,
    yBandTopPct: 0,
    yBandBottomPct: 10,
    verdict: record.verdict,
  }],
  errorStepIndex: record.actualIndex,
  misconceptionTag,
  explanation: null,
  followUp: null,
  verifierAgreed: record.verifierAgreed,
})

describe('FERMAT audit run 2 replay', () => {
  it('matches seven selected erroneous responses and rejects img_559’s selected line', () => {
    expect(replay.map((record) => record.sourceId)).toEqual(
      fermatErrors.map((candidate) => candidate.sourceId),
    )
    for (const record of replay) {
      const expected = fermatErrors.find((candidate) => candidate.sourceId === record.sourceId)
      expect(expected).toBeDefined()
      const match = matchStepAnchor(expected!.errorStepAnchor!, record)
      expect(match.pass).toBe(record.sourceId !== 'img_559_pert_3.1')
    }
  })

  it('passes the seven semantic selections at their runtime indices and rejects img_559', () => {
    for (const record of replay) {
      const expected = fermatErrors.find((candidate) => candidate.sourceId === record.sourceId)!
      const result = judge(expected, analysisFor(record, expected.tag!))
      expect(result.pass).toBe(record.sourceId !== 'img_559_pert_3.1')
    }
  })

  it('continues to reject run-2 tags that differ from canonical tags', () => {
    const mismatchedTags = replay.filter((candidate) =>
      candidate.sourceId !== 'img_559_pert_3.1'
      && candidate.actualTag !== fermatErrors.find((expected) => expected.sourceId === candidate.sourceId)?.tag,
    )
    expect(mismatchedTags).toHaveLength(5)
    for (const record of mismatchedTags) {
      const expected = fermatErrors.find((candidate) => candidate.sourceId === record.sourceId)!
      expect(judge(expected, analysisFor(record, record.actualTag))).toMatchObject({
        pass: false,
        detail: expect.stringContaining('tag mismatch'),
      })
    }
  })

  it('keeps the replay fixture compact and free of sensitive audit material', () => {
    expect(replay).toHaveLength(8)
    for (const record of replay) {
      expect(Object.keys(record).sort()).toEqual([
        'actualIndex',
        'actualTag',
        'latex',
        'plain',
        'sourceId',
        'verdict',
        'verifierAgreed',
      ])
    }
    expect(fixtureText).not.toMatch(
      /\b(?:api[_-]?key|authorization|bearer|sk-[a-z0-9]|prompt|explanation|follow-?up|image|headers?|environment|process\.env)\b/i,
    )
  })
})
