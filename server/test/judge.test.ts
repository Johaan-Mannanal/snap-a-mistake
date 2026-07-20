import { describe, expect, it } from 'vitest'
import type { AnalyzeResponse } from '@snap/shared'
import {
  GoldenCaseSchema,
  GoldenManifestSchema,
  judge,
  selectCases,
  type GoldenCase,
} from '../scripts/judge.js'

const analysis = (over: Partial<Extract<AnalyzeResponse, { kind: 'analysis' }>> = {}): AnalyzeResponse => ({
  kind: 'analysis', steps: [], errorStepIndex: null, misconceptionTag: null,
  explanation: null, followUp: null, verifierAgreed: true, ...over,
})

describe('GoldenCaseSchema', () => {
  it('requires an index and tag for error cases', () => {
    expect(() => GoldenCaseSchema.parse({ file: 'a.jpg', source: 'synthetic', expect: 'error' })).toThrow()
  })

  it('requires a source ID for FERMAT cases', () => {
    expect(() => GoldenCaseSchema.parse({ file: 'a.jpg', source: 'fermat', expect: 'correct' })).toThrow()
  })

  it('parses a complete manifest', () => {
    const parsed = GoldenManifestSchema.parse({
      cases: [{ file: 'a.jpg', source: 'synthetic', expect: 'correct' }],
    })
    expect(parsed.cases).toHaveLength(1)
  })
})

describe('selectCases', () => {
  const cases: GoldenCase[] = [
    { file: 'a.jpg', source: 'synthetic', expect: 'correct' },
    { file: 'b.jpg', source: 'fermat', sourceId: 'img_1', expect: 'correct' },
  ]

  it('returns all cases when no source is requested', () => {
    expect(selectCases(cases)).toEqual(cases)
  })

  it('filters cases by source', () => {
    expect(selectCases(cases, 'fermat').map((c) => c.file)).toEqual(['b.jpg'])
  })
})

describe('judge', () => {
  it('passes correct work with a null error index', () => {
    expect(judge({ file: 'a.jpg', source: 'synthetic', expect: 'correct' }, analysis()).pass).toBe(true)
  })

  it('fails a false accusation', () => {
    const actual = analysis({ errorStepIndex: 1, misconceptionTag: 'sign-error' })
    expect(judge({ file: 'a.jpg', source: 'synthetic', expect: 'correct' }, actual).pass).toBe(false)
  })

  it('passes only when error step and tag both match', () => {
    const expected: GoldenCase = {
      file: 'b.jpg', source: 'synthetic', expect: 'error', errorStepIndex: 2, tag: 'sign-error',
    }
    expect(judge(expected, analysis({ errorStepIndex: 2, misconceptionTag: 'sign-error' })).pass).toBe(true)
    expect(judge(expected, analysis({ errorStepIndex: 2, misconceptionTag: 'algebraic-slip' })).pass).toBe(false)
    expect(judge(expected, analysis({ errorStepIndex: 0, misconceptionTag: 'sign-error' })).pass).toBe(false)
  })

  it('matches unreadable and not-math kinds directly', () => {
    expect(judge({ file: 'c.jpg', source: 'synthetic', expect: 'not-math' }, { kind: 'not-math' }).pass).toBe(true)
    expect(judge({ file: 'd.jpg', source: 'synthetic', expect: 'unreadable' }, { kind: 'unreadable', tips: [] }).pass).toBe(true)
  })
})
