import type { AnalyzeResponse, CorrectionContext, FollowUp } from '@snap/shared'
import type { BuildAppDeps } from '../src/app.js'

export const MOCK_MODES = [
  'correct',
  'error',
  'suspect',
  'unreadable',
  'not-math',
  'timeout',
  'server-error',
  'correction',
  'alternate-follow-up',
] as const
export type MockMode = (typeof MOCK_MODES)[number]

export const MOCK_ANALYSIS_DELAY_MS = 4_000
export const MOCK_TIMEOUT_DELAY_MS = 181_000

type AnalysisMode = Exclude<MockMode, 'timeout' | 'server-error'>

const steps = (verdicts: Array<'ok' | 'wrong' | 'suspect' | 'downstream'>) =>
  verdicts.map((verdict, index) => ({
    index,
    latex: ['\\int x e^x\\,dx', '= x e^x - \\int e^x\\,dx \\cdot x', '= x e^x - x e^x', '= 0'][index] ?? `step_{${index}}`,
    plain: [
      'integral of x times e to the x, dx',
      'x e to the x minus the integral of e to the x, dx, times x',
      'x e to the x minus x e to the x',
      'equals zero',
    ][index] ?? `step ${index}`,
    yBandTopPct: 8 + index * 20,
    yBandBottomPct: 24 + index * 20,
    verdict,
  }))

const correct: AnalyzeResponse = {
  kind: 'analysis',
  steps: steps(['ok', 'ok', 'ok', 'ok']),
  errorStepIndex: null,
  misconceptionTag: null,
  explanation: null,
  followUp: null,
  verifierAgreed: true,
}

const error: AnalyzeResponse = {
  kind: 'analysis',
  steps: steps(['ok', 'wrong', 'downstream', 'downstream']),
  errorStepIndex: 1,
  misconceptionTag: 'integration-by-parts-error',
  explanation: 'You kept x inside the remaining integral. Integration by parts uses ∫u dv = uv − ∫v du, and du is dx, so that extra x changes every later line.',
  followUp: {
    problem: 'Evaluate ∫ x eˣ dx with u = x and dv = eˣ dx.',
    concept: 'integration by parts',
    hint: 'Choose u before differentiating.',
  },
  verifierAgreed: true,
}

const suspect: AnalyzeResponse = {
  kind: 'analysis',
  steps: steps(['ok', 'suspect', 'downstream', 'downstream']),
  errorStepIndex: 1,
  misconceptionTag: 'integration-by-parts-error',
  explanation: 'Step 2 may have kept an extra factor of x inside the remaining integral.',
  followUp: {
    problem: 'Evaluate ∫ x eˣ dx with u = x and dv = eˣ dx.',
    concept: 'integration by parts',
    hint: 'Differentiate u and integrate dv.',
  },
  verifierAgreed: false,
}

const unreadable: AnalyzeResponse = {
  kind: 'unreadable',
  tips: ['Get more light on the page', 'Flatten the page and shoot from directly above', 'Fit one problem in the frame'],
}

const notMath: AnalyzeResponse = { kind: 'not-math' }

const analysisFixtures: Record<AnalysisMode, AnalyzeResponse> = {
  correct,
  error,
  suspect,
  unreadable,
  'not-math': notMath,
  correction: error,
  'alternate-follow-up': error,
}

const correctedDiagnosis: Omit<AnalyzeResponse & { kind: 'analysis' }, 'steps'> = {
  kind: 'analysis',
  errorStepIndex: 1,
  misconceptionTag: 'algebraic-slip',
  explanation: 'You combined unlike terms as though they were the same quantity.',
  followUp: {
    problem: 'Simplify 2x + 3 + 4x.',
    concept: 'like terms',
    hint: 'Combine only matching variable terms.',
  },
  verifierAgreed: true,
}

const alternateFollowUp: FollowUp = {
  problem: 'Evaluate ∫ 2x eˣ dx with u = 2x, dv = eˣ dx.',
  concept: 'integration by parts',
  hint: 'Differentiate u once, then integrate dv.',
}

const regularFollowUp: FollowUp = {
  problem: 'Simplify 3x + 5x.',
  concept: 'like terms',
  hint: 'Combine the coefficients of matching variable terms.',
}

function pause(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

export function isMockMode(value: string | undefined): value is MockMode {
  return value !== undefined && (MOCK_MODES as readonly string[]).includes(value)
}

export function getMockAnalysisResponse(mode: AnalysisMode): AnalyzeResponse {
  return analysisFixtures[mode]
}

export function createMockDeps(
  mode: MockMode,
  options: { analysisDelayMs?: number; timeoutDelayMs?: number } = {},
): BuildAppDeps {
  const analysisDelayMs = options.analysisDelayMs ?? MOCK_ANALYSIS_DELAY_MS
  const timeoutDelayMs = options.timeoutDelayMs ?? MOCK_TIMEOUT_DELAY_MS

  return {
    runAnalysis: async () => {
      if (mode === 'timeout') {
        await pause(timeoutDelayMs)
        throw new Error('deterministic mock timeout')
      }
      if (mode === 'server-error') throw new Error('deterministic mock server error')
      await pause(analysisDelayMs)
      return getMockAnalysisResponse(mode)
    },
    runCorrection: async (_image, context: CorrectionContext) => ({
      ...correctedDiagnosis,
      steps: context.analysis.steps.map((step) => ({
        ...step,
        verdict: step.index < context.selectedStepIndex
          ? 'ok'
          : step.index === context.selectedStepIndex ? 'wrong' : 'downstream',
      })),
      errorStepIndex: context.selectedStepIndex,
    }),
    generateFollowUp: async (context) => mode === 'alternate-follow-up'
      ? { ...alternateFollowUp, concept: context.concept }
      : { ...regularFollowUp, concept: context.concept },
  }
}
