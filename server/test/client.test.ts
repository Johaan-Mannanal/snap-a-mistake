import type OpenAI from 'openai'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { ModelJsonError, callModelJson } from '../src/llm/client.js'
import { fakeClient } from './helpers.js'

const schema = z.object({ n: z.number() })
const opts = { model: 'm', system: 's', content: [{ type: 'text' as const, text: 'hi' }], schema }

describe('callModelJson', () => {
  it('parses valid JSON on first try', async () => {
    const client = fakeClient('{"n": 4}')
    expect(await callModelJson({ client, ...opts })).toEqual({ n: 4 })
  })
  it('strips markdown code fences', async () => {
    const client = fakeClient('```json\n{"n": 7}\n```')
    expect(await callModelJson({ client, ...opts })).toEqual({ n: 7 })
  })
  it('retries once with the validation error, then succeeds', async () => {
    const client = fakeClient('{"n": "not a number"}', '{"n": 2}')
    expect(await callModelJson({ client, ...opts })).toEqual({ n: 2 })
    expect((client.chat.completions.create as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2)
  })
  it('throws ModelJsonError after two failures', async () => {
    const client = fakeClient('garbage', 'more garbage')
    await expect(callModelJson({ client, ...opts })).rejects.toThrow(ModelJsonError)
  })
  it('propagates transport errors without retrying', async () => {
    const create = vi.fn().mockRejectedValueOnce(Object.assign(new Error('connection refused'), { status: 529 }))
    const client = { chat: { completions: { create } } } as unknown as OpenAI
    await expect(callModelJson({ client, ...opts })).rejects.toThrow('connection refused')
    expect(create).toHaveBeenCalledTimes(1)
  })
})
