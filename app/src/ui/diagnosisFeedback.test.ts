import { describe, expect, it } from 'vitest'
import type { AnalyzeResponse } from '@snap/shared'
import {
  canRequestDiagnosisFeedback,
  correctionFailurePresentation,
  correctionStepOptions,
  DIAGNOSIS_FEEDBACK_PROMPT,
  isDurableFeedbackAvailable,
  synthesizeAllCorrectResponse,
} from './diagnosisFeedback'

const diagnosis: Extract<AnalyzeResponse, { kind: 'analysis' }> = {
  kind: 'analysis',
  steps: [
    { index: 0, latex: 'x + 1', plain: 'x plus 1', yBandTopPct: 10, yBandBottomPct: 20, verdict: 'ok' },
    { index: 3, latex: 'x - 1', plain: 'x minus 1', yBandTopPct: 30, yBandBottomPct: 40, verdict: 'wrong' },
  ],
  errorStepIndex: 3,
  misconceptionTag: 'sign-error',
  explanation: 'The sign changed.',
  followUp: { problem: 'Simplify −(x + 1).', concept: 'signs', hint: 'Distribute the negative.' },
  verifierAgreed: true,
}

describe('diagnosis feedback', () => {
  it('uses the approved student prompt verbatim', () => {
    expect(DIAGNOSIS_FEEDBACK_PROMPT).toBe('Is this the right first break?')
  })

  it('is available only for an active error diagnosis and describes every OCR step readably', () => {
    expect(canRequestDiagnosisFeedback(diagnosis)).toBe(true)
    expect(canRequestDiagnosisFeedback({
      ...diagnosis,
      steps: diagnosis.steps.map((step) => ({ ...step, verdict: 'ok' })),
      errorStepIndex: null,
      misconceptionTag: null,
      explanation: null,
      followUp: null,
    })).toBe(false)
    expect(correctionStepOptions(diagnosis)).toEqual([
      { index: 0, label: 'Step 1: x plus 1' },
      { index: 3, label: 'Step 4: x minus 1' },
    ])
  })

  it('waits for the displayed diagnosis revision to be saved and active before enabling feedback', () => {
    expect(isDurableFeedbackAvailable(diagnosis, { revisionId: null, isSaving: true, unsaved: false })).toBe(false)
    expect(isDurableFeedbackAvailable(diagnosis, { revisionId: null, isSaving: false, unsaved: true })).toBe(false)
    expect(isDurableFeedbackAvailable(diagnosis, { revisionId: 'revision-1', isSaving: false, unsaved: false })).toBe(true)
  })

  it('synthesizes a schema-valid all-correct revision without stale diagnosis copy', () => {
    expect(synthesizeAllCorrectResponse(diagnosis)).toEqual({
      ...diagnosis,
      steps: diagnosis.steps.map((step) => ({ ...step, verdict: 'ok' })),
      errorStepIndex: null,
      misconceptionTag: null,
      explanation: null,
      followUp: null,
      verifierAgreed: true,
    })
  })

  it('keeps correction failure recovery specific and cancellable', () => {
    expect(correctionFailurePresentation({ kind: 'timeout' })).toMatchObject({ title: 'The revised diagnosis took too long.', retryLabel: 'Try again', cancelLabel: 'Cancel' })
    expect(correctionFailurePresentation({ kind: 'cancelled' })).toMatchObject({ title: 'Correction cancelled.', retryLabel: 'Try again', cancelLabel: 'Back to result' })
  })
})
