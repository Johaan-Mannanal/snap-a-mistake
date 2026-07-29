import { describe, expect, it } from 'vitest'
import { AnalysisResultSchema, type Stage1Result, type Stage2Result, type VerifierResult } from '@snap/shared'
import type OpenAI from 'openai'
import { ModelJsonError } from '../src/llm/client.js'
import { makeRunAnalysis, type StageTiming } from '../src/pipeline/run.js'
import type { Config } from '../src/config.js'

const client = {} as OpenAI
const config: Config = {
  port: 0, openaiApiKey: 'k', legibilityThreshold: 0.4,
  models: { vision: 'v', analysis: 'a', verifier: 'h' },
}
const image = { base64: 'AAAA', mediaType: 'image/jpeg' as const }

const step = (index: number) => ({
  index, latex: `L${index}`, plain: `P${index}`, yBandTopPct: index * 10, yBandBottomPct: index * 10 + 9,
})
const s1 = (over: Partial<Stage1Result> = {}): Stage1Result =>
  ({ isMath: true, legibility: 0.9, steps: [step(0), step(1), step(2)], ...over })
const errorDiag: Stage2Result = {
  errorStepIndex: 1, misconceptionTag: 'sign-error',
  explanation: 'Sign flipped.', followUp: { problem: 'p', concept: 'c', hint: 'Keep the sign.' },
}
const cleanDiag: Stage2Result = { errorStepIndex: null, misconceptionTag: null, explanation: null, followUp: null }

function run(
  opts: { s1?: Stage1Result; s2?: Stage2Result; v?: VerifierResult },
  options?: { allowUncertainTranscript?: boolean },
) {
  return makeRunAnalysis(client, config, {
    transcribe: async () => opts.s1 ?? s1(),
    verifyTranscription: async () => ({ faithful: true, legible: true, note: '' }),
    analyzeSteps: async () => opts.s2 ?? cleanDiag,
    verifyDiagnosis: async () => opts.v ?? { agrees: true, note: '' },
  })(image, options)
}

