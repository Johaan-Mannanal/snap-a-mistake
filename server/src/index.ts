import Anthropic from '@anthropic-ai/sdk'
import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { makeRunAnalysis } from './pipeline/run.js'

const config = loadConfig()
const client = new Anthropic({ apiKey: config.anthropicApiKey, timeout: 30_000, maxRetries: 1 })
const app = buildApp({ runAnalysis: makeRunAnalysis(client, config), logger: true })
app.listen({ port: config.port, host: '0.0.0.0' }).then(() => {
  console.log(`snap-a-mistake server on :${config.port}`)
})
