import { describe, expect, it, vi } from 'vitest'
import { AnalysisResultSchema, type CorrectionContext } from '@snap/shared'
import type OpenAI from 'openai'
import type { Config } from '../src/config.js'
import { ModelJsonError } from '../src/llm/client.js'
import { makeRunCorrection } from '../src/pipeline/correction.js'
import { fakeClient } from './helpers.js'

const config: Config = {
  port: 0, openaiApiKey: 'k', legibilityThreshold: 0.4,
  models: { vision: 'v', analysis: 'a', verifier: 'h' },
}
const image = { base64: 'AAAA', mediaType: 'image/jpeg' as const }

const analysis = {
  kind: 'analysis' as const,
  steps: [0, 1, 2, 3].map((index) => ({
    index, latex: `L${index}`, plain: `P${index}`,
    yBandTopPct: index * 10, yBandBottomPct: index * 10 + 9,
    verdict: index < 1 ? 'ok' as const : index === 1 ? 'wrong' as const : 'downstream' as const,
  })),
  errorStepIndex: 1,
  misconceptionTag: 'sign-error' as const,
  explanation: 'A sign changed.',
  followUp: { problem: 'Simplify 3 − 5.', concept: 'signs', hint: 'Track the negative sign.' },
  verifierAgreed: true,
}
const context = (selectedStepIndex: number): CorrectionContext => ({ analysis, selectedStepIndex })
const diagnosis = JSON.stringify({
  misconceptionTag: 'algebraic-slip',
  explanation: 'You combined unlike terms as if they were the same quantity.',
  followUp: {
    problem: 'Simplify 2x + 3 + 4x.', concept: 'like terms', hint: 'Combine only matching variable terms.',
  },
})

function run(client: OpenAI, selectedStepIndex = 2) {
  return makeRunCorrection(client, config)(image, context(selectedStepIndex))
}

describe('runCorrection', () => {
  it('keeps the student-selected step and remaps verdicts', async () => {
    // Would fail if correction reused the original stage-two error index.
    const result = await run(fakeClient(diagnosis, '{"agrees":true,"note":"The selected step is invalid."}'))

    expect(result.kind).toBe('analysis')
    if (result.kind !== 'analysis') throw new Error('expected analysis')
    expect(result.errorStepIndex).toBe(2)
    expect(result.steps.map((step) => step.verdict)).toEqual(['ok', 'ok', 'wrong', 'downstream'])
    expect(AnalysisResultSchema.safeParse(result).success).toBe(true)
  })

  it('uses response order for context while retaining the selected opaque identity', async () => {
    const sparseAnalysis = {
      ...analysis,
      steps: analysis.steps.map((step, position) => ({
        ...step,
        index: [41, 7, 103, 2][position]!,
      })),
      errorStepIndex: 7,
    }
    const client = fakeClient(diagnosis, '{"agrees":true,"note":"The selected step is invalid."}')

    await makeRunCorrection(client, config)(image, {
      analysis: sparseAnalysis,
      selectedStepIndex: 7,
    })

    const firstCall = (client.chat.completions.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as OpenAI.Chat.Completions.ChatCompletionCreateParams
    const text = JSON.stringify(firstCall.messages)
    expect(text).toContain('Step ID 41:')
    expect(text).toContain('Step ID 7:')
    expect(text).toContain('Selected first logical break: step ID 7')
  })

  it('marks the selected step suspect when the verifier disagrees', async () => {
    // Would fail if verifier disagreement were ignored during verdict remapping.
    const result = await run(fakeClient(diagnosis, '{"agrees":false,"note":"The step is valid."}'))

    if (result.kind !== 'analysis') throw new Error('expected analysis')
    expect(result.steps.map((step) => step.verdict)).toEqual(['ok', 'ok', 'suspect', 'downstream'])
    expect(result.verifierAgreed).toBe(false)
    expect(AnalysisResultSchema.safeParse(result).success).toBe(true)
  })

  it('rejects a selected step that is absent from the supplied analysis', async () => {
    // Would fail if the pipeline sent an invalid selected step to the model/verifier.
    const invalid = { ...context(2), selectedStepIndex: 99 } as CorrectionContext

    await expect(makeRunCorrection(fakeClient(), config)(image, invalid)).rejects.toThrow(ModelJsonError)
  })

  it('returns Unicode-safe structured diagnosis text', async () => {
    // Would fail if correction output bypassed CorrectedDiagnosisSchema validation.
    const result = await run(fakeClient(diagnosis, '{"agrees":true,"note":"The selected step is invalid."}'))

    if (result.kind !== 'analysis') throw new Error('expected analysis')
    expect(result.explanation).toBe('You combined unlike terms as if they were the same quantity.')
    expect(result.followUp).toEqual({
      problem: 'Simplify 2x + 3 + 4x.', concept: 'like terms', hint: 'Combine only matching variable terms.',
    })
  })
})
