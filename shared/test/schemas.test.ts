import { describe, expect, it } from 'vitest'
import {
  AlternateFollowUpContextSchema, AnalyzeResponseSchema, AnalysisResultSchema, CorrectionContextSchema,
  FollowUpSchema, MISCONCEPTION_TAGS, Stage1Schema, Stage2Schema, VerifierSchema,
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
  it('rejects a zero-height vertical band', () => {
    expect(() => Stage1Schema.parse({
      isMath: true,
      legibility: 0.9,
      steps: [{ ...step(0), yBandTopPct: 20, yBandBottomPct: 20 }],
    })).toThrow('yBandTopPct must be less than yBandBottomPct')
  })
  it('accepts a step when both optional band endpoints are absent', () => {
    const { yBandTopPct: _top, yBandBottomPct: _bottom, ...unlocated } = step(41)
    const result = Stage1Schema.parse({ isMath: true, legibility: 0.9, steps: [unlocated] })

    expect(result.steps[0]).toEqual(unlocated)
  })
  it.each([
    ['bottom', { ...step(0), yBandBottomPct: undefined }],
    ['top', { ...step(0), yBandTopPct: undefined }],
  ])('rejects a vertical band with its %s endpoint missing', (_missingEndpoint, candidate) => {
    expect(() => Stage1Schema.parse({
      isMath: true,
      legibility: 0.9,
      steps: [candidate],
    })).toThrow('both band endpoints are required together')
  })
  it('rejects duplicate transcription step indexes', () => {
    expect(() => Stage1Schema.parse({
      isMath: true,
      legibility: 0.9,
      steps: [step(3), { ...step(3), yBandTopPct: 30, yBandBottomPct: 40 }],
    })).toThrow('step indexes must be unique')
  })
})

