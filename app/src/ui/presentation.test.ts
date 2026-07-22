import { describe, expect, it } from 'vitest'
import type { AnalyzeResponse, Step } from '@snap/shared'
import {
  analysisPresentation,
  analysisStagePresentation,
  cameraPresentation,
  stepAccessibilityLabel,
} from './presentation'

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

describe('analysis accessibility presentation', () => {
  it('gives completed, current, and upcoming stages distinct marks and spoken statuses', () => {
    expect(analysisStagePresentation('Read handwriting', 0, 1)).toEqual({
      status: 'completed', mark: '✓', accessibilityLabel: 'Read handwriting, completed',
    })
    expect(analysisStagePresentation('Check each step', 1, 1)).toEqual({
      status: 'current', mark: '●', accessibilityLabel: 'Check each step, current',
    })
    expect(analysisStagePresentation('Verify diagnosis', 2, 1)).toEqual({
      status: 'upcoming', mark: '○', accessibilityLabel: 'Verify diagnosis, upcoming',
    })
  })

  it('describes the complete expanded step in human terms', () => {
    const step: Step = {
      index: 1,
      verdict: 'wrong',
      plain: 'x e to the x minus x times the integral',
      latex: 'x e^x - x \\int e^x dx',
      yBandTopPct: 25,
      yBandBottomPct: 45,
    }
    expect(stepAccessibilityLabel(step, 'Integration by parts error', 'The extra x stays inside the integral.')).toBe(
      'Step 2, incorrect. Work: x e to the x minus x times the integral. LaTeX: x e^x - x \\int e^x dx. Misconception: Integration by parts error. Explanation: The extra x stays inside the integral.',
    )
  })
})
