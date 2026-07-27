import { describe, expect, it, vi } from 'vitest'
import type OpenAI from 'openai'
import { verifyTranscription } from '../src/pipeline/transcription-verifier.js'
import { fakeClient } from './helpers.js'

describe('verifyTranscription', () => {
  it('compares the proposed transcript with the original image conservatively', async () => {
    const client = fakeClient(JSON.stringify({
      faithful: false,
      legible: false,
      note: 'The fourth line is too blurry to verify.',
    }))

    const result = await verifyTranscription(
      client,
      'gpt-5.6-sol',
      { base64: 'AAAA', mediaType: 'image/jpeg' },
      [{
        index: 4,
        latex: 'x e^x - \\int e^x dx',
        plain: 'x e to the x minus integral e to the x dx',
      }],
    )

    expect(result).toMatchObject({ faithful: false, legible: false })
    const call = (client.chat.completions.create as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as OpenAI.Chat.Completions.ChatCompletionCreateParams
    const user = call.messages.find((message) => message.role === 'user')
    const parts = user?.content as Array<{ type: string; text?: string }>
    expect(parts.some((part) => part.type === 'image_url')).toBe(true)
    expect(parts.some((part) => part.text?.includes('x e^x'))).toBe(true)
    const system = call.messages.find((message) => message.role === 'system')?.content
    expect(system).toMatch(/do not repair|do not infer/i)
    expect(system).toMatch(/uncertain.*false/i)
  })
})
