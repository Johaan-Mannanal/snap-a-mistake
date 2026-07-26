import { AnalyzeResponseSchema, FollowUpSchema } from '@snap/shared'
import { describe, expect, it } from 'vitest'
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

  it('provides a corrected diagnosis and a distinct alternate follow-up', async () => {
    const correctionDeps = createMockDeps('correction')
    const analysis = getMockAnalysisResponse('correction')
    if (analysis?.kind !== 'analysis') throw new Error('expected correction analysis fixture')
    const correction = await correctionDeps.runCorrection(
      { base64: 'image', mediaType: 'image/jpeg' },
      { analysis, selectedStepIndex: 1 },
    )
    expect(correction).toMatchObject({
      kind: 'analysis', errorStepIndex: 1, misconceptionTag: 'algebraic-slip',
      followUp: { hint: 'Combine only matching variable terms.' },
    })

    const alternateDeps = createMockDeps('alternate-follow-up')
    const alternate = await alternateDeps.generateFollowUp({
      concept: 'integration by parts',
      diagnosis: 'Keep x out of the remaining integral.',
      previousProblems: ['Evaluate ∫ x eˣ dx with u = x, dv = eˣ dx.'],
    })
    expect(alternate).toEqual({
      problem: 'Evaluate ∫ 2x eˣ dx with u = 2x, dv = eˣ dx.',
      concept: 'integration by parts',
      hint: 'Differentiate u once, then integrate dv.',
    })
  })

  it('makes timeout and server-error modes fail without returning analysis content', async () => {
    await expect(createMockDeps('timeout', { timeoutDelayMs: 0 }).runAnalysis({ base64: 'image', mediaType: 'image/jpeg' }))
      .rejects.toThrow('deterministic mock timeout')
    await expect(createMockDeps('server-error').runAnalysis({ base64: 'image', mediaType: 'image/jpeg' }))
      .rejects.toThrow('deterministic mock server error')
  })
})
