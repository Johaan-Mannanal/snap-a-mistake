import { describe, expect, it } from 'vitest'
import type { AnalyzeResponse, Step } from '@snap/shared'
import {
  analysisPresentation,
  analysisProgressPresentation,
  analysisRecoveryPresentation,
  cameraPresentation,
  cameraPermissionPresentation,
  stepCardPresentation,
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
      ...base,
      steps: [
        { index: 0, latex: '∫x eˣ dx', plain: 'integral of x times eˣ', yBandTopPct: 10, yBandBottomPct: 20, verdict: 'ok' },
        { index: 1, latex: '= xeˣ − ∫xeˣ dx', plain: 'equals x eˣ minus integral of x eˣ', yBandTopPct: 20, yBandBottomPct: 30, verdict: 'wrong' },
      ],
      errorStepIndex: 1, misconceptionTag: 'integration-by-parts-error', explanation: 'Extra x.',
      followUp: { problem: 'Try again.', concept: 'integration by parts', hint: 'Choose u first.' },
    }
    expect(analysisPresentation(response)).toEqual({
      tone: 'error', eyebrow: 'INTEGRATION BY PARTS ERROR', headline: 'The first break is in step two.', detail: 'Extra x.',
    })
  })

  it('softens verifier disagreement', () => {
    const response: AnalysisResponse = {
      ...base,
      steps: [
        { index: 0, latex: 'x + 1', plain: 'x plus 1', yBandTopPct: 10, yBandBottomPct: 20, verdict: 'ok' },
        { index: 2, latex: 'x − 1', plain: 'x minus 1', yBandTopPct: 20, yBandBottomPct: 30, verdict: 'suspect' },
      ],
      verifierAgreed: false, errorStepIndex: 2, misconceptionTag: 'other', explanation: 'Check this transition.',
      followUp: { problem: 'Try again.', concept: 'review', hint: 'Check each step.' },
    }
    expect(analysisPresentation(response)).toMatchObject({ tone: 'neutral', headline: 'Step three needs a second look.' })
  })
})

