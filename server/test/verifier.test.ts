import { describe, expect, it, vi } from 'vitest'
import type { TranscribedStep } from '@snap/shared'
import type OpenAI from 'openai'
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

  it('identifies a sparse diagnosis with its opaque step ID', async () => {
    const sparseSteps = [
      { ...steps[0]!, index: 41 },
      { ...steps[1]!, index: 7 },
    ]
    const client = fakeClient(JSON.stringify({ agrees: true, note: 'The selected step is invalid.' }))

    await verifyDiagnosis(client, 'gpt-5.6-luna', sparseSteps, {
      errorStepIndex: 7,
      explanation: 'Division mistake',
    })

    const call = (client.chat.completions.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as OpenAI.Chat.Completions.ChatCompletionCreateParams
    const text = JSON.stringify(call.messages)
    expect(text).toContain('Step ID 41:')
    expect(text).toContain('Step ID 7:')
    expect(text).toContain('Claimed first error: step ID 7')
  })
})
