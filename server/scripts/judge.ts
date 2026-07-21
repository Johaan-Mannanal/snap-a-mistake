import { z } from 'zod'
import { MISCONCEPTION_TAGS, type AnalyzeResponse } from '@snap/shared'
import { StepAnchorSchema, matchStepAnchor } from './step-anchor.js'

export const GoldenSourceSchema = z.enum(['synthetic', 'fermat'])
export type GoldenSource = z.infer<typeof GoldenSourceSchema>

export const GoldenCaseSchema = z.object({
  file: z.string().min(1),
  source: GoldenSourceSchema,
  sourceId: z.string().min(1).optional(),
  expect: z.enum(['correct', 'error', 'unreadable', 'not-math']),
  errorStepIndex: z.number().int().min(0).optional(),
  errorStepAnchor: StepAnchorSchema.optional(),
  tag: z.enum(MISCONCEPTION_TAGS).optional(),
}).superRefine((value, ctx) => {
  if (value.source === 'fermat' && !value.sourceId)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceId'], message: 'FERMAT cases require sourceId' })
  if (value.source === 'synthetic' && value.sourceId !== undefined)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceId'], message: 'synthetic cases must not have sourceId' })
  if (value.expect === 'error') {
    const hasIndex = value.errorStepIndex !== undefined
    const hasAnchor = value.errorStepAnchor !== undefined
    if (hasIndex === hasAnchor)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['errorStepIndex'], message: 'error cases require exactly one locator' })
    if (value.tag === undefined)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tag'], message: 'error cases require tag' })
  } else {
    if (value.errorStepIndex !== undefined)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['errorStepIndex'], message: 'only error cases may have errorStepIndex' })
    if (value.errorStepAnchor !== undefined)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['errorStepAnchor'], message: 'only error cases may have errorStepAnchor' })
    if (value.tag !== undefined)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tag'], message: 'only error cases may have tag' })
  }
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
  const locatedStep = actual.steps.find((step) => step.index === actual.errorStepIndex)
  if (!locatedStep)
    return { pass: false, detail: `diagnosed step ${actual.errorStepIndex} is absent from returned steps` }
  if (expected.errorStepAnchor) {
    const match = matchStepAnchor(expected.errorStepAnchor, locatedStep)
    if (!match.pass) {
      return {
        pass: false,
        detail: `selected step does not match anchor (missing: ${match.missing.join(', ') || 'none'}; forbidden: ${match.forbidden.join(', ') || 'none'})`,
      }
    }
  } else if (actual.errorStepIndex !== expected.errorStepIndex) {
    return { pass: false, detail: `flagged step ${actual.errorStepIndex}, expected ${expected.errorStepIndex}` }
  }
  if (actual.misconceptionTag !== expected.tag)
    return { pass: false, detail: `right step; tag mismatch (${actual.misconceptionTag} vs ${expected.tag})` }
  if (!actual.verifierAgreed)
    return { pass: false, detail: 'verifier disagreed with the diagnosis' }
  if (locatedStep.verdict !== 'wrong')
    return { pass: false, detail: `diagnosed step ${actual.errorStepIndex} has verdict ${locatedStep.verdict}, expected wrong` }
  return { pass: true, detail: 'ok' }
}
