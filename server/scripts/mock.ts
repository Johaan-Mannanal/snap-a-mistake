import type { AnalyzeResponse } from '@snap/shared'
import { buildApp } from '../src/app.js'

const steps = (verdicts: Array<'ok' | 'wrong' | 'suspect' | 'downstream'>) =>
  verdicts.map((verdict, index) => ({
    index,
    latex: ['\\int x e^x\\,dx', '= x e^x - \\int e^x\\,dx \\cdot x', '= x e^x - x e^x', '= 0'][index] ?? `step_{${index}}`,
    plain: [
      'integral of x times e to the x, dx',
      'x e^x minus the integral of e^x dx, times x',
      'x e^x minus x e^x',
      'equals zero',
    ][index] ?? `step ${index}`,
    yBandTopPct: 8 + index * 20,
    yBandBottomPct: 24 + index * 20,
    verdict,
  }))

const FIXTURES: Record<string, AnalyzeResponse> = {
  correct: {
    kind: 'analysis', steps: steps(['ok', 'ok', 'ok', 'ok']), errorStepIndex: null,
    misconceptionTag: null, explanation: null, followUp: null, verifierAgreed: true,
  },
  error: {
    kind: 'analysis', steps: steps(['ok', 'wrong', 'downstream', 'downstream']), errorStepIndex: 1,
    misconceptionTag: 'integration-by-parts-error',
    explanation:
      'You kept the x inside the remaining integral — integration by parts moves it out: ∫u dv = uv − ∫v du, and du is just dx here. That stray x makes every later line collapse to zero.',
    followUp: { problem: 'Use integration by parts to evaluate ∫ x·2ᵈˣ… try the simpler ∫ x eˣ dx again with u = x, dv = eˣ dx.', concept: 'integration by parts' },
    verifierAgreed: true,
  },
  suspect: {
    kind: 'analysis', steps: steps(['ok', 'suspect', 'downstream', 'downstream']), errorStepIndex: 1,
    misconceptionTag: 'integration-by-parts-error',
    explanation: 'Step 2 may have kept an extra factor of x inside the integral.',
    followUp: { problem: 'Evaluate ∫ x eˣ dx with u = x, dv = eˣ dx.', concept: 'integration by parts' },
    verifierAgreed: false,
  },
  unreadable: { kind: 'unreadable', tips: ['Get more light on the page', 'Flatten the page and shoot from directly above', 'Fit just one problem in the frame'] },
  'not-math': { kind: 'not-math' },
}

const pick = process.env.MOCK ?? 'error'
const fixture = FIXTURES[pick]
if (!fixture) throw new Error(`unknown MOCK fixture "${pick}" (valid: ${Object.keys(FIXTURES).join(', ')})`)

const app = buildApp({
  runAnalysis: async () => {
    await new Promise((r) => setTimeout(r, 4000))
    return fixture
  },
  logger: true,
})
app.listen({ port: 3000, host: '0.0.0.0' }).then(() => {
  console.log(`mock server on :3000 serving fixture "${pick}"`)
})
