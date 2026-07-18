import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { ClaudeJsonError, callClaudeJson } from '../src/claude/client.js'
import { fakeClient } from './helpers.js'

const schema = z.object({ n: z.number() })
const opts = { model: 'm', system: 's', content: [{ type: 'text' as const, text: 'hi' }], schema }

describe('callClaudeJson', () => {
  it('parses valid JSON on first try', async () => {
    const client = fakeClient('{"n": 4}')
    expect(await callClaudeJson({ client, ...opts })).toEqual({ n: 4 })
  })
  it('strips markdown code fences', async () => {
    const client = fakeClient('```json\n{"n": 7}\n```')
    expect(await callClaudeJson({ client, ...opts })).toEqual({ n: 7 })
  })
  it('retries once with the validation error, then succeeds', async () => {
    const client = fakeClient('{"n": "not a number"}', '{"n": 2}')
    expect(await callClaudeJson({ client, ...opts })).toEqual({ n: 2 })
    expect((client.messages.create as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2)
  })
  it('throws ClaudeJsonError after two failures', async () => {
    const client = fakeClient('garbage', 'more garbage')
    await expect(callClaudeJson({ client, ...opts })).rejects.toThrow(ClaudeJsonError)
  })
})
