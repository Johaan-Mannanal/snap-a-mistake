import 'dotenv/config'

export type Config = {
  port: number
  anthropicApiKey: string
  models: { vision: string; analysis: string; verifier: string }
  legibilityThreshold: number
}

export function loadConfig(): Config {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is required')
  return {
    port: Number(process.env.PORT ?? 3000),
    anthropicApiKey: key,
    models: {
      vision: 'claude-sonnet-5',
      analysis: 'claude-sonnet-5',
      verifier: 'claude-haiku-4-5-20251001',
    },
    legibilityThreshold: 0.4,
  }
}
