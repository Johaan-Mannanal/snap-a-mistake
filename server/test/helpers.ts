import { vi } from 'vitest'
import type OpenAI from 'openai'

export function fakeClient(...texts: string[]): OpenAI {
  const create = vi.fn()
  for (const t of texts) create.mockResolvedValueOnce({ choices: [{ message: { content: t } }] })
  return { chat: { completions: { create } } } as unknown as OpenAI
}
