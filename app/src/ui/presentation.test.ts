import { describe, expect, it } from 'vitest'
import type { AnalyzeResponse } from '@snap/shared'
import { analysisPresentation, cameraPresentation } from './presentation'

describe('cameraPresentation', () => {
  it('uses direct capture guidance', () => {
    expect(cameraPresentation(false)).toEqual({ eyebrow: 'SNAP', instruction: 'Keep one problem inside the frame' })
  })

  it('labels a follow-up attempt without changing the instruction', () => {
    expect(cameraPresentation(true)).toEqual({ eyebrow: 'FOLLOW-UP', instruction: 'Keep one problem inside the frame' })
  })
})

type AnalysisResponse = Extract<AnalyzeResponse, { kind: 'analysis' }>

const base: Pick<AnalysisResponse, 'kind' | 'steps' | 'verifierAgreed'> = {
  kind: 'analysis',
  steps: [],
  verifierAgreed: true,
}

describe('analysisPresentation', () => {
  it('presents correct work without a green banner', () => {
    const response: AnalysisResponse = { ...base, errorStepIndex: null, misconceptionTag: null, explanation: null, followUp: null }
    expect(analysisPresentation(response)).toMatchObject({ tone: 'success', eyebrow: 'VERIFIED', headline: 'All steps check out' })
  })

  it('localizes an agreed error', () => {
    const response: AnalysisResponse = {
      ...base, errorStepIndex: 1, misconceptionTag: 'integration-by-parts-error', explanation: 'Extra x.',
      followUp: { problem: 'Try again.', concept: 'integration by parts' },
    }
    expect(analysisPresentation(response)).toEqual({
      tone: 'error', eyebrow: 'INTEGRATION BY PARTS ERROR', headline: 'The first break is in step two.', detail: 'Extra x.',
    })
  })

  it('softens verifier disagreement', () => {
    const response: AnalysisResponse = {
      ...base, verifierAgreed: false, errorStepIndex: 2, misconceptionTag: 'other', explanation: 'Check this transition.',
      followUp: { problem: 'Try again.', concept: 'review' },
    }
    expect(analysisPresentation(response)).toMatchObject({ tone: 'neutral', headline: 'Step three needs a second look.' })
  })
})
