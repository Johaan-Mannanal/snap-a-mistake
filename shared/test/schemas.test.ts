import { describe, expect, it } from 'vitest'
import {
  AnalyzeResponseSchema, MISCONCEPTION_TAGS, Stage1Schema, Stage2Schema, VerifierSchema,
} from '../src/index.js'

const step = (index: number) => ({
  index, latex: 'x^2', plain: 'x squared', yBandTopPct: 10, yBandBottomPct: 20,
})

describe('Stage1Schema', () => {
  it('accepts a valid transcription', () => {
    const r = Stage1Schema.parse({ isMath: true, legibility: 0.9, steps: [step(0)] })
    expect(r.steps).toHaveLength(1)
  })
  it('rejects legibility outside 0..1', () => {
    expect(() => Stage1Schema.parse({ isMath: true, legibility: 1.5, steps: [] })).toThrow()
  })
  it('rejects an inverted vertical band', () => {
    expect(() => Stage1Schema.parse({
      isMath: true,
      legibility: 0.9,
      steps: [{ ...step(0), yBandTopPct: 80, yBandBottomPct: 20 }],
    })).toThrow('yBandTopPct must not exceed yBandBottomPct')
  })
})

describe('Stage2Schema', () => {
  it('accepts a diagnosis with a known tag', () => {
    const r = Stage2Schema.parse({
      errorStepIndex: 2, misconceptionTag: 'sign-error',
      explanation: 'You flipped the sign.', followUp: { problem: 'd/dx(-3x)', concept: 'signs' },
    })
    expect(r.misconceptionTag).toBe('sign-error')
  })
  it('rejects tags outside the vocabulary', () => {
    expect(() => Stage2Schema.parse({
      errorStepIndex: 0, misconceptionTag: 'made-up-tag', explanation: 'x', followUp: null,
    })).toThrow()
  })
  it('accepts the all-correct shape (all nulls)', () => {
    const r = Stage2Schema.parse({ errorStepIndex: null, misconceptionTag: null, explanation: null, followUp: null })
    expect(r.errorStepIndex).toBeNull()
  })
  it('rejects an error index with a missing explanation', () => {
    expect(() => Stage2Schema.parse({ errorStepIndex: 1, misconceptionTag: 'sign-error', explanation: null, followUp: null })).toThrow()
  })
})

describe('AnalyzeResponseSchema', () => {
  it('parses each union member', () => {
    expect(AnalyzeResponseSchema.parse({ kind: 'not-math' }).kind).toBe('not-math')
    expect(AnalyzeResponseSchema.parse({ kind: 'unreadable', tips: ['more light'] }).kind).toBe('unreadable')
    const a = AnalyzeResponseSchema.parse({
      kind: 'analysis', steps: [{ ...step(0), verdict: 'ok' }], errorStepIndex: null,
      misconceptionTag: null, explanation: null, followUp: null, verifierAgreed: true,
    })
    expect(a.kind).toBe('analysis')
  })
  it('rejects an incomplete analysis diagnosis', () => {
    expect(() => AnalyzeResponseSchema.parse({
      kind: 'analysis', steps: [{ ...step(0), verdict: 'wrong' }], errorStepIndex: 0,
      misconceptionTag: null, explanation: null, followUp: null, verifierAgreed: true,
    })).toThrow('error diagnosis requires tag, explanation, and followUp')
  })
  it('rejects diagnosis fields when the work is correct', () => {
    expect(() => AnalyzeResponseSchema.parse({
      kind: 'analysis', steps: [{ ...step(0), verdict: 'ok' }], errorStepIndex: null,
      misconceptionTag: 'sign-error', explanation: 'A diagnosis should not be present.',
      followUp: { problem: 'x', concept: 'signs' }, verifierAgreed: true,
    })).toThrow('correct work must have all-null diagnosis fields')
  })
})

it('vocabulary matches the approved controlled set', () => {
  expect(MISCONCEPTION_TAGS).toContain('equals-abuse')
  expect(MISCONCEPTION_TAGS).toContain('notation-error')
  expect(MISCONCEPTION_TAGS).toContain('formula-misapplied')
  expect(MISCONCEPTION_TAGS).toHaveLength(13)
})

it('verifier schema', () => {
  expect(VerifierSchema.parse({ agrees: false, note: 'step 2 is fine' }).agrees).toBe(false)
})
