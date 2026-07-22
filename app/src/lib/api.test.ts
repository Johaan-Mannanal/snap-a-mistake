import { describe, expect, it, vi } from 'vitest'
import { ApiError, analyzePhoto } from './api'

vi.mock('expo-file-system', () => ({
  File: class MockFile extends Blob {
    readonly uri: string

    constructor(uri: string) {
      super([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
      this.uri = uri
    }
  },
}))

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response
const bad = (status: number) => ({ ok: false, status, json: async () => ({ error: 'x' }) }) as Response

const analysis = {
  kind: 'analysis', steps: [], errorStepIndex: null, misconceptionTag: null,
  explanation: null, followUp: null, verifierAgreed: true,
}

describe('analyzePhoto', () => {
  it('POSTs multipart and returns the parsed response', async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok(analysis))
    const r = await analyzePhoto('file:///photo.jpg', fetchFn)
    expect(r.kind).toBe('analysis')
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/analyze')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
  })
  it('uploads a byte-backed photo part instead of a legacy URI descriptor', async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok(analysis))
    await analyzePhoto('file:///photo.jpg', fetchFn)

    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    const photo = (init.body as FormData).get('photo')
    expect(photo).toBeInstanceOf(Blob)
    expect((photo as File).name).toBe('photo.jpg')
  })
  it('maps non-2xx to ApiError{server,status}', async () => {
    const fetchFn = vi.fn().mockResolvedValue(bad(502))
    await expect(analyzePhoto('file:///p.jpg', fetchFn)).rejects.toMatchObject({ failure: { kind: 'server', status: 502 } })
  })
  it('maps a contract-violating body to ApiError{server}', async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok({ kind: 'nonsense' }))
    await expect(analyzePhoto('file:///p.jpg', fetchFn)).rejects.toMatchObject({ failure: { kind: 'server', status: 200 } })
  })
  it('maps thrown fetch errors to ApiError{network}', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Network request failed'))
    await expect(analyzePhoto('file:///p.jpg', fetchFn)).rejects.toMatchObject({ failure: { kind: 'network' } })
  })
  it('allows multi-stage analysis past 35 seconds, then aborts at 180 seconds', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
        const requestSignal = init?.signal as AbortSignal
        return new Promise<Response>((_resolve, reject) => {
          requestSignal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
        })
      })
      const pending = analyzePhoto('file:///slow-math.jpg', fetchMock as typeof fetch).catch((error) => error)
      const signal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal

      await vi.advanceTimersByTimeAsync(35_000)
      expect(signal.aborted).toBe(false)

      await vi.advanceTimersByTimeAsync(145_000)
      await expect(pending).resolves.toMatchObject({ failure: { kind: 'network' } })
    } finally {
      vi.useRealTimers()
    }
  })
})
