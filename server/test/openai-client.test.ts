import { describe, expect, it } from 'vitest'
import { createOpenAIClient } from '../src/openai-client.js'

describe('createOpenAIClient', () => {
  it('allows one bounded 90-second model attempt without automatic retries', () => {
    const client = createOpenAIClient('test-key')

    expect(client.timeout).toBe(90_000)
    expect(client.maxRetries).toBe(0)
  })
})
