import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { createOpenAIClient } from './openai-client.js'
import { makeRunCorrection } from './pipeline/correction.js'
import { makeRunAnalysis } from './pipeline/run.js'

const config = loadConfig()
const client = createOpenAIClient(config.openaiApiKey)
const runAnalysis = makeRunAnalysis(client, config, undefined, (timing) => {
  console.log(JSON.stringify({ event: 'pipeline-stage', ...timing }))
})
const runCorrection = makeRunCorrection(client, config)
const app = buildApp({ runAnalysis, runCorrection, logger: true })
app.listen({ port: config.port, host: '0.0.0.0' }).then(() => {
  console.log(`snap-a-mistake server on :${config.port}`)
})
