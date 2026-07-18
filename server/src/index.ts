import { buildApp } from './app.js'
import { loadConfig } from './config.js'

const config = loadConfig()
const app = buildApp({ runAnalysis: async () => ({ kind: 'not-math' }) }) // real pipeline wired in Task 9
app.listen({ port: config.port, host: '0.0.0.0' }).then(() => {
  console.log(`snap-a-mistake server on :${config.port}`)
})
