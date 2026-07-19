import { beforeEach, describe, expect, it } from 'vitest'
import type { AnalyzeResponse } from '@snap/shared'
import { getSession, resetSession, setAnalysis, setPhoto, startFollowUp } from './session'

const withFollowUp: AnalyzeResponse = {
  kind: 'analysis', steps: [], errorStepIndex: 1, misconceptionTag: 'sign-error',
  explanation: 'x', followUp: { problem: 'p', concept: 'c' }, verifierAgreed: true,
}

beforeEach(resetSession)

describe('session', () => {
  it('setPhoto stores the uri and clears any prior analysis', () => {
    setAnalysis(withFollowUp)
    setPhoto('file:///a.jpg')
    expect(getSession().photoUri).toBe('file:///a.jpg')
    expect(getSession().analysis).toBeNull()
  })
  it('setAnalysis captures the followUp problem', () => {
    setAnalysis(withFollowUp)
    expect(getSession().followUp?.problem).toBe('p')
  })
  it('setAnalysis keeps the existing followUp when the new analysis has none', () => {
    const noFollowUp: AnalyzeResponse = {
      kind: 'analysis', steps: [], errorStepIndex: null, misconceptionTag: null,
      explanation: null, followUp: null, verifierAgreed: true,
    }
    setAnalysis(withFollowUp)
    setAnalysis(noFollowUp)
    expect(getSession().followUp?.problem).toBe('p')
  })
  it('startFollowUp flags a retry and clears photo/analysis but keeps the followUp', () => {
    setPhoto('file:///a.jpg')
    setAnalysis(withFollowUp)
    startFollowUp()
    const s = getSession()
    expect(s.isRetry).toBe(true)
    expect(s.photoUri).toBeNull()
    expect(s.analysis).toBeNull()
    expect(s.followUp?.problem).toBe('p')
  })
  it('resetSession clears everything', () => {
    setPhoto('file:///a.jpg')
    startFollowUp()
    resetSession()
    expect(getSession()).toEqual({ photoUri: null, analysis: null, followUp: null, isRetry: false })
  })
})