describe('analysis progress presentation', () => {
  it('shows the initial honest description without duplicating the screen announcement', () => {
    expect(analysisProgressPresentation(0, 0)).toEqual({
      description: 'Looking at the photo…',
      elapsedCopy: 'Usually takes less than a minute.',
      announcement: null,
    })
  })

  it('keeps rotating descriptions silent between meaningful elapsed boundaries', () => {
    expect(analysisProgressPresentation(19, 2)).toEqual({
      description: 'Preparing your explanation…',
      elapsedCopy: 'Usually takes less than a minute.',
      announcement: null,
    })
  })

  it('provides long-wait copy without progress announcements', () => {
    expect(analysisProgressPresentation(20, 1)).toEqual({
      description: 'Checking the math…',
      elapsedCopy: 'Still working. This can take a little longer.',
      announcement: null,
    })
    expect(analysisProgressPresentation(60, 2)).toEqual({
      description: 'Preparing your explanation…',
      elapsedCopy: 'Still working. You can cancel and return to your review.',
      announcement: null,
    })
  })

  it.each([
    [{ kind: 'network' }, ['retry', 'review']],
    [{ kind: 'timeout' }, ['retry', 'review']],
    [{ kind: 'server', status: 503 }, ['retry', 'review']],
    [{ kind: 'invalid-response', status: 200 }, ['retry', 'review']],
    [{ kind: 'not-math' }, ['review']],
    [{ kind: 'unreadable', tips: ['Use better light.'] }, ['review']],
  ] as const)('keeps the reviewed photo available for %o', (input, actions) => {
    expect(analysisRecoveryPresentation(input).actions).toEqual(actions)
  })

  it('uses specific recovery copy for network, timeout, server, and invalid responses', () => {
    expect(analysisRecoveryPresentation({ kind: 'network' })).toMatchObject({ title: 'We couldn’t reach the tutor.' })
    expect(analysisRecoveryPresentation({ kind: 'timeout' })).toMatchObject({ title: 'The tutor took too long to respond.' })
    expect(analysisRecoveryPresentation({ kind: 'server', status: 503 })).toMatchObject({ title: 'The tutor is unavailable right now.' })
    expect(analysisRecoveryPresentation({ kind: 'invalid-response', status: 200 })).toMatchObject({ title: 'We received an incomplete analysis.' })
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

describe('stepCardPresentation', () => {
  const diagnosed: Step = {
    index: 4,
    verdict: 'wrong',
    plain: 'Move the x outside the integral.',
    latex: 'x \\int e^x dx',
    yBandTopPct: 40,
    yBandBottomPct: 50,
  }
  const correct: Step = { ...diagnosed, index: 6, verdict: 'ok' }
  const downstream: Step = { ...diagnosed, index: 9, verdict: 'downstream' }
  const noDetail: Step = {
    index: 12,
    verdict: 'ok',
    plain: 'Simplify.',
    latex: '\\text{Simplify.}',
    yBandTopPct: 70,
    yBandBottomPct: 80,
  }

  it('hides a diagnosed card’s math and diagnosis from collapsed UI and accessibility', () => {
    expect(stepCardPresentation(diagnosed, {
      expanded: false, selected: true, misconceptionLabel: 'Integration by parts error', explanation: 'The extra x stays inside the integral.',
    })).toEqual({
      math: null,
      misconceptionLabel: null,
      explanation: null,
      accessibilityLabel: 'Step 5, incorrect. Work: Move the x outside the integral.',
      accessibilityState: { expanded: false, selected: true },
      accessibilityHint: 'Double tap to expand this step.',
      accessibilityAction: { name: 'expand', label: 'Expand step' },
    })
  })

  it('shows a diagnosed card’s visible secondary math and diagnosis when expanded', () => {
    expect(stepCardPresentation(diagnosed, {
      expanded: true, selected: true, misconceptionLabel: 'Integration by parts error', explanation: 'The extra x stays inside the integral.',
    })).toEqual({
      math: 'x ∫ eˣ dx',
      misconceptionLabel: 'Integration by parts error',
      explanation: 'The extra x stays inside the integral.',
      accessibilityLabel: 'Step 5, incorrect. Work: Move the x outside the integral. Math: x ∫ eˣ dx. Misconception: Integration by parts error. Explanation: The extra x stays inside the integral.',
      accessibilityState: { expanded: true, selected: true },
      accessibilityHint: 'Double tap to collapse this step.',
      accessibilityAction: { name: 'collapse', label: 'Collapse step' },
    })
  })

  it.each([
    ['correct', correct, 'correct'],
    ['downstream', downstream, 'downstream from the first issue'],
  ] as const)('hides and reveals meaningful math for a %s step', (_name, step, verdict) => {
    const collapsed = stepCardPresentation(step, { expanded: false, selected: false, misconceptionLabel: null, explanation: null })
    const expanded = stepCardPresentation(step, { expanded: true, selected: false, misconceptionLabel: null, explanation: null })

    expect(collapsed.math).toBeNull()
    expect(collapsed.accessibilityLabel).toBe(`Step ${step.index + 1}, ${verdict}. Work: Move the x outside the integral.`)
    expect(collapsed.accessibilityState).toEqual({ expanded: false, selected: false })
    expect(expanded.math).toBe('x ∫ eˣ dx')
    expect(expanded.accessibilityLabel).toContain('Math: x ∫ eˣ dx.')
    expect(expanded.accessibilityState).toEqual({ expanded: true, selected: false })
  })

  it('does not advertise expansion for a card with no meaningful secondary content', () => {
    expect(stepCardPresentation(noDetail, { expanded: true, selected: true, misconceptionLabel: null, explanation: null })).toEqual({
      math: null,
      misconceptionLabel: null,
      explanation: null,
      accessibilityLabel: 'Step 13, correct. Work: Simplify.',
      accessibilityState: { selected: true },
      accessibilityHint: null,
      accessibilityAction: null,
    })
  })
})

describe('trendPresentation', () => {
  it.each([
    ['fewer', { label: 'Improving', color: colors.success, symbol: '↗' }],
    ['more', { label: 'Needs attention', color: colors.error, symbol: '↘' }],
    ['same', { label: 'Steady', color: colors.muted, symbol: '→' }],
    ['not-enough-data', { label: 'Need more evidence', color: colors.muted, symbol: '…' }],
  ] as const)('maps %s without decorative color', (trend, expected) => {
    expect(trendPresentation(trend)).toEqual(expected)
  })
})