describe('Stage2Schema', () => {
  it('accepts a diagnosis with a known tag', () => {
    const r = Stage2Schema.parse({
      errorStepIndex: 2, misconceptionTag: 'sign-error',
      explanation: 'You flipped the sign.', followUp: { problem: 'd/dx(-3x)', concept: 'signs', hint: 'Keep the negative sign.' },
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

  it('requires Unicode or prose in student-facing diagnosis copy', () => {
    const base = {
      errorStepIndex: 0,
      misconceptionTag: 'algebraic-slip' as const,
      followUp: { problem: 'Simplify x² ÷ 2.', concept: 'division', hint: 'Divide the coefficient.' },
    }

    expect(Stage2Schema.parse({
      ...base,
      explanation: 'Dividing x² by 2 preserves the exponent.',
    }).explanation).toContain('x²')

    expect(() => Stage2Schema.parse({
      ...base,
      explanation: 'Dividing x^2 by 2 preserves the exponent.',
    })).toThrow('caret notation')

    expect(() => Stage2Schema.parse({
      ...base,
      explanation: 'Dividing by $\\frac{x}{2}$ changes the value.',
    })).toThrow('raw LaTeX')
  })

  it('rejects raw LaTeX control symbols in follow-up problems', () => {
    expect(() => Stage2Schema.parse({
      errorStepIndex: 0,
      misconceptionTag: 'algebraic-slip',
      explanation: 'Use the same operation on both sides.',
      followUp: { problem: 'Simplify x\\, y.', concept: 'multiplication', hint: 'Multiply the factors.' },
    })).toThrow('raw LaTeX')
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
  it('preserves unlocated steps and Unicode math in a complete response', () => {
    const response = AnalyzeResponseSchema.parse({
      kind: 'analysis',
      steps: [
        { index: 41, latex: 'x^2', plain: 'x²', yBandTopPct: 10, yBandBottomPct: 20, verdict: 'ok' },
        { index: 7, latex: 'x - 1', plain: 'x − 1', verdict: 'wrong' },
      ],
      errorStepIndex: 7,
      misconceptionTag: 'sign-error',
      explanation: 'The sign changed before x².',
      followUp: { problem: 'Simplify −(x² + 1).', concept: 'signs', hint: 'Distribute the negative.' },
      verifierAgreed: true,
    })

    if (response.kind !== 'analysis') throw new Error('expected analysis')
    expect(response.steps).toEqual([
      { index: 41, latex: 'x^2', plain: 'x²', yBandTopPct: 10, yBandBottomPct: 20, verdict: 'ok' },
      { index: 7, latex: 'x - 1', plain: 'x − 1', verdict: 'wrong' },
    ])
  })
  it('rejects a half-present band in a complete response', () => {
    expect(() => AnalyzeResponseSchema.parse({
      kind: 'analysis',
      steps: [{ index: 7, latex: 'x - 1', plain: 'x − 1', yBandTopPct: 20, verdict: 'wrong' }],
      errorStepIndex: 7,
      misconceptionTag: 'sign-error',
      explanation: 'The sign changed.',
      followUp: { problem: 'Simplify −(x + 1).', concept: 'signs', hint: 'Distribute the negative.' },
      verifierAgreed: true,
    })).toThrow('both band endpoints are required together')
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
      followUp: { problem: 'x', concept: 'signs', hint: 'Check the sign.' }, verifierAgreed: true,
    })).toThrow('correct work must have all-null diagnosis fields')
  })
  it('rejects raw LaTeX in analysis student-facing fields', () => {
    const base = {
      kind: 'analysis' as const,
      steps: [{ ...step(0), verdict: 'wrong' as const }],
      errorStepIndex: 0,
      misconceptionTag: 'algebraic-slip' as const,
      verifierAgreed: true,
    }

    expect(() => AnalyzeResponseSchema.parse({
      ...base,
      explanation: 'Terms are not automatically equal\\!',
      followUp: { problem: 'Simplify x².', concept: 'equality', hint: 'Keep both sides equal.' },
    })).toThrow('raw LaTeX')

    expect(() => AnalyzeResponseSchema.parse({
      ...base,
      explanation: 'Terms are not automatically equal.',
      followUp: { problem: 'Simplify x\\, y.', concept: 'multiplication', hint: 'Multiply the factors.' },
    })).toThrow('raw LaTeX')
  })

  it('rejects duplicate analysis step indexes', () => {
    expect(() => AnalysisResultSchema.parse({
      kind: 'analysis',
      steps: [
        { ...step(2), verdict: 'ok' },
        { ...step(2), yBandTopPct: 30, yBandBottomPct: 40, verdict: 'wrong' },
      ],
      errorStepIndex: 2,
      misconceptionTag: 'sign-error',
      explanation: 'The sign changed.',
      followUp: { problem: 'Simplify −2x + x.', concept: 'signs', hint: 'Keep the negative sign.' },
      verifierAgreed: true,
    })).toThrow('step indexes must be unique')
  })

  it('requires an error step index to identify an included step', () => {
    expect(() => AnalysisResultSchema.parse({
      kind: 'analysis',
      steps: [{ ...step(2), verdict: 'ok' }, { ...step(5), verdict: 'wrong' }],
      errorStepIndex: 4,
      misconceptionTag: 'sign-error',
      explanation: 'The sign changed.',
      followUp: { problem: 'Simplify −2x + x.', concept: 'signs', hint: 'Keep the negative sign.' },
      verifierAgreed: true,
    })).toThrow('error step must exist')
  })

  it.each([
    ['wrong verdict for correct work', null, true, ['ok', 'wrong', 'ok']],
    ['suspect verdict for correct work', null, true, ['ok', 'suspect', 'ok']],
    ['downstream verdict for correct work', null, true, ['ok', 'downstream', 'ok']],
    ['wrong verdict before the diagnosis', 5, true, ['wrong', 'wrong', 'downstream']],
    ['suspect verdict before the diagnosis', 5, true, ['suspect', 'wrong', 'downstream']],
    ['downstream verdict before the diagnosis', 5, true, ['downstream', 'wrong', 'downstream']],
    ['ok verdict at an agreed diagnosis', 5, true, ['ok', 'ok', 'downstream']],
    ['suspect verdict at an agreed diagnosis', 5, true, ['ok', 'suspect', 'downstream']],
    ['wrong verdict at a disputed diagnosis', 5, false, ['ok', 'wrong', 'downstream']],
    ['ok verdict after the diagnosis', 5, true, ['ok', 'wrong', 'ok']],
    ['wrong verdict after the diagnosis', 5, true, ['ok', 'wrong', 'wrong']],
    ['suspect verdict after the diagnosis', 5, true, ['ok', 'wrong', 'suspect']],
  ] as const)('rejects a contradictory analysis with %s', (
    _case,
    errorStepIndex,
    verifierAgreed,
    verdicts,
  ) => {
    const hasDiagnosis = errorStepIndex !== null
    expect(() => AnalysisResultSchema.parse({
      kind: 'analysis',
      steps: [
        { ...step(2), verdict: verdicts[0] },
        { ...step(5), verdict: verdicts[1] },
        { ...step(9), verdict: verdicts[2] },
      ],
      errorStepIndex,
      misconceptionTag: hasDiagnosis ? 'sign-error' : null,
      explanation: hasDiagnosis ? 'The sign changed.' : null,
      followUp: hasDiagnosis
        ? { problem: 'Simplify −2x + x.', concept: 'signs', hint: 'Keep the negative sign.' }
        : null,
      verifierAgreed,
    })).toThrow('verdicts must match the diagnosis')
  })

  it('accepts agreed and disputed diagnoses by array order with sparse indexes and Unicode math', () => {
    const agreed = AnalysisResultSchema.parse({
      kind: 'analysis',
      steps: [
        { ...step(41), latex: 'x² − 1', plain: 'x² minus 1', verdict: 'ok' },
        { ...step(7), latex: 'x² = −1', plain: 'x² equals −1', verdict: 'wrong' },
        { ...step(103), latex: 'x = √−1', plain: 'x equals √−1', verdict: 'downstream' },
      ],
      errorStepIndex: 7,
      misconceptionTag: 'sign-error',
      explanation: 'The sign changed before taking √.',
      followUp: { problem: 'Simplify x² − 4.', concept: 'signs', hint: 'Keep −4 on the same side.' },
      verifierAgreed: true,
    })
    const disputed = AnalysisResultSchema.parse({
      kind: 'analysis',
      steps: [
        { ...step(41), latex: '∫ x dx', plain: 'integral of x', verdict: 'ok' },
        { ...step(7), latex: '= x² ÷ 2', plain: 'equals x² ÷ 2', verdict: 'suspect' },
        { ...step(103), latex: '= 2x', plain: 'equals 2x', verdict: 'downstream' },
      ],
      errorStepIndex: 7,
      misconceptionTag: 'other',
      explanation: 'This transition may need another check.',
      followUp: { problem: 'Evaluate ∫ 2x dx.', concept: 'integration', hint: 'Increase the exponent by one.' },
      verifierAgreed: false,
    })

    expect(agreed.steps.map(({ verdict }) => verdict)).toEqual(['ok', 'wrong', 'downstream'])
    expect(disputed.steps.map(({ verdict }) => verdict)).toEqual(['ok', 'suspect', 'downstream'])
  })

  it('accepts all-correct work with sparse indexes and Unicode math', () => {
    const correct = AnalysisResultSchema.parse({
      kind: 'analysis',
      steps: [
        { ...step(41), latex: '∫ x dx', plain: 'integral of x', verdict: 'ok' },
        { ...step(7), latex: '= x² ÷ 2 + C', plain: 'equals x² ÷ 2 plus C', verdict: 'ok' },
      ],
      errorStepIndex: null,
      misconceptionTag: null,
      explanation: null,
      followUp: null,
      verifierAgreed: true,
    })

    expect(correct.errorStepIndex).toBeNull()
  })
})

describe('correction and alternate follow-up contracts', () => {
  it('validates a selected step contained in the submitted analysis', () => {
    const analysis = AnalysisResultSchema.parse({
      kind: 'analysis',
      steps: [{ ...step(0), verdict: 'wrong' }],
      errorStepIndex: 0,
      misconceptionTag: 'sign-error',
      explanation: 'The sign changed.',
      followUp: { problem: 'Simplify −2x + x.', concept: 'signs', hint: 'Combine like terms.' },
      verifierAgreed: true,
    })

    expect(CorrectionContextSchema.parse({ analysis, selectedStepIndex: 0 }).selectedStepIndex).toBe(0)
    expect(() => CorrectionContextSchema.parse({ analysis, selectedStepIndex: 4 })).toThrow('selected step must exist')
  })

  it('requires Unicode-safe follow-up hints', () => {
    expect(FollowUpSchema.parse({
      problem: 'Simplify x².', concept: 'powers', hint: 'Use the exponent rule.',
    }).hint).toBe('Use the exponent rule.')

    expect(() => FollowUpSchema.parse({
      problem: 'x²', concept: 'powers', hint: '\\frac{1}{2}',
    })).toThrow('raw LaTeX')
  })

  it('limits alternate follow-up context to five previous problems', () => {
    expect(AlternateFollowUpContextSchema.parse({
      concept: 'signs',
      diagnosis: 'Keep the negative sign with the term.',
      previousProblems: ['−2 + 1', '−3 + 2', '−4 + 3', '−5 + 4', '−6 + 5'],
    }).previousProblems).toHaveLength(5)

    expect(() => AlternateFollowUpContextSchema.parse({
      concept: 'signs',
      diagnosis: 'Keep the negative sign with the term.',
      previousProblems: ['−2 + 1', '−3 + 2', '−4 + 3', '−5 + 4', '−6 + 5', '−7 + 6'],
    })).toThrow()
  })

  it('bounds all client-controlled follow-up prompt fields without rejecting Unicode math', () => {
    const context = {
      concept: 'integration by parts',
      diagnosis: 'The remaining integral kept an extra x while preserving eˣ.',
      previousProblems: ['Evaluate ∫ x eˣ dx.'],
    }

    expect(AlternateFollowUpContextSchema.parse(context)).toEqual(context)
    expect(() => AlternateFollowUpContextSchema.parse({ ...context, concept: 'c'.repeat(121) })).toThrow()
    expect(() => AlternateFollowUpContextSchema.parse({ ...context, diagnosis: 'd'.repeat(1001) })).toThrow()
    expect(() => AlternateFollowUpContextSchema.parse({ ...context, previousProblems: ['p'.repeat(501)] })).toThrow()
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
