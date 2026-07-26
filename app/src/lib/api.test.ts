import { describe, expect, it, vi } from 'vitest'
import { analyzePhoto, correctDiagnosis, requestAlternateFollowUp } from './api'

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
    const r = await analyzePhoto('file:///photo.jpg', { fetchFn })
    expect(r.kind).toBe('analysis')
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/analyze')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
  })
  it('accepts a complete response whose steps have no photo bands', async () => {
    const unlocated = {
      kind: 'analysis',
      steps: [{ index: 41, latex: 'x^2', plain: 'x²', verdict: 'ok' }],
      errorStepIndex: null,
      misconceptionTag: null,
      explanation: null,
      followUp: null,
      verifierAgreed: true,
    }
    const fetchFn = vi.fn().mockResolvedValue(ok(unlocated))

    await expect(analyzePhoto('file:///photo.jpg', { fetchFn })).resolves.toEqual(unlocated)
  })
  it('uploads a byte-backed photo part instead of a legacy URI descriptor', async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok(analysis))
    await analyzePhoto('file:///photo.jpg', { fetchFn })

    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    const photo = (init.body as FormData).get('photo')
    expect(photo).toBeInstanceOf(Blob)
    expect((photo as File).name).toBe('photo.jpg')
  })
  it('maps non-2xx to ApiError{server,status}', async () => {
    const fetchFn = vi.fn().mockResolvedValue(bad(502))
    await expect(analyzePhoto('file:///p.jpg', { fetchFn })).rejects.toMatchObject({ failure: { kind: 'server', status: 502 } })
  })
  it('maps a contract-violating body to ApiError{invalid-response,status}', async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok({ kind: 'nonsense' }))
    await expect(analyzePhoto('file:///p.jpg', { fetchFn })).rejects.toMatchObject({ failure: { kind: 'invalid-response', status: 200 } })
  })
  it('maps thrown fetch errors to ApiError{network}', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Network request failed'))
    await expect(analyzePhoto('file:///p.jpg', { fetchFn })).rejects.toMatchObject({ failure: { kind: 'network' } })
  })
  it('classifies an aborted caller request as cancelled', async () => {
    const controller = new AbortController()
    const fetchFn = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      ;(init?.signal as AbortSignal).addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    }))

    const pending = analyzePhoto('file:///p.jpg', { fetchFn: fetchFn as typeof fetch, signal: controller.signal })
    controller.abort()

    await expect(pending).rejects.toMatchObject({ failure: { kind: 'cancelled' } })
  })
  it('allows analysis past 35 seconds, then reports the 180-second timeout', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
        const requestSignal = init?.signal as AbortSignal
        return new Promise<Response>((_resolve, reject) => {
          requestSignal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
        })
      })
      const pending = analyzePhoto('file:///slow-math.jpg', { fetchFn: fetchMock as typeof fetch }).catch((error) => error)
      const signal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal

      await vi.advanceTimersByTimeAsync(35_000)
      expect(signal.aborted).toBe(false)

      await vi.advanceTimersByTimeAsync(145_000)
      await expect(pending).resolves.toMatchObject({ failure: { kind: 'timeout' } })
    } finally {
      vi.useRealTimers()
    }
  })
  it('keeps timeout as the failure when it aborts before the caller does', async () => {
    vi.useFakeTimers()
    try {
      const caller = new AbortController()
      const fetchFn = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        ;(init?.signal as AbortSignal).addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      }))
      const pending = analyzePhoto('file:///p.jpg', { fetchFn: fetchFn as typeof fetch, signal: caller.signal }).catch((error) => error)

      vi.advanceTimersByTime(180_000)
      caller.abort()

      await expect(pending).resolves.toMatchObject({ failure: { kind: 'timeout' } })
    } finally {
      vi.useRealTimers()
    }
  })
  it('keeps caller cancellation as the failure when it aborts before the timeout', async () => {
    vi.useFakeTimers()
    try {
      const caller = new AbortController()
      const fetchFn = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        ;(init?.signal as AbortSignal).addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      }))
      const pending = analyzePhoto('file:///p.jpg', { fetchFn: fetchFn as typeof fetch, signal: caller.signal }).catch((error) => error)

      caller.abort()
      vi.advanceTimersByTime(180_000)

      await expect(pending).resolves.toMatchObject({ failure: { kind: 'cancelled' } })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('correctDiagnosis', () => {
  const diagnosis = {
    kind: 'analysis' as const,
    steps: [{ index: 2, latex: 'x = 4', plain: 'x equals 4', yBandTopPct: 30, yBandBottomPct: 40, verdict: 'wrong' as const }],
    errorStepIndex: 2,
    misconceptionTag: 'sign-error' as const,
    explanation: 'The negative sign was lost.',
    followUp: { problem: 'Simplify −(x + 2).', concept: 'signs', hint: 'Distribute the negative.' },
    verifierAgreed: true,
  }

  it('POSTs the exact active analysis and selected step as multipart context', async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok(diagnosis))
    await correctDiagnosis('file:///photo.jpg', { analysis: diagnosis, selectedStepIndex: 2 }, { fetchFn })

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/correct-diagnosis')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('context')).toBe(JSON.stringify({ analysis: diagnosis, selectedStepIndex: 2 }))
    expect((init.body as FormData).get('photo')).toBeInstanceOf(Blob)
  })

  it('uses the same deterministic cancellation and invalid-response failures as analysis', async () => {
    const caller = new AbortController()
    const fetchFn = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      ;(init?.signal as AbortSignal).addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    }))
    const pending = correctDiagnosis('file:///photo.jpg', { analysis: diagnosis, selectedStepIndex: 2 }, {
      fetchFn: fetchFn as typeof fetch,
      signal: caller.signal,
    })
    caller.abort()
    await expect(pending).rejects.toMatchObject({ failure: { kind: 'cancelled' } })
    await expect(correctDiagnosis('file:///photo.jpg', { analysis: diagnosis, selectedStepIndex: 2 }, {
      fetchFn: vi.fn().mockResolvedValue(ok({ kind: 'bad' })) as typeof fetch,
    })).rejects.toMatchObject({ failure: { kind: 'invalid-response', status: 200 } })
  })
})

describe('requestAlternateFollowUp', () => {
  const context = {
    concept: 'sign distribution',
    diagnosis: 'You lost the negative sign.',
    previousProblems: ['Simplify −(x + 2).'],
  }
  const followUp = { problem: 'Simplify −(3x − 4).', concept: 'sign distribution', hint: 'Apply the negative sign to each term.' }

  it('posts the shared context and parses a shared follow-up response', async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok(followUp))

    await expect(requestAlternateFollowUp(context, { fetchFn })).resolves.toEqual(followUp)
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/follow-up')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'content-type': 'application/json' })
    expect(init.body).toBe(JSON.stringify(context))
  })

  it('uses the same cancellation and invalid-response failures as diagnosis requests', async () => {
    const controller = new AbortController()
    const fetchFn = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      ;(init?.signal as AbortSignal).addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    }))
    const pending = requestAlternateFollowUp(context, { fetchFn: fetchFn as typeof fetch, signal: controller.signal })
    controller.abort()

    await expect(pending).rejects.toMatchObject({ failure: { kind: 'cancelled' } })
    await expect(requestAlternateFollowUp(context, { fetchFn: vi.fn().mockResolvedValue(ok({ problem: '', concept: '', hint: '' })) as typeof fetch }))
      .rejects.toMatchObject({ failure: { kind: 'invalid-response', status: 200 } })
  })
})
