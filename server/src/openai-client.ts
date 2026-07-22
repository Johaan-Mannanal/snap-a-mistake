import OpenAI from 'openai'

export const OPENAI_TIMEOUT_MS = 90_000
export const OPENAI_MAX_RETRIES = 0

export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    timeout: OPENAI_TIMEOUT_MS,
    maxRetries: OPENAI_MAX_RETRIES,
  })
}
