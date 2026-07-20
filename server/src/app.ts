import Fastify, { type FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'
import sharp from 'sharp'
import type { AnalyzeResponse } from '@snap/shared'
import { ModelJsonError } from './llm/client.js'

export type RunAnalysisFn = (image: { base64: string; mediaType: 'image/jpeg' }) => Promise<AnalyzeResponse>

export function buildApp(deps: { runAnalysis: RunAnalysisFn; logger?: boolean }): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false, bodyLimit: 15 * 1024 * 1024 })
  app.register(multipart, { limits: { fileSize: 15 * 1024 * 1024, files: 1 } })

  app.get('/health', async () => ({ ok: true }))

  app.post('/analyze', async (req, reply) => {
    const file = typeof req.file === 'function' ? await req.file() : undefined
    if (!file) return reply.code(400).send({ error: 'no file' })
    try {
      const raw = await file.toBuffer()
      const jpeg = await sharp(raw)
        .rotate() // honor EXIF orientation from phone cameras
        .resize({ width: 1568, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()
      return await deps.runAnalysis({ base64: jpeg.toString('base64'), mediaType: 'image/jpeg' })
    } catch (err) {
      if (err instanceof ModelJsonError) return reply.code(502).send({ error: 'analysis-failed' })
      req.log?.error?.(err)
      return reply.code(500).send({ error: 'internal' })
    }
  })

  return app
}
