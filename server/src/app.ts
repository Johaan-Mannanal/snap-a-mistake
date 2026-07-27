import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import multipart from '@fastify/multipart'
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

const MIME_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/
const MULTIPART_BOUNDARY = /^[0-9A-Za-z'()+_,\-./:=?](?:[0-9A-Za-z'()+_,\-./:=? ]{0,68}[0-9A-Za-z'()+_,\-./:=?])?$/
const MAX_ANALYZE_BODY_SIZE = MULTIPART_LIMITS.fileSize + MULTIPART_LIMITS.fieldSize + (128 * 1024)

function parseParameterizedHeader(value: string): {
  value: string
  parameters: Map<string, string>
} | null {
  const separator = value.indexOf(';')
  const baseValue = (separator === -1 ? value : value.slice(0, separator)).trim()
  if (baseValue.length === 0) return null

  const parameters = new Map<string, string>()
  let cursor = separator === -1 ? value.length : separator
  while (cursor < value.length) {
    if (value[cursor] !== ';') return null
    cursor += 1
    while (value[cursor] === ' ' || value[cursor] === '\t') cursor += 1

    const nameStart = cursor
    while (
      cursor < value.length
      && value[cursor] !== '='
      && value[cursor] !== ';'
      && value[cursor] !== ' '
      && value[cursor] !== '\t'
    ) cursor += 1
    const name = value.slice(nameStart, cursor).toLowerCase()
    if (!MIME_TOKEN.test(name)) return null
    while (value[cursor] === ' ' || value[cursor] === '\t') cursor += 1
    if (value[cursor] !== '=') return null
    cursor += 1
    while (value[cursor] === ' ' || value[cursor] === '\t') cursor += 1

    let parameterValue = ''
    if (value[cursor] === '"') {
      cursor += 1
      let closed = false
      while (cursor < value.length) {
        const character = value[cursor]!
        if (character === '"') {
          cursor += 1
          closed = true
          break
        }
        if (character === '\\') {
          cursor += 1
          if (cursor >= value.length) return null
        }
        const decoded = value[cursor]!
        if (decoded.charCodeAt(0) < 0x20 && decoded !== '\t') return null
        parameterValue += decoded
        cursor += 1
      }
      if (!closed) return null
      while (value[cursor] === ' ' || value[cursor] === '\t') cursor += 1
      if (cursor < value.length && value[cursor] !== ';') return null
    } else {
      const valueStart = cursor
      while (cursor < value.length && value[cursor] !== ';') cursor += 1
      parameterValue = value.slice(valueStart, cursor).trim()
      if (!MIME_TOKEN.test(parameterValue)) return null
    }

    if (parameters.has(name)) return null
    parameters.set(name, parameterValue)
  }
  return { value: baseValue, parameters }
}

function validMultipartBoundary(contentType: string | undefined): string | null {
  if (typeof contentType !== 'string') return null
  const parsed = parseParameterizedHeader(contentType)
  if (parsed?.value.toLowerCase() !== 'multipart/form-data') return null
  const boundary = parsed.parameters.get('boundary')
  return boundary !== undefined && MULTIPART_BOUNDARY.test(boundary) ? boundary : null
}

async function normalizeJpeg(raw: Buffer): Promise<{ base64: string; mediaType: 'image/jpeg' }> {
  const jpeg = await sharp(raw)
    .rotate() // honor EXIF orientation from phone cameras
    .resize({ width: 1568, withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
  return { base64: jpeg.toString('base64'), mediaType: 'image/jpeg' }
}

async function readAnalyzeMultipartBody(raw: FastifyRequest['raw']): Promise<Buffer | null> {
  return await new Promise((resolve) => {
    const chunks: Buffer[] = []
    let size = 0
    let settled = false
    const cleanup = () => {
      raw.off('data', onData)
      raw.off('end', onEnd)
      raw.off('aborted', onInvalid)
      raw.off('error', onInvalid)
      raw.off('close', onInvalid)
      raw.unpipe()
    }
    const finish = (body: Buffer | null, drain = false) => {
      if (settled) return
      settled = true
      cleanup()
      if (drain && !raw.destroyed) raw.resume()
      resolve(body)
    }
    const onData = (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += bytes.length
      if (size > MAX_ANALYZE_BODY_SIZE) {
        finish(null, true)
        return
      }
      chunks.push(bytes)
    }
    const onEnd = () => finish(Buffer.concat(chunks))
    const onInvalid = () => finish(null, true)
    raw.on('data', onData)
    raw.on('end', onEnd)
    raw.on('aborted', onInvalid)
    raw.on('error', onInvalid)
    raw.on('close', onInvalid)
  })
}

function parseMultipartHeaders(bytes: Buffer): Map<string, string> | null {
  for (const byte of bytes) {
    if (byte !== 9 && byte !== 10 && byte !== 13 && (byte < 32 || byte > 126)) return null
  }
  const headers = new Map<string, string>()
  for (const line of bytes.toString('ascii').split('\r\n')) {
    const separator = line.indexOf(':')
    if (separator <= 0) return null
    const name = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()
    if (!MIME_TOKEN.test(name) || value.length === 0 || headers.has(name)) return null
    headers.set(name, value)
  }
  return headers
}

function nextMultipartBoundary(body: Buffer, marker: Buffer, from: number): number {
  let candidate = body.indexOf(marker, from)
  while (candidate !== -1) {
    const suffix = candidate + marker.length
    if (
      body.subarray(suffix, suffix + 2).equals(Buffer.from('\r\n'))
      || body.subarray(suffix, suffix + 2).equals(Buffer.from('--'))
    ) return candidate
    candidate = body.indexOf(marker, candidate + 1)
  }
  return -1
}

async function parseAnalyzeMultipart(raw: FastifyRequest['raw'], boundary: string): Promise<{
  photo: Buffer | undefined
  allowUncertainTranscript: boolean
  invalid: boolean
}> {
  const body = await readAnalyzeMultipartBody(raw)
  if (body === null) {
    return { photo: undefined, allowUncertainTranscript: false, invalid: true }
  }

  let photo: Buffer | undefined
  let photoSeen = false
  let allowUncertainTranscript = false
  let overrideSeen = false
  let invalid = false
  let fileCount = 0
  let fieldCount = 0
  let partCount = 0
  const delimiter = Buffer.from(`--${boundary}`)
  const marker = Buffer.from(`\r\n--${boundary}`)
  const lineBreak = Buffer.from('\r\n')
  const headerTerminator = Buffer.from('\r\n\r\n')
  let cursor = delimiter.length
  if (!body.subarray(0, delimiter.length).equals(delimiter))
    return { photo, allowUncertainTranscript, invalid: true }

  while (true) {
    if (body.subarray(cursor, cursor + 2).equals(Buffer.from('--'))) {
      cursor += 2
      const trailer = body.subarray(cursor)
      const complete = trailer.length === 0 || trailer.equals(lineBreak)
      return { photo, allowUncertainTranscript, invalid: invalid || !complete }
    }
    if (!body.subarray(cursor, cursor + 2).equals(lineBreak))
      return { photo, allowUncertainTranscript, invalid: true }
    cursor += 2

    const headerEnd = body.indexOf(headerTerminator, cursor)
    if (headerEnd === -1 || headerEnd - cursor > 16 * 1024)
      return { photo, allowUncertainTranscript, invalid: true }
    const headers = parseMultipartHeaders(body.subarray(cursor, headerEnd))
    if (headers === null) return { photo, allowUncertainTranscript, invalid: true }
    const dispositionValue = headers.get('content-disposition')
    const disposition = dispositionValue === undefined
      ? null
      : parseParameterizedHeader(dispositionValue)
    if (
      disposition?.value.toLowerCase() !== 'form-data'
      || !disposition.parameters.has('name')
      || [...disposition.parameters.keys()].some((name) => name !== 'name' && name !== 'filename')
    ) return { photo, allowUncertainTranscript, invalid: true }

    const dataStart = headerEnd + headerTerminator.length
    const boundaryStart = nextMultipartBoundary(body, marker, dataStart)
    if (boundaryStart === -1) return { photo, allowUncertainTranscript, invalid: true }
    const value = body.subarray(dataStart, boundaryStart)
    partCount += 1
    if (partCount > MULTIPART_LIMITS.parts) invalid = true

    const fieldname = disposition.parameters.get('name')!
    const isFile = disposition.parameters.has('filename') || headers.has('content-type')
    if (isFile) {
      fileCount += 1
      const isPhoto = fieldname === 'photo' && !photoSeen
      if (!isPhoto || fileCount > MULTIPART_LIMITS.files || value.length > MULTIPART_LIMITS.fileSize) {
        invalid = true
      } else {
        photoSeen = true
        photo = value
      }
    } else {
      fieldCount += 1
      if (
        fieldname !== 'allowUncertainTranscript'
        || overrideSeen
        || fieldCount > MULTIPART_LIMITS.fields
        || value.length > MULTIPART_LIMITS.fieldSize
        || !value.equals(Buffer.from('true'))
      ) {
        invalid = true
      } else {
        overrideSeen = true
        allowUncertainTranscript = true
      }
    }

    cursor = boundaryStart + 2 + delimiter.length
  }
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
      const boundary = validMultipartBoundary(contentType)
      if (!req.isMultipart() || boundary === null)
        return reply.code(400).send({ error: 'invalid analysis request' })

      const { photo, allowUncertainTranscript, invalid } = await parseAnalyzeMultipart(
        req.raw,
        boundary,
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
      if (!req.isMultipart() || validMultipartBoundary(req.headers['content-type']) === null)
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
