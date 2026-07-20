import { describe, expect, it, vi } from 'vitest'
import type OpenAI from 'openai'
import { transcribe } from '../src/pipeline/stage1.js'
import { fakeClient } from './helpers.js'

const good = JSON.stringify({
  isMath: true, legibility: 0.85,
  steps: [{ index: 0, latex: '\\int x e^x dx', plain: 'integral of x e^x dx', yBandTopPct: 5, yBandBottomPct: 18 }],
})

describe('transcribe', () => {
  it('sends the image part and returns a parsed Stage1Result', async () => {
    const client = fakeClient(good)
    const r = await transcribe(client, 'gpt-5.6-sol', { base64: 'AAAA', mediaType: 'image/jpeg' })
    expect(r.isMath).toBe(true)
    expect(r.steps[0]?.latex).toContain('int')
    const call = (client.chat.completions.create as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as OpenAI.Chat.Completions.ChatCompletionCreateParams
    const userMsg = call.messages.find((m) => m.role === 'user')
    const parts = userMsg?.content as Array<{ type: string; image_url?: { url: string } }>
    expect(parts.some((p) => p.type === 'image_url' && p.image_url?.url.startsWith('data:image/jpeg;base64,'))).toBe(true)
    expect(call.messages.find((m) => m.role === 'system')).toBeTruthy()
    expect(call.model).toBe('gpt-5.6-sol')
  })
})
