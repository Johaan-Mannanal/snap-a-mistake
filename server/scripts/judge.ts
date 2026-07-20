import { z } from 'zod'
import { MISCONCEPTION_TAGS, type AnalyzeResponse } from '@snap/shared'

export const GoldenSourceSchema = z.enum(['synthetic', 'fermat'])
export type GoldenSource = z.infer<typeof GoldenSourceSchema>

export const GoldenCaseSchema = z.object({
  file: z.string().min(1),
  source: GoldenSourceSchema,
  sourceId: z.string().min(1).optional(),
  expect: z.enum(['correct', 'error', 'unreadable', 'not-math']),
  errorStepIndex: z.number().int().min(0).optional(),
  tag: z.enum(MISCONCEPTION_TAGS).optional(),
}).superRefine((value, ctx) => {
  if (value.source === 'fermat' && !value.sourceId)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'FERMAT cases require sourceId' })
  if (value.expect === 'error' && (value.errorStepIndex === undefined || value.tag === undefined))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'error cases require errorStepIndex and tag' })
})
export type GoldenCase = z.infer<typeof GoldenCaseSchema>

export const GoldenManifestSchema = z.object({ cases: z.array(GoldenCaseSchema).min(1) })

export function selectCases(cases: GoldenCase[], source?: GoldenSource): GoldenCase[] {
  return source ? cases.filter((c) => c.source === source) : cases
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
  if (actual.errorStepIndex === null) return { pass: false, detail: 'missed the error entirely' }
  if (actual.errorStepIndex !== expected.errorStepIndex)
    return { pass: false, detail: `flagged step ${actual.errorStepIndex}, expected ${expected.errorStepIndex}` }
  if (actual.misconceptionTag !== expected.tag)
    return { pass: false, detail: `right step; tag mismatch (${actual.misconceptionTag} vs ${expected.tag})` }
  return { pass: true, detail: 'ok' }
}
