import { describe, expect, it, vi } from 'vitest'
import type OpenAI from 'openai'
import type { TranscribedStep } from '@snap/shared'
import { analyzeSteps } from '../src/pipeline/stage2.js'
import { fakeClient } from './helpers.js'

const steps: TranscribedStep[] = [
  { index: 0, latex: '\\int x e^x dx', plain: 'integral of x e^x', yBandTopPct: 0, yBandBottomPct: 20 },
  { index: 1, latex: '= x e^x - e^x x', plain: 'x e^x minus e^x times x', yBandTopPct: 20, yBandBottomPct: 40 },
]

const diagnosis = JSON.stringify({
  errorStepIndex: 1, misconceptionTag: 'integration-by-parts-error',
  explanation: 'You differentiated both factors.', followUp: { problem: '∫x·2 dx', concept: 'parts' },
})

describe('analyzeSteps', () => {
  it('serializes steps into the prompt and parses the diagnosis', async () => {
    const client = fakeClient(diagnosis)
    const r = await analyzeSteps(client, 'gpt-5.6-sol', steps)
    expect(r.errorStepIndex).toBe(1)
    expect(r.misconceptionTag).toBe('integration-by-parts-error')
    const call = (client.chat.completions.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as OpenAI.Chat.Completions.ChatCompletionCreateParams
    const text = JSON.stringify(call.messages)
    expect(text).toContain('x e^x - e^x x') // steps actually reached the prompt
    expect(text).toMatch(/notation-error: written symbols change mathematical meaning/i)
    expect(text).toMatch(/harmless notation quirks.*not errors/i)
    expect(text).toMatch(/formula-misapplied:.*known formula.*not.*algebraic-slip/i)
    expect(text).toMatch(/algebraic-slip:.*routine arithmetic or algebraic manipulation/i)
  })

  it('orders overlapping tags and documents their classification boundaries', async () => {
    const client = fakeClient(diagnosis)
    await analyzeSteps(client, 'gpt-5.6-sol', steps)
    const call = (client.chat.completions.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as OpenAI.Chat.Completions.ChatCompletionCreateParams
    const text = JSON.stringify(call.messages)

    const decisionOrder = [
      '1. method-specific rule',
      '2. formula-misapplied',
      '3. sign-error',
      '4. notation-error',
      '5. equals-abuse',
      '6. algebraic-slip',
    ]
    let previousIndex = -1
    for (const category of decisionOrder) {
      const index = text.toLowerCase().indexOf(category)
      expect(index).toBeGreaterThan(previousIndex)
      previousIndex = index
    }

    expect(text).toContain('choose the FIRST applicable category')
    expect(text).toContain('10. other (last resort only)')
    expect(text).toMatch(/inverse-function notation.*reciprocal.*notation-error/i)
    expect(text).toMatch(/incorrect log-ratio recombination.*correct integration.*algebraic-slip/i)
    expect(text).toMatch(/replacing the established cosine term.*final integration-by-parts answer.*integration-by-parts-error/i)
    expect(text).toMatch(/isolated n\+1 to n-1.*sign-error/i)
    expect(text).toMatch(/reordered adjugate template.*formula-misapplied.*not equals-abuse/i)
  })
})
