import { createRequire } from 'module'
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import type { AlternateFollowUpContext, AnalyzeResponse, CorrectionContext, FollowUp } from '@snap/shared'
import { buildApp, type BuildAppDeps } from '../src/app.js'
import { ModelJsonError } from '../src/llm/client.js'

const formAutoContent = createRequire(import.meta.url)('form-auto-content')

const correctionContext: CorrectionContext = {
  analysis: {
    kind: 'analysis' as const,
    steps: [0, 1, 2].map((index) => ({
      index, latex: `L${index}`, plain: `P${index}`,
      yBandTopPct: index * 10, yBandBottomPct: index * 10 + 9,
      verdict: 'ok' as const,
    })),
    errorStepIndex: null,
    misconceptionTag: null,
    explanation: null,
    followUp: null,
    verifierAgreed: true,
  },
  selectedStepIndex: 2,
}

function correctedResponse(context: CorrectionContext): AnalyzeResponse {
  return {
    ...context.analysis,
    errorStepIndex: context.selectedStepIndex,
    misconceptionTag: 'algebraic-slip',
    explanation: 'You combined unlike terms as if they were the same quantity.',
    followUp: { problem: 'Simplify 2x + 3 + 4x.', concept: 'like terms', hint: 'Combine only matching variable terms.' },
    verifierAgreed: true,
  }
}

function appDeps(overrides: Partial<BuildAppDeps> = {}): BuildAppDeps {
  return {
    runAnalysis: async () => ({ kind: 'not-math' }),
    runCorrection: async (_image, context) => correctedResponse(context),
    generateFollowUp: async () => ({
      problem: 'Simplify 2x + 5x.', concept: 'like terms', hint: 'Combine matching variable terms.',
    }),
    ...overrides,
  }
}

function jsonField(value: string) {
  return { value, options: { contentType: 'application/json' } }
}

describe('GET /health', () => {
  it('returns ok', async () => {
    const app = buildApp(appDeps())
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })
})

describe('POST /follow-up', () => {
  const context: AlternateFollowUpContext = {
    concept: 'like terms',
    diagnosis: 'You combined unlike terms.',
    previousProblems: ['Simplify 2x + 3 + 4x.'],
  }

  it('returns a schema-validated alternate follow-up', async () => {
    let received: AlternateFollowUpContext | undefined
    const app = buildApp(appDeps({
      generateFollowUp: async (value): Promise<FollowUp> => {
        received = value
        return { problem: 'Simplify 3x + 5x.', concept: 'like terms', hint: 'Add the coefficients of x.' }
      },
    }))

    const response = await app.inject({ method: 'POST', url: '/follow-up', payload: context })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ problem: 'Simplify 3x + 5x.', concept: 'like terms', hint: 'Add the coefficients of x.' })
    expect(received).toEqual(context)
  })

  it('rejects invalid follow-up context before invoking the model', async () => {
    let called = false
    const app = buildApp(appDeps({ generateFollowUp: async () => { called = true; throw new Error('unexpected') } }))

    const response = await app.inject({ method: 'POST', url: '/follow-up', payload: { concept: '', diagnosis: 'x', previousProblems: [] } })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'invalid follow-up request' })
    expect(called).toBe(false)
  })

  it('returns 502 for follow-up model JSON failures', async () => {
    const app = buildApp(appDeps({ generateFollowUp: async () => { throw new ModelJsonError('bad') } }))

    const response = await app.inject({ method: 'POST', url: '/follow-up', payload: context })

    expect(response.statusCode).toBe(502)
    expect(response.json()).toEqual({ error: 'follow-up-failed' })
  })

  it('returns 502 when the generated follow-up violates the shared response schema', async () => {
    const app = buildApp(appDeps({
      generateFollowUp: async () => ({ problem: 'Evaluate x^2.', concept: 'powers', hint: 'Use the power rule.' }) as FollowUp,
    }))

    const response = await app.inject({ method: 'POST', url: '/follow-up', payload: context })

    expect(response.statusCode).toBe(502)
    expect(response.json()).toEqual({ error: 'follow-up-failed' })
  })
})

async function tinyJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .jpeg().toBuffer()
}

describe('POST /analyze', () => {
  it('returns the pipeline result for an uploaded photo', async () => {
    let received = ''
    const app = buildApp(appDeps({
      runAnalysis: async (img) => {
        received = img.mediaType
        return { kind: 'unreadable', tips: ['more light'] }
      },
    }))
    const form = formAutoContent({ photo: await tinyJpeg() })
    const res = await app.inject({ method: 'POST', url: '/analyze', ...form })
    expect(res.statusCode).toBe(200)
    expect(res.json().kind).toBe('unreadable')
    expect(received).toBe('image/jpeg')
  })
  it('returns the API error contract for a non-multipart request', async () => {
    const app = buildApp(appDeps())
    const res = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: 'not multipart',
      headers: { 'content-type': 'text/plain' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'no file' })
  })
  it('returns the API error contract for multipart data without a boundary', async () => {
    const app = buildApp(appDeps())
    const res = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: 'malformed multipart',
      headers: { 'content-type': 'multipart/form-data' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'no file' })
  })
  it('502s on ModelJsonError', async () => {
    const app = buildApp(appDeps({ runAnalysis: async () => { throw new ModelJsonError('bad') } }))
    const form = formAutoContent({ photo: await tinyJpeg() })
    const res = await app.inject({ method: 'POST', url: '/analyze', ...form })
    expect(res.statusCode).toBe(502)
    expect(res.json()).toEqual({ error: 'analysis-failed' })
  })
  it('500s with {error:"internal"} on a corrupt image', async () => {
    const app = buildApp(appDeps())
    const form = formAutoContent({ photo: Buffer.from('not a real jpeg') })
    const res = await app.inject({ method: 'POST', url: '/analyze', ...form })
    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({ error: 'internal' })
  })
})

