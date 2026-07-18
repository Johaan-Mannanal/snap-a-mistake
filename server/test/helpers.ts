import { vi } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'

export function fakeClient(...texts: string[]): Anthropic {
  const create = vi.fn()
  for (const t of texts) create.mockResolvedValueOnce({ content: [{ type: 'text', text: t }] })
  return { messages: { create } } as unknown as Anthropic
}
