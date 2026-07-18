import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'

describe('GET /health', () => {
  it('returns ok', async () => {
    const app = buildApp({ runAnalysis: async () => ({ kind: 'not-math' }) })
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })
})