describe('POST /correct-diagnosis', () => {
  it('returns the correction pipeline result for a photo and valid context', async () => {
    let receivedSelectedStep: number | undefined
    const app = buildApp(appDeps({
      runCorrection: async (_image, context) => {
        receivedSelectedStep = context.selectedStepIndex
        return correctedResponse(context)
      },
    }))
    const form = formAutoContent({ photo: await tinyJpeg(), context: JSON.stringify(correctionContext) })

    const response = await app.inject({ method: 'POST', url: '/correct-diagnosis', ...form })

    expect(response.statusCode).toBe(200)
    expect(response.json().errorStepIndex).toBe(2)
    expect(receivedSelectedStep).toBe(2)
  })

  it('accepts a valid application/json context field', async () => {
    // Would fail if an already-parsed multipart JSON value were stringified before schema validation.
    const app = buildApp(appDeps())
    const form = formAutoContent({ photo: await tinyJpeg(), context: jsonField(JSON.stringify(correctionContext)) })

    const response = await app.inject({ method: 'POST', url: '/correct-diagnosis', ...form })

    expect(response.statusCode).toBe(200)
    expect(response.json().errorStepIndex).toBe(2)
  })

  it('rejects a malformed application/json context field', async () => {
    // Would fail if multipart JSON parsing errors leaked as internal server errors.
    const app = buildApp(appDeps())
    const form = formAutoContent({ photo: await tinyJpeg(), context: jsonField('{not json') })

    const response = await app.inject({ method: 'POST', url: '/correct-diagnosis', ...form })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'invalid correction request' })
  })

  it('rejects an oversized application/json context field', async () => {
    // Would fail if field-size JSON parse errors leaked as internal server errors.
    const app = buildApp(appDeps())
    const form = formAutoContent({ photo: await tinyJpeg(), context: jsonField(`{"padding":"${'x'.repeat(64 * 1024)}"}`) })

    const response = await app.inject({ method: 'POST', url: '/correct-diagnosis', ...form })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'invalid correction request' })
  })

  it('rejects a missing or invalid correction context', async () => {
    // Would fail if a request could reach the model without schema-validated context.
    const app = buildApp(appDeps())
    const missing = formAutoContent({ photo: await tinyJpeg() })
    const invalid = formAutoContent({ photo: await tinyJpeg(), context: '{not json' })

    const missingResponse = await app.inject({ method: 'POST', url: '/correct-diagnosis', ...missing })
    const invalidResponse = await app.inject({ method: 'POST', url: '/correct-diagnosis', ...invalid })

    expect(missingResponse.statusCode).toBe(400)
    expect(invalidResponse.statusCode).toBe(400)
  })

  it('rejects extra multipart parts', async () => {
    // Would fail if the endpoint accepted a request other than one photo plus one context field.
    const app = buildApp(appDeps())
    const form = formAutoContent({
      photo: await tinyJpeg(),
      context: JSON.stringify(correctionContext),
      extra: 'not allowed',
    })

    const response = await app.inject({ method: 'POST', url: '/correct-diagnosis', ...form })

    expect(response.statusCode).toBe(400)
  })

  it('rejects a selected step that is absent from the analysis', async () => {
    // Would fail if route validation ignored CorrectionContextSchema's selected-step invariant.
    const app = buildApp(appDeps())
    const invalid = { ...correctionContext, selectedStepIndex: 99 }
    const form = formAutoContent({ photo: await tinyJpeg(), context: JSON.stringify(invalid) })

    const response = await app.inject({ method: 'POST', url: '/correct-diagnosis', ...form })

    expect(response.statusCode).toBe(400)
  })

  it('returns a 502 when diagnosis correction model output is invalid', async () => {
    // Would fail if ModelJsonError from the correction pipeline leaked as a generic server error.
    const app = buildApp(appDeps({ runCorrection: async () => { throw new ModelJsonError('bad') } }))
    const form = formAutoContent({ photo: await tinyJpeg(), context: JSON.stringify(correctionContext) })

    const response = await app.inject({ method: 'POST', url: '/correct-diagnosis', ...form })

    expect(response.statusCode).toBe(502)
    expect(response.json()).toEqual({ error: 'analysis-failed' })
  })
})
