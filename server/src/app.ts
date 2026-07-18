import Fastify, { type FastifyInstance } from 'fastify'
import type { AnalyzeResponse } from '@snap/shared'

export type RunAnalysisFn = (image: { base64: string; mediaType: 'image/jpeg' }) => Promise<AnalyzeResponse>

export function buildApp(deps: { runAnalysis: RunAnalysisFn }): FastifyInstance {
  const app = Fastify({ logger: false })
  app.get('/health', async () => ({ ok: true }))
  void deps // /analyze route registered in a later task
  return app
}
