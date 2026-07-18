import { z } from 'zod'

export const MISCONCEPTION_TAGS = [
  'sign-error', 'dropped-term', 'distribution-error', 'chain-rule-missed',
  'product-rule-misapplied', 'integration-by-parts-error', 'u-sub-bounds-error',
  'algebraic-slip', 'exponent-rule-error', 'equals-abuse', 'other',
] as const
export type MisconceptionTag = (typeof MISCONCEPTION_TAGS)[number]

export const TranscribedStepSchema = z.object({
  index: z.number().int().min(0),
  latex: z.string(),
  plain: z.string(),
  yBandTopPct: z.number().min(0).max(100),
  yBandBottomPct: z.number().min(0).max(100),
})
export type TranscribedStep = z.infer<typeof TranscribedStepSchema>

export const StepSchema = TranscribedStepSchema.extend({
  verdict: z.enum(['ok', 'suspect', 'wrong', 'downstream']),
})
export type Step = z.infer<typeof StepSchema>

export const Stage1Schema = z.object({
  isMath: z.boolean(),
  legibility: z.number().min(0).max(1),
  steps: z.array(TranscribedStepSchema),
})
export type Stage1Result = z.infer<typeof Stage1Schema>

export const Stage2Schema = z
  .object({
    errorStepIndex: z.number().int().min(0).nullable(),
    misconceptionTag: z.enum(MISCONCEPTION_TAGS).nullable(),
    explanation: z.string().min(1).nullable(),
    followUp: z.object({ problem: z.string().min(1), concept: z.string().min(1) }).nullable(),
  })
  .superRefine((v, ctx) => {
    const hasError = v.errorStepIndex !== null
    if (hasError && (v.misconceptionTag === null || v.explanation === null || v.followUp === null))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'error diagnosis requires tag, explanation, and followUp' })
    if (!hasError && (v.misconceptionTag !== null || v.explanation !== null || v.followUp !== null))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'correct work must have all-null diagnosis fields' })
  })
export type Stage2Result = z.infer<typeof Stage2Schema>

export const VerifierSchema = z.object({ agrees: z.boolean(), note: z.string() })
export type VerifierResult = z.infer<typeof VerifierSchema>

export const AnalyzeResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('analysis'),
    steps: z.array(StepSchema),
    errorStepIndex: z.number().int().nullable(),
    misconceptionTag: z.enum(MISCONCEPTION_TAGS).nullable(),
    explanation: z.string().nullable(),
    followUp: z.object({ problem: z.string(), concept: z.string() }).nullable(),
    verifierAgreed: z.boolean(),
  }),
  z.object({ kind: z.literal('unreadable'), tips: z.array(z.string()) }),
  z.object({ kind: z.literal('not-math') }),
])
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>
