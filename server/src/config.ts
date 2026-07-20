import 'dotenv/config'

export type Config = {
  port: number
  openaiApiKey: string
  models: { vision: string; analysis: string; verifier: string }
  legibilityThreshold: number
}

export function loadConfig(): Config {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY is required')
  return {
    port: Number(process.env.PORT ?? 3000),
    openaiApiKey: key,
    models: {
      vision: 'gpt-5.6-sol',
      analysis: 'gpt-5.6-sol',
      verifier: 'gpt-5.6-luna',
    },
    legibilityThreshold: 0.4,
  }
}
