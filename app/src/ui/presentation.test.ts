import { describe, expect, it } from 'vitest'
import type { AnalyzeResponse, Step } from '@snap/shared'
import {
  analysisPresentation,
  analysisStagePresentation,
  cameraPresentation,
  cameraPermissionPresentation,
  stepAccessibilityLabel,
  trendPresentation,
} from './presentation'
import { colors } from './theme'

describe('cameraPresentation', () => {
  it('uses direct capture guidance', () => {
    expect(cameraPresentation(false)).toEqual({ eyebrow: 'SNAP', instruction: 'Keep one problem inside the frame' })
  })

  it('labels a follow-up attempt without changing the instruction', () => {
    expect(cameraPresentation(true)).toEqual({ eyebrow: 'FOLLOW-UP', instruction: 'Keep one problem inside the frame' })
  })
})

describe('cameraPermissionPresentation', () => {
  it('keeps permission loading distinct from a denial', () => {
    expect(cameraPermissionPresentation(null)).toEqual({
      state: 'loading',
      title: 'Checking camera access',
      detail: 'You can still choose a photo from your library.',
      primaryLabel: null,
    })
  })

  it('offers a permission request while the system can ask again', () => {
    expect(cameraPermissionPresentation({ granted: false, canAskAgain: true })).toEqual({
      state: 'requestable',
      title: 'Camera access',
      detail: 'Use the camera to capture one problem at a time.',
      primaryLabel: 'Allow camera',
    })
  })

  it('sends permanently denied permission to Settings', () => {
    expect(cameraPermissionPresentation({ granted: false, canAskAgain: false })).toEqual({
      state: 'blocked',
      title: 'Camera access is off',
      detail: 'Turn on Camera access in Settings, or choose a photo from your library.',
      primaryLabel: 'Open Settings',
    })
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
    expect(analysisPresentation(response)).toMatchObject({ tone: 'success', eyebrow: 'CHECKED', headline: 'All steps check out' })
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
      'Step 2, incorrect. Work: x e to the x minus x times the integral. Math: x eˣ − x ∫ eˣ dx. Misconception: Integration by parts error. Explanation: The extra x stays inside the integral.',
    )
  })

  it('does not expose unsupported LaTeX markup in step copy', () => {
    const step: Step = {
      index: 8,
      verdict: 'ok',
      plain: 'Cancel suitable terms.',
      latex: '=\\overset{5}{\\cancel{35}}\\times\\frac{\\cancel{5}}{\\underset{2}{\\cancel{6}}}',
      yBandTopPct: 70,
      yBandBottomPct: 80,
    }

    const label = stepAccessibilityLabel(step, null, null)

    expect(label).toBe('Step 9, correct. Work: Cancel suitable terms.')
    expect(label).not.toContain('\\')
  })

  it('converts the photographed fraction and operator notation to native text', () => {
    const step: Step = {
      index: 0,
      verdict: 'ok',
      plain: 'Negative thirty-five divided by negative six fifths, times zero point two, divided by negative seven ninths.',
      latex: '-35\\div\\left(-\\frac{6}{5}\\right)\\times 0.2\\div\\left(-\\frac{7}{9}\\right)',
      yBandTopPct: 0,
      yBandBottomPct: 10,
    }

    expect(stepAccessibilityLabel(step, null, null)).toBe(
      'Step 1, correct. Work: Negative thirty-five divided by negative six fifths, times zero point two, divided by negative seven ninths. Math: −35 ÷ (−6/5) × 0.2 ÷ (−7/9).',
    )
  })

  it('omits prose-only subtext that repeats the step title', () => {
    const step: Step = {
      index: 1,
      verdict: 'ok',
      plain: '1. Deal with the sign.',
      latex: '1.\\ \\text{Deal with the sign:}',
      yBandTopPct: 10,
      yBandBottomPct: 20,
    }

    expect(stepAccessibilityLabel(step, null, null)).toBe('Step 2, correct. Work: 1. Deal with the sign.')
  })
})

describe('trendPresentation', () => {
  it.each([
    ['fewer', { label: 'Improving', color: colors.success, symbol: '↗' }],
    ['more', { label: 'Needs attention', color: colors.error, symbol: '↘' }],
    ['same', { label: 'Steady', color: colors.muted, symbol: '→' }],
  ] as const)('maps %s without decorative color', (trend, expected) => {
    expect(trendPresentation(trend)).toEqual(expected)
  })
})
