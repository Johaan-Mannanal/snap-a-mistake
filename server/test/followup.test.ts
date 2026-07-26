import { describe, expect, it, vi } from 'vitest'
import type OpenAI from 'openai'
import { generateFollowUp } from '../src/pipeline/followup.js'
import { fakeClient } from './helpers.js'

const response = JSON.stringify({
  problem: 'Evaluate ∫ x eˣ dx.',
  concept: 'integration by parts',
  hint: 'Choose u so differentiating it simplifies the product.',
})

describe('generateFollowUp', () => {
  it('requests a distinct problem and progressive hint', async () => {
    const client = fakeClient(response)

    await generateFollowUp(client, 'gpt-5.6-sol', {
      concept: 'integration by parts',
      diagnosis: 'The remaining integral kept an extra x.',
      previousProblems: ['Evaluate ∫ x² eˣ dx.'],
    })

    const call = (client.chat.completions.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as OpenAI.Chat.Completions.ChatCompletionCreateParams
    const text = JSON.stringify(call.messages)
    expect(text).toMatch(/must differ/i)
    expect(text).toMatch(/one hint/i)
    expect(text).toMatch(/previous problems/i)
    expect(text).toMatch(/same concept/i)
    expect(text).toMatch(/Unicode.*no raw LaTeX/i)
  })

  it('retries when a generated follow-up contains raw LaTeX', async () => {
    const client = fakeClient(
      JSON.stringify({ problem: 'Evaluate \\int x e^x dx.', concept: 'integration by parts', hint: 'Set u = x.' }),
      response,
    )

    const result = await generateFollowUp(client, 'gpt-5.6-sol', {
      concept: 'integration by parts',
      diagnosis: 'The remaining integral kept an extra x.',
      previousProblems: ['Evaluate ∫ x² eˣ dx.'],
    })

    expect(result.problem).toBe('Evaluate ∫ x eˣ dx.')
    expect(client.chat.completions.create).toHaveBeenCalledTimes(2)
  })

  it('retries when the model repeats a previous problem', async () => {
    const client = fakeClient(
      JSON.stringify({
        problem: 'Evaluate ∫ x eˣ dx.',
        concept: 'integration by parts',
        hint: 'Choose u = x.',
      }),
      JSON.stringify({
        problem: 'Evaluate ∫ 2x eˣ dx.',
        concept: 'integration by parts',
        hint: 'Choose u = 2x.',
      }),
    )

    const result = await generateFollowUp(client, 'gpt-5.6-sol', {
      concept: 'integration by parts',
      diagnosis: 'The remaining integral kept an extra x.',
      previousProblems: ['Evaluate ∫ x eˣ dx.'],
    })

    expect(result.problem).toBe('Evaluate ∫ 2x eˣ dx.')
    expect(client.chat.completions.create).toHaveBeenCalledTimes(2)
  })

  it('returns the requested concept identity when model casing and whitespace vary', async () => {
    const client = fakeClient(JSON.stringify({
      problem: 'Evaluate ∫ 2x eˣ dx.',
      concept: '  Integration   By Parts ',
      hint: 'Choose u before differentiating.',
    }))

    const result = await generateFollowUp(client, 'gpt-5.6-sol', {
      concept: 'integration by parts',
      diagnosis: 'The remaining integral kept an extra x.',
      previousProblems: ['Evaluate ∫ x eˣ dx.'],
    })

    expect(result.concept).toBe('integration by parts')
    expect(client.chat.completions.create).toHaveBeenCalledOnce()
  })

  it('retries when the model changes to a genuinely different concept', async () => {
    const client = fakeClient(
      JSON.stringify({
        problem: 'Evaluate ∫ 2x eˣ dx.',
        concept: 'u-substitution',
        hint: 'Choose an inner expression.',
      }),
      JSON.stringify({
        problem: 'Evaluate ∫ 2x eˣ dx.',
        concept: 'Integration by Parts',
        hint: 'Choose u before differentiating.',
      }),
    )

    const result = await generateFollowUp(client, 'gpt-5.6-sol', {
      concept: 'integration by parts',
      diagnosis: 'The remaining integral kept an extra x.',
      previousProblems: ['Evaluate ∫ x eˣ dx.'],
    })

    expect(result.concept).toBe('integration by parts')
    expect(client.chat.completions.create).toHaveBeenCalledTimes(2)
  })
})
