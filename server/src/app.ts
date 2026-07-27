import Fastify, { type FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'
import { Busboy } from '@fastify/busboy'
import sharp from 'sharp'
import {
  AlternateFollowUpContextSchema,
  FollowUpSchema,
  CorrectionContextSchema,
  type AnalyzeResponse,
} from '@snap/shared'
import { ModelJsonError } from './llm/client.js'
import type { RunCorrectionFn } from './pipeline/correction.js'
import type { GenerateFollowUpFn } from './pipeline/followup.js'

export type AnalysisOptions = { allowUncertainTranscript?: boolean }

export type RunAnalysisFn = (
  image: { base64: string; mediaType: 'image/jpeg' },
  options?: AnalysisOptions,
) => Promise<AnalyzeResponse>

export type BuildAppDeps = {
  runAnalysis: RunAnalysisFn
  runCorrection: RunCorrectionFn
  generateFollowUp: GenerateFollowUpFn
  logger?: boolean
}

const MULTIPART_LIMITS = {
  fileSize: 15 * 1024 * 1024,
  files: 1,
  fields: 1,
  fieldSize: 64 * 1024,
  parts: 2,
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

async function parseAnalyzeMultipart(raw: NodeJS.ReadableStream, contentType: string): Promise<{
  photo: Buffer | undefined
  allowUncertainTranscript: boolean
  invalid: boolean
}> {
  return await new Promise((resolve) => {
    const parser = new Busboy({
      headers: { 'content-type': contentType },
      limits: MULTIPART_LIMITS,
    })
    let photo: Buffer | undefined
    let photoSeen = false
    let allowUncertainTranscript = false
    let overrideSeen = false
    let invalid = false
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true
      resolve({ photo, allowUncertainTranscript, invalid })
    }

    parser.on('file', (fieldname, file) => {
      const isPhoto = fieldname === 'photo' && !photoSeen
      if (!isPhoto) invalid = true
      else photoSeen = true

      const chunks: Buffer[] = []
      file.on('error', () => { invalid = true })
      file.on('limit', () => { invalid = true })
      file.on('data', (chunk: Buffer) => {
        if (isPhoto) chunks.push(chunk)
      })
      file.on('end', () => {
        if (isPhoto && !file.truncated) photo = Buffer.concat(chunks)
      })
      file.resume()
    })
    parser.on('field', (fieldname, value, fieldnameTruncated, valueTruncated) => {
      if (
        fieldname !== 'allowUncertainTranscript'
        || fieldnameTruncated
        || overrideSeen
        || valueTruncated
        || value !== 'true'
      ) {
        invalid = true
      } else {
        overrideSeen = true
        allowUncertainTranscript = true
      }
    })
    parser.on('partsLimit', () => { invalid = true })
    parser.on('filesLimit', () => { invalid = true })
    parser.on('fieldsLimit', () => { invalid = true })
    parser.on('error', () => { invalid = true })
    parser.on('finish', finish)
    parser.on('close', finish)
    raw.on('error', () => { invalid = true })
    raw.pipe(parser)
  })
}

export function buildApp(deps: BuildAppDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false, bodyLimit: 15 * 1024 * 1024 })
  app.register(multipart, { limits: MULTIPART_LIMITS })

  app.get('/health', async () => ({ ok: true }))

  app.post('/follow-up', async (req, reply) => {
    const context = AlternateFollowUpContextSchema.safeParse(req.body)
    if (!context.success) return reply.code(400).send({ error: 'invalid follow-up request' })
    try {
      const followUp = FollowUpSchema.safeParse(await deps.generateFollowUp(context.data))
      if (!followUp.success) return reply.code(502).send({ error: 'follow-up-failed' })
      return followUp.data
    } catch (err) {
      if (err instanceof ModelJsonError) return reply.code(502).send({ error: 'follow-up-failed' })
      return reply.code(500).send({ error: 'internal' })
    }
  })

  app.post('/analyze', async (req, reply) => {
    try {
      const contentType = req.headers['content-type']
      if (!req.isMultipart() || typeof contentType !== 'string' || !hasMultipartBoundary(contentType))
        return reply.code(400).send({ error: 'invalid analysis request' })

      const { photo, allowUncertainTranscript, invalid } = await parseAnalyzeMultipart(
        req.raw,
        contentType,
      )
      if (invalid || !photo) return reply.code(400).send({ error: 'invalid analysis request' })

      return await deps.runAnalysis(await normalizeJpeg(photo), { allowUncertainTranscript })
    } catch (err) {
      if (err instanceof ModelJsonError) return reply.code(502).send({ error: 'analysis-failed' })
      if (
        err instanceof app.multipartErrors.PartsLimitError
        || err instanceof app.multipartErrors.FilesLimitError
        || err instanceof app.multipartErrors.FieldsLimitError
        || err instanceof app.multipartErrors.RequestFileTooLargeError
        || err instanceof app.multipartErrors.PrototypeViolationError
        || (typeof err === 'object' && err !== null && 'code' in err && err.code === 'FST_INVALID_JSON_FIELD_ERROR')
      ) return reply.code(400).send({ error: 'invalid analysis request' })
      return reply.code(500).send({ error: 'internal' })
    }
  })

  app.post('/correct-diagnosis', async (req, reply) => {
    try {
      if (!req.isMultipart() || !hasMultipartBoundary(req.headers['content-type']))
        return reply.code(400).send({ error: 'invalid correction request' })

      let photo: Buffer | undefined
      let contextValue: unknown
      let invalid = false
      for await (const part of req.parts()) {
        if (part.type === 'file') {
          if (part.fieldname !== 'photo' || photo !== undefined) {
            invalid = true
            await part.toBuffer()
          } else {
            photo = await part.toBuffer()
          }
        } else if (part.fieldname !== 'context' || contextValue !== undefined || part.valueTruncated) {
          invalid = true
        } else {
          contextValue = part.value
        }
      }
      if (invalid || !photo || contextValue === undefined)
        return reply.code(400).send({ error: 'invalid correction request' })

      let parsedContext: unknown
      if (typeof contextValue === 'string') {
        try {
          parsedContext = JSON.parse(contextValue)
        } catch {
          return reply.code(400).send({ error: 'invalid correction request' })
        }
      } else {
        parsedContext = contextValue
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
        || err instanceof app.multipartErrors.PrototypeViolationError
        // @fastify/multipart's type declaration omits InvalidJSONFieldError.
        || (typeof err === 'object' && err !== null && 'code' in err && err.code === 'FST_INVALID_JSON_FIELD_ERROR')
      ) return reply.code(400).send({ error: 'invalid correction request' })
      return reply.code(500).send({ error: 'internal' })
    }
  })

  return app
}
