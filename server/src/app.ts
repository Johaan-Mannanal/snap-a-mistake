import Fastify, { type FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'
import sharp from 'sharp'
import { CorrectionContextSchema, type AnalyzeResponse } from '@snap/shared'
import { ModelJsonError } from './llm/client.js'
import type { RunCorrectionFn } from './pipeline/correction.js'

export type RunAnalysisFn = (image: { base64: string; mediaType: 'image/jpeg' }) => Promise<AnalyzeResponse>

export type BuildAppDeps = {
  runAnalysis: RunAnalysisFn
  runCorrection: RunCorrectionFn
  logger?: boolean
}

function hasMultipartBoundary(contentType: string | undefined): boolean {
  return typeof contentType === 'string' && /;\s*boundary=(?:"[^"]+"|[^;\s]+)/i.test(contentType)
}

async function normalizeJpeg(raw: Buffer): Promise<{ base64: string; mediaType: 'image/jpeg' }> {
  const jpeg = await sharp(raw)
    .rotate() // honor EXIF orientation from phone cameras
    .resize({ width: 1568, withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
  return { base64: jpeg.toString('base64'), mediaType: 'image/jpeg' }
}

export function buildApp(deps: BuildAppDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false, bodyLimit: 15 * 1024 * 1024 })
  app.register(multipart, {
    limits: { fileSize: 15 * 1024 * 1024, files: 1, fields: 1, fieldSize: 64 * 1024, parts: 2 },
  })

  app.get('/health', async () => ({ ok: true }))

  app.post('/analyze', async (req, reply) => {
    try {
      if (!req.isMultipart() || !hasMultipartBoundary(req.headers['content-type'])) {
        return reply.code(400).send({ error: 'no file' })
      }
      const file = await req.file()
      if (!file) return reply.code(400).send({ error: 'no file' })
      return await deps.runAnalysis(await normalizeJpeg(await file.toBuffer()))
    } catch (err) {
      if (err instanceof ModelJsonError) return reply.code(502).send({ error: 'analysis-failed' })
      return reply.code(500).send({ error: 'internal' })
    }
  })

  app.post('/correct-diagnosis', async (req, reply) => {
    try {
      if (!req.isMultipart() || !hasMultipartBoundary(req.headers['content-type']))
        return reply.code(400).send({ error: 'invalid correction request' })

      let photo: Buffer | undefined
      let contextJson: string | undefined
      let invalid = false
      for await (const part of req.parts()) {
        if (part.type === 'file') {
          if (part.fieldname !== 'photo' || photo !== undefined) {
            invalid = true
            await part.toBuffer()
          } else {
            photo = await part.toBuffer()
          }
        } else if (part.fieldname !== 'context' || contextJson !== undefined || part.valueTruncated) {
          invalid = true
        } else {
          contextJson = String(part.value)
        }
      }
      if (invalid || !photo || !contextJson)
        return reply.code(400).send({ error: 'invalid correction request' })

      let parsedContext: unknown
      try {
        parsedContext = JSON.parse(contextJson)
      } catch {
        return reply.code(400).send({ error: 'invalid correction request' })
      }
      const context = CorrectionContextSchema.safeParse(parsedContext)
      if (!context.success) return reply.code(400).send({ error: 'invalid correction request' })

      return await deps.runCorrection(await normalizeJpeg(photo), context.data)
    } catch (err) {
      if (err instanceof ModelJsonError) return reply.code(502).send({ error: 'analysis-failed' })
      if (
        err instanceof app.multipartErrors.PartsLimitError
        || err instanceof app.multipartErrors.FilesLimitError
        || err instanceof app.multipartErrors.FieldsLimitError
        || err instanceof app.multipartErrors.RequestFileTooLargeError
      ) return reply.code(400).send({ error: 'invalid correction request' })
      return reply.code(500).send({ error: 'internal' })
    }
  })

  return app
}
