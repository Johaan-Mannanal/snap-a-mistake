import { describe, expect, it } from 'vitest'
import type { AnalyzeResponse } from '@snap/shared'
import { judge, type GoldenCase } from '../scripts/judge.js'

const analysis = (over: Partial<Extract<AnalyzeResponse, { kind: 'analysis' }>> = {}): AnalyzeResponse => ({
  kind: 'analysis', steps: [], errorStepIndex: null, misconceptionTag: null,
  explanation: null, followUp: null, verifierAgreed: true, ...over,
})

describe('judge', () => {
  it('passes correct-work cases with a null error index', () => {
    const c: GoldenCase = { file: 'a.jpg', expect: 'correct' }
    expect(judge(c, analysis()).pass).toBe(true)
  })
  it('fails correct-work cases that got accused (false accusation)', () => {
    const c: GoldenCase = { file: 'a.jpg', expect: 'correct' }
    expect(judge(c, analysis({ errorStepIndex: 1, misconceptionTag: 'sign-error' })).pass).toBe(false)
  })
  it('passes error cases when step AND tag match', () => {
    const c: GoldenCase = { file: 'b.jpg', expect: 'error', errorStepIndex: 2, tag: 'sign-error' }
    expect(judge(c, analysis({ errorStepIndex: 2, misconceptionTag: 'sign-error' })).pass).toBe(true)
  })
  it('fails error cases flagging the wrong step', () => {
    const c: GoldenCase = { file: 'b.jpg', expect: 'error', errorStepIndex: 2, tag: 'sign-error' }
    expect(judge(c, analysis({ errorStepIndex: 0, misconceptionTag: 'sign-error' })).pass).toBe(false)
  })
  it('passes error cases with the right step but different tag (partial credit noted in detail)', () => {
    const c: GoldenCase = { file: 'b.jpg', expect: 'error', errorStepIndex: 2, tag: 'sign-error' }
    const r = judge(c, analysis({ errorStepIndex: 2, misconceptionTag: 'algebraic-slip' }))
    expect(r.pass).toBe(true)
    expect(r.detail).toContain('tag mismatch')
  })
  it('matches unreadable and not-math kinds directly', () => {
    expect(judge({ file: 'c.jpg', expect: 'not-math' }, { kind: 'not-math' }).pass).toBe(true)
    expect(judge({ file: 'd.jpg', expect: 'unreadable' }, { kind: 'unreadable', tips: [] }).pass).toBe(true)
    expect(judge({ file: 'd.jpg', expect: 'unreadable' }, { kind: 'not-math' }).pass).toBe(false)
  })
})
