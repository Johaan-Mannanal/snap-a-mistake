import { createRequire } from 'module'
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { buildApp } from '../src/app.js'
import { ClaudeJsonError } from '../src/claude/client.js'

const formAutoContent = createRequire(import.meta.url)('form-auto-content')

describe('GET /health', () => {
  it('returns ok', async () => {
    const app = buildApp({ runAnalysis: async () => ({ kind: 'not-math' }) })
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })
})

async function tinyJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .jpeg().toBuffer()
}

describe('POST /analyze', () => {
  it('returns the pipeline result for an uploaded photo', async () => {
    let received = ''
    const app = buildApp({
      runAnalysis: async (img) => {
        received = img.mediaType
        return { kind: 'unreadable', tips: ['more light'] }
      },
    })
    const form = formAutoContent({ photo: await tinyJpeg() })
    const res = await app.inject({ method: 'POST', url: '/analyze', ...form })
    expect(res.statusCode).toBe(200)
    expect(res.json().kind).toBe('unreadable')
    expect(received).toBe('image/jpeg')
  })
  it('400s with no file', async () => {
    const app = buildApp({ runAnalysis: async () => ({ kind: 'not-math' }) })
    const res = await app.inject({ method: 'POST', url: '/analyze', payload: {} })
    expect(res.statusCode).toBeGreaterThanOrEqual(400)
    expect(res.statusCode).toBeLessThan(500)
  })
  it('502s on ClaudeJsonError', async () => {
    const app = buildApp({ runAnalysis: async () => { throw new ClaudeJsonError('bad') } })
    const form = formAutoContent({ photo: await tinyJpeg() })
    const res = await app.inject({ method: 'POST', url: '/analyze', ...form })
    expect(res.statusCode).toBe(502)
    expect(res.json()).toEqual({ error: 'analysis-failed' })
  })
  it('500s with {error:"internal"} on a corrupt image', async () => {
    const app = buildApp({ runAnalysis: async () => ({ kind: 'not-math' }) })
    const form = formAutoContent({ photo: Buffer.from('not a real jpeg') })
    const res = await app.inject({ method: 'POST', url: '/analyze', ...form })
    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({ error: 'internal' })
  })
})
