import { describe, expect, it, vi } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { transcribe } from '../src/pipeline/stage1.js'
import { fakeClient } from './helpers.js'

const good = JSON.stringify({
  isMath: true, legibility: 0.85,
  steps: [{ index: 0, latex: '\\int x e^x dx', plain: 'integral of x e^x dx', yBandTopPct: 5, yBandBottomPct: 18 }],
})

describe('transcribe', () => {
  it('sends the image block and returns a parsed Stage1Result', async () => {
    const client = fakeClient(good)
    const r = await transcribe(client, 'claude-sonnet-5', { base64: 'AAAA', mediaType: 'image/jpeg' })
    expect(r.isMath).toBe(true)
    expect(r.steps[0]?.latex).toContain('int')
    const call = (client.messages.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Anthropic.Messages.MessageCreateParams
    const blocks = call.messages[0]?.content as Array<Anthropic.Messages.TextBlockParam | Anthropic.Messages.ImageBlockParam | Anthropic.Messages.ToolUseBlockParam | Anthropic.Messages.ToolResultBlockParam>
    expect(blocks.some((b) => b.type === 'image')).toBe(true)
    expect(call.model).toBe('claude-sonnet-5')
  })
})
