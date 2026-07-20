import { describe, expect, it } from 'vitest'
import type { TranscribedStep } from '@snap/shared'
import { verifyDiagnosis } from '../src/pipeline/verifier.js'
import { fakeClient } from './helpers.js'

const steps: TranscribedStep[] = [
  { index: 0, latex: '2x = 6', plain: 'two x equals six', yBandTopPct: 0, yBandBottomPct: 50 },
  { index: 1, latex: 'x = 3', plain: 'x equals three', yBandTopPct: 50, yBandBottomPct: 100 },
]

describe('verifyDiagnosis', () => {
  it('returns disagreement when the auditor rejects the claim', async () => {
    const client = fakeClient(JSON.stringify({ agrees: false, note: 'step 1 is valid: 6/2 = 3' }))
    const r = await verifyDiagnosis(client, 'gpt-5.6-luna', steps, {
      errorStepIndex: 1, explanation: 'Division mistake',
    })
    expect(r.agrees).toBe(false)
  })
})