describe('runAnalysis', () => {
  it('returns not-math without calling stage 2', async () => {
    expect(await run({ s1: s1({ isMath: false }) })).toEqual({ kind: 'not-math' })
  })
  it('does not force non-math inputs through', async () => {
    let fidelityChecked = false
    const analyze = makeRunAnalysis(client, config, {
      transcribe: async () => s1({ isMath: false }),
      verifyTranscription: async () => {
        fidelityChecked = true
        return { faithful: true, legible: true, note: '' }
      },
      analyzeSteps: async () => errorDiag,
      verifyDiagnosis: async () => ({ agrees: true, note: '' }),
    })

    await expect(analyze(image, { allowUncertainTranscript: true }))
      .resolves.toEqual({ kind: 'not-math' })
    expect(fidelityChecked).toBe(false)
  })
  it('lets the verifier rescue a low-confidence transcript with visible steps', async () => {
    const analyze = makeRunAnalysis(client, config, {
      transcribe: async () => s1({ legibility: 0.3 }),
      verifyTranscription: async () => ({ faithful: true, legible: true, note: '' }),
      analyzeSteps: async () => errorDiag,
      verifyDiagnosis: async () => ({ agrees: true, note: '' }),
    })

    await expect(analyze(image)).resolves.toMatchObject({
      kind: 'analysis',
      errorStepIndex: 1,
    })
  })
  it('continues a nonempty moderate-confidence transcript when the verifier rejects it', async () => {
    let diagnosisCalls = 0
    const analyze = makeRunAnalysis(client, config, {
      transcribe: async () => s1({ legibility: 0.3 }),
      verifyTranscription: async () => ({ faithful: false, legible: false, note: 'blurred' }),
      analyzeSteps: async () => {
        diagnosisCalls += 1
        return errorDiag
      },
      verifyDiagnosis: async () => ({ agrees: true, note: '' }),
    })

    await expect(analyze(image)).resolves.toMatchObject({
      kind: 'analysis',
      errorStepIndex: 1,
    })
    expect(diagnosisCalls).toBe(1)
  })
  it('returns unreadable only when low stage-one confidence and both verifier rejections agree', async () => {
    let diagnosisCalls = 0
    const analyze = makeRunAnalysis(client, config, {
      transcribe: async () => s1({ legibility: 0.15 }),
      verifyTranscription: async () => ({ faithful: false, legible: false, note: 'unusable' }),
      analyzeSteps: async () => {
        diagnosisCalls += 1
        return errorDiag
      },
      verifyDiagnosis: async () => ({ agrees: true, note: '' }),
    })

    await expect(analyze(image)).resolves.toEqual({
      kind: 'unreadable',
      tips: expect.any(Array),
    })
    expect(diagnosisCalls).toBe(0)
  })

  it('continues just above the catastrophic legibility boundary', async () => {
    const analyze = makeRunAnalysis(client, config, {
      transcribe: async () => s1({ legibility: 0.151 }),
      verifyTranscription: async () => ({ faithful: false, legible: false, note: 'uncertain' }),
      analyzeSteps: async () => errorDiag,
      verifyDiagnosis: async () => ({ agrees: true, note: '' }),
    })

    await expect(analyze(image)).resolves.toMatchObject({
      kind: 'analysis',
      errorStepIndex: 1,
    })
  })

  it.each([
    { faithful: true, legible: false },
    { faithful: false, legible: true },
  ])('continues catastrophic-confidence work when one verifier signal passes: %o', async (check) => {
    const analyze = makeRunAnalysis(client, config, {
      transcribe: async () => s1({ legibility: 0.1 }),
      verifyTranscription: async () => ({ ...check, note: 'partially supported' }),
      analyzeSteps: async () => errorDiag,
      verifyDiagnosis: async () => ({ agrees: true, note: '' }),
    })

    await expect(analyze(image)).resolves.toMatchObject({
      kind: 'analysis',
      errorStepIndex: 1,
    })
  })
  it('continues past uncertain transcription only for an explicit override', async () => {
    let fidelityChecked = false
    const analyze = makeRunAnalysis(client, config, {
      transcribe: async () => s1({ legibility: 0.1 }),
      verifyTranscription: async () => {
        fidelityChecked = true
        return { faithful: false, legible: false, note: 'uncertain' }
      },
      analyzeSteps: async () => errorDiag,
      verifyDiagnosis: async () => ({ agrees: true, note: '' }),
    })

    const result = await analyze(image, { allowUncertainTranscript: true })

    expect(result).toMatchObject({
      kind: 'analysis',
      errorStepIndex: 1,
      misconceptionTag: 'sign-error',
    })
    expect(fidelityChecked).toBe(true)
  })
  it('does not force an empty transcript through', async () => {
    let fidelityChecked = false
    const analyze = makeRunAnalysis(client, config, {
      transcribe: async () => s1({ legibility: 0.2, steps: [] }),
      verifyTranscription: async () => {
        fidelityChecked = true
        return { faithful: false, legible: false, note: 'empty' }
      },
      analyzeSteps: async () => cleanDiag,
      verifyDiagnosis: async () => ({ agrees: true, note: '' }),
    })

    await expect(analyze(image, { allowUncertainTranscript: true }))
      .resolves.toMatchObject({ kind: 'unreadable' })
    expect(fidelityChecked).toBe(false)
  })
  it('returns unreadable when no steps were found', async () => {
    const r = await run({ s1: s1({ steps: [] }) })
    expect(r.kind).toBe('unreadable')
  })
  it('continues a high-confidence nonempty transcript despite a verifier reconstruction concern', async () => {
    const analyze = makeRunAnalysis(client, config, {
      transcribe: async () => s1({ legibility: 0.9 }),
      verifyTranscription: async () => ({
        faithful: false,
        legible: false,
        note: 'Step 4 may be reconstructed.',
      }),
      analyzeSteps: async () => cleanDiag,
      verifyDiagnosis: async () => ({ agrees: true, note: '' }),
    })

    await expect(analyze(image)).resolves.toMatchObject({
      kind: 'analysis',
      errorStepIndex: null,
    })
  })
  it('marks all steps ok for correct work', async () => {
    const r = await run({ s2: cleanDiag })
    if (r.kind !== 'analysis') throw new Error('expected analysis')
    expect(r.errorStepIndex).toBeNull()
    expect(r.steps.map((s) => s.verdict)).toEqual(['ok', 'ok', 'ok'])
    expect(r.verifierAgreed).toBe(true)
  })
  it('derives ok/wrong/downstream when verifier agrees', async () => {
    const r = await run({ s2: errorDiag, v: { agrees: true, note: '' } })
    if (r.kind !== 'analysis') throw new Error('expected analysis')
    expect(r.steps.map((s) => s.verdict)).toEqual(['ok', 'wrong', 'downstream'])
    expect(r.misconceptionTag).toBe('sign-error')
  })
  it('derives verdict progression by array order for sparse step indexes', async () => {
    const r = await run({
      s1: s1({ steps: [step(5), step(2), step(9)] }),
      s2: { ...errorDiag, errorStepIndex: 2 },
      v: { agrees: true, note: '' },
    })
    if (r.kind !== 'analysis') throw new Error('expected analysis')
    expect(r.steps.map((s) => s.verdict)).toEqual(['ok', 'wrong', 'downstream'])
    expect(AnalysisResultSchema.safeParse(r).success).toBe(true)
  })
  it('preserves steps when both photo band endpoints are unavailable', async () => {
    const unlocated = { index: 41, latex: 'x^2', plain: 'x²' }
    const r = await run({
      s1: s1({ steps: [unlocated] }),
      s2: cleanDiag,
    })

    expect(r).toMatchObject({
      kind: 'analysis',
      steps: [{ ...unlocated, verdict: 'ok' }],
    })
    expect(AnalysisResultSchema.safeParse(r).success).toBe(true)
  })
  it('softens to suspect when verifier disagrees', async () => {
    const r = await run({ s2: errorDiag, v: { agrees: false, note: 'looks fine' } })
    if (r.kind !== 'analysis') throw new Error('expected analysis')
    expect(r.steps[1]?.verdict).toBe('suspect')
    expect(r.verifierAgreed).toBe(false)
  })
  it('throws ModelJsonError on out-of-range error index', async () => {
    await expect(run({ s2: { ...errorDiag, errorStepIndex: 99 } })).rejects.toThrow(ModelJsonError)
  })
  it('reports completed timings for all three model stages', async () => {
    const timings: StageTiming[] = []
    const analyze = makeRunAnalysis(client, config, {
      transcribe: async () => s1(),
      verifyTranscription: async () => ({ faithful: true, legible: true, note: '' }),
      analyzeSteps: async () => errorDiag,
      verifyDiagnosis: async () => ({ agrees: true, note: '' }),
    }, (timing) => timings.push(timing))

    await analyze(image)

    expect(timings.map(({ stage, status }) => ({ stage, status }))).toEqual([
      { stage: 'transcription', status: 'completed' },
      { stage: 'transcription-verification', status: 'completed' },
      { stage: 'analysis', status: 'completed' },
      { stage: 'verification', status: 'completed' },
    ])
    expect(timings.every(({ durationMs }) => durationMs >= 0)).toBe(true)
  })
  it('reports the model stage that failed', async () => {
    const timings: StageTiming[] = []
    const analyze = makeRunAnalysis(client, config, {
      transcribe: async () => s1(),
      verifyTranscription: async () => ({ faithful: true, legible: true, note: '' }),
      analyzeSteps: async () => { throw new Error('Request timed out.') },
      verifyDiagnosis: async () => ({ agrees: true, note: '' }),
    }, (timing) => timings.push(timing))

    await expect(analyze(image)).rejects.toThrow('Request timed out.')
    expect(timings.map(({ stage, status }) => ({ stage, status }))).toEqual([
      { stage: 'transcription', status: 'completed' },
      { stage: 'transcription-verification', status: 'completed' },
      { stage: 'analysis', status: 'failed' },
    ])
  })
})
