import { AnalyzeResponseSchema, FollowUpSchema } from '@snap/shared'
import { describe, expect, it } from 'vitest'
import { buildAlternateFollowUpContext, createFollowUpPracticeState, replaceFollowUpProblem } from '../../app/src/lib/followUp.js'
import { ModelJsonError } from '../src/llm/client.js'
import {
  MOCK_MODES,
  createMockDeps,
  getMockAnalysisResponse,
} from '../scripts/mock-fixtures.js'

describe('deterministic mock fixtures', () => {
  it('returns a schema-valid, student-safe analysis response for every content mode', () => {
    const contentModes = ['correct', 'error', 'suspect', 'unreadable', 'not-math', 'correction', 'alternate-follow-up'] as const

    for (const mode of contentModes) {
      const response = getMockAnalysisResponse(mode)
      expect(response).not.toBeNull()
      expect(AnalyzeResponseSchema.safeParse(response).success).toBe(true)
    }

    expect(MOCK_MODES).toEqual([
      'correct', 'error', 'suspect', 'unreadable', 'not-math',
      'timeout', 'server-error', 'correction', 'alternate-follow-up',
    ])
  })

  it('gives error and suspect responses Unicode-safe follow-up hints', () => {
    for (const mode of ['error', 'suspect'] as const) {
      const response = getMockAnalysisResponse(mode)
      if (response?.kind !== 'analysis') throw new Error('expected an analysis fixture')
      expect(FollowUpSchema.safeParse(response.followUp).success).toBe(true)
      expect(response.followUp?.hint).not.toMatch(/[\\$^]/)
    }
  })

  it('keeps the correction coherent with the selected integration-by-parts step', async () => {
    const correctionDeps = createMockDeps('correction')
    const analysis = getMockAnalysisResponse('correction')
    if (analysis?.kind !== 'analysis') throw new Error('expected correction analysis fixture')
    const correction = await correctionDeps.runCorrection(
      { base64: 'image', mediaType: 'image/jpeg' },
      { analysis, selectedStepIndex: 1 },
    )
    expect(correction).toMatchObject({
      kind: 'analysis', errorStepIndex: 1, misconceptionTag: 'integration-by-parts-error',
      followUp: {
        concept: 'integration by parts',
        problem: 'Evaluate ∫ 2x eˣ dx with u = 2x, dv = eˣ dx.',
      },
    })
    if (correction.kind !== 'analysis') throw new Error('expected corrected analysis')
    expect(correction.explanation).toMatch(/integration by parts/i)
    expect(correction.steps[1]?.verdict).toBe('wrong')
  })

  it('cycles through distinct Unicode-safe alternates that the follow-up loop can accept', async () => {
    const alternateDeps = createMockDeps('alternate-follow-up')
    const original = 'Evaluate ∫ x eˣ dx with u = x and dv = eˣ dx.'
    const diagnosis = 'Keep x out of the remaining integral.'
    const initial = { problem: original, concept: 'integration by parts', hint: 'Choose u before differentiating.' }
    const first = await alternateDeps.generateFollowUp(buildAlternateFollowUpContext(createFollowUpPracticeState(initial), diagnosis))
    expect(first).toEqual({
      problem: 'Evaluate ∫ 2x eˣ dx with u = 2x, dv = eˣ dx.',
      concept: 'integration by parts',
      hint: 'Differentiate u once, then integrate dv.',
    })
    const replaced = replaceFollowUpProblem(createFollowUpPracticeState(initial), first)
    expect(replaced).not.toBeNull()
    if (replaced === null) throw new Error('expected first alternate to be accepted')
    const second = await alternateDeps.generateFollowUp(buildAlternateFollowUpContext(replaced, diagnosis))
    expect(second.problem).not.toBe(first.problem)
    expect(second.problem).not.toBe(original)
    expect(second.concept).toBe('integration by parts')
    expect(FollowUpSchema.safeParse(second).success).toBe(true)
    expect(replaceFollowUpProblem(replaced, second)).not.toBeNull()
  })

  it('uses the same unavailable-result contract when every deterministic alternate is exhausted', async () => {
    const alternateDeps = createMockDeps('alternate-follow-up')
    await expect(alternateDeps.generateFollowUp({
      concept: 'integration by parts',
      diagnosis: 'Keep x out of the remaining integral.',
      previousProblems: [
        'Evaluate ∫ 2x eˣ dx with u = 2x, dv = eˣ dx.',
        'Evaluate ∫ x² eˣ dx with u = x², dv = eˣ dx.',
        'Evaluate ∫ 3x eˣ dx with u = 3x, dv = eˣ dx.',
        'Evaluate ∫ x e²ˣ dx with u = x, dv = e²ˣ dx.',
        'Evaluate ∫ 4x eˣ dx with u = 4x, dv = eˣ dx.',
      ],
    })).rejects.toBeInstanceOf(ModelJsonError)
  })

  it('makes timeout and server-error modes fail without returning analysis content', async () => {
    await expect(createMockDeps('timeout', { timeoutDelayMs: 0 }).runAnalysis({ base64: 'image', mediaType: 'image/jpeg' }))
      .rejects.toThrow('deterministic mock timeout')
    await expect(createMockDeps('server-error').runAnalysis({ base64: 'image', mediaType: 'image/jpeg' }))
      .rejects.toThrow('deterministic mock server error')
  })
})
