import { describe, expect, it } from 'vitest'
import type { Stage1Result, Stage2Result, VerifierResult } from '@snap/shared'
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
  explanation: 'Sign flipped.', followUp: { problem: 'p', concept: 'c' },
}
const cleanDiag: Stage2Result = { errorStepIndex: null, misconceptionTag: null, explanation: null, followUp: null }

function run(opts: { s1?: Stage1Result; s2?: Stage2Result; v?: VerifierResult }) {
  return makeRunAnalysis(client, config, {
    transcribe: async () => opts.s1 ?? s1(),
    analyzeSteps: async () => opts.s2 ?? cleanDiag,
    verifyDiagnosis: async () => opts.v ?? { agrees: true, note: '' },
  })(image)
}

describe('runAnalysis', () => {
  it('returns not-math without calling stage 2', async () => {
    expect(await run({ s1: s1({ isMath: false }) })).toEqual({ kind: 'not-math' })
  })
  it('returns unreadable below the legibility threshold', async () => {
    const r = await run({ s1: s1({ legibility: 0.3 }) })
    expect(r.kind).toBe('unreadable')
  })
  it('returns unreadable when no steps were found', async () => {
    const r = await run({ s1: s1({ steps: [] }) })
    expect(r.kind).toBe('unreadable')
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
      analyzeSteps: async () => errorDiag,
      verifyDiagnosis: async () => ({ agrees: true, note: '' }),
    }, (timing) => timings.push(timing))

    await analyze(image)

    expect(timings.map(({ stage, status }) => ({ stage, status }))).toEqual([
      { stage: 'transcription', status: 'completed' },
      { stage: 'analysis', status: 'completed' },
      { stage: 'verification', status: 'completed' },
    ])
    expect(timings.every(({ durationMs }) => durationMs >= 0)).toBe(true)
  })
  it('reports the model stage that failed', async () => {
    const timings: StageTiming[] = []
    const analyze = makeRunAnalysis(client, config, {
      transcribe: async () => s1(),
      analyzeSteps: async () => { throw new Error('Request timed out.') },
      verifyDiagnosis: async () => ({ agrees: true, note: '' }),
    }, (timing) => timings.push(timing))

    await expect(analyze(image)).rejects.toThrow('Request timed out.')
    expect(timings.map(({ stage, status }) => ({ stage, status }))).toEqual([
      { stage: 'transcription', status: 'completed' },
      { stage: 'analysis', status: 'failed' },
    ])
  })
})
