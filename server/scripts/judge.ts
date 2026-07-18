import type { AnalyzeResponse, MisconceptionTag } from '@snap/shared'

export type GoldenCase = {
  file: string
  expect: 'correct' | 'error' | 'unreadable' | 'not-math'
  errorStepIndex?: number
  tag?: MisconceptionTag
}

export function judge(expected: GoldenCase, actual: AnalyzeResponse): { pass: boolean; detail: string } {
  if (expected.expect === 'not-math' || expected.expect === 'unreadable') {
    const pass = actual.kind === expected.expect
    return { pass, detail: pass ? 'ok' : `expected ${expected.expect}, got ${actual.kind}` }
  }
  if (actual.kind !== 'analysis') return { pass: false, detail: `expected analysis, got ${actual.kind}` }

  if (expected.expect === 'correct') {
    const pass = actual.errorStepIndex === null
    return { pass, detail: pass ? 'ok' : `FALSE ACCUSATION: flagged step ${actual.errorStepIndex} (${actual.misconceptionTag})` }
  }

  // expected.expect === 'error'
  if (actual.errorStepIndex === null) return { pass: false, detail: 'missed the error entirely' }
  if (actual.errorStepIndex !== expected.errorStepIndex)
    return { pass: false, detail: `flagged step ${actual.errorStepIndex}, expected ${expected.errorStepIndex}` }
  if (expected.tag && actual.misconceptionTag !== expected.tag)
    return { pass: true, detail: `right step; tag mismatch (${actual.misconceptionTag} vs ${expected.tag})` }
  return { pass: true, detail: 'ok' }
}
