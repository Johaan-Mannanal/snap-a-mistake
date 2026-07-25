import { z } from 'zod'

export const MISCONCEPTION_TAGS = [
  'sign-error', 'dropped-term', 'distribution-error', 'chain-rule-missed',
  'product-rule-misapplied', 'integration-by-parts-error', 'u-sub-bounds-error',
  'algebraic-slip', 'exponent-rule-error', 'equals-abuse',
  'notation-error', 'formula-misapplied', 'other',
] as const
export type MisconceptionTag = (typeof MISCONCEPTION_TAGS)[number]

const StudentFacingMathTextSchema = z.string().min(1).refine(
  (value) => !/[\\$^]/.test(value),
  { message: 'must use Unicode or prose without raw LaTeX, math delimiters, or caret notation' },
)

export const FollowUpSchema = z.object({
  problem: StudentFacingMathTextSchema,
  concept: z.string().min(1),
  hint: StudentFacingMathTextSchema,
})
export type FollowUp = z.infer<typeof FollowUpSchema>

const StepFieldsSchema = z.object({
  index: z.number().int().min(0),
  latex: z.string(),
  plain: z.string(),
  yBandTopPct: z.number().min(0).max(100),
  yBandBottomPct: z.number().min(0).max(100),
})
function validateVerticalBand(
  value: { yBandTopPct: number; yBandBottomPct: number },
  ctx: z.RefinementCtx,
) {
  if (value.yBandTopPct > value.yBandBottomPct)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['yBandTopPct'],
      message: 'yBandTopPct must not exceed yBandBottomPct',
    })
}

export const TranscribedStepSchema = StepFieldsSchema.superRefine(validateVerticalBand)
export type TranscribedStep = z.infer<typeof TranscribedStepSchema>

export const StepSchema = StepFieldsSchema.extend({
  verdict: z.enum(['ok', 'suspect', 'wrong', 'downstream']),
}).superRefine(validateVerticalBand)
export type Step = z.infer<typeof StepSchema>

export const Stage1Schema = z.object({
  isMath: z.boolean(),
  legibility: z.number().min(0).max(1),
  steps: z.array(TranscribedStepSchema),
})
export type Stage1Result = z.infer<typeof Stage1Schema>

const DiagnosisFieldsSchema = z.object({
  errorStepIndex: z.number().int().min(0).nullable(),
  misconceptionTag: z.enum(MISCONCEPTION_TAGS).nullable(),
  explanation: StudentFacingMathTextSchema.nullable(),
  followUp: FollowUpSchema.nullable(),
})
function validateAnalysisConsistency(
  value: z.infer<typeof DiagnosisFieldsSchema>,
  ctx: z.RefinementCtx,
) {
  const hasError = value.errorStepIndex !== null
  if (hasError && (value.misconceptionTag === null || value.explanation === null || value.followUp === null))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'error diagnosis requires tag, explanation, and followUp' })
  if (!hasError && (value.misconceptionTag !== null || value.explanation !== null || value.followUp !== null))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'correct work must have all-null diagnosis fields' })
}

export const Stage2Schema = DiagnosisFieldsSchema.superRefine(validateAnalysisConsistency)
export type Stage2Result = z.infer<typeof Stage2Schema>

export const VerifierSchema = z.object({ agrees: z.boolean(), note: z.string() })
export type VerifierResult = z.infer<typeof VerifierSchema>

export const AnalysisResultSchema = DiagnosisFieldsSchema.extend({
  kind: z.literal('analysis'),
  steps: z.array(StepSchema),
  verifierAgreed: z.boolean(),
}).superRefine(validateAnalysisConsistency)
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>

export const CorrectionContextSchema = z.object({
  analysis: AnalysisResultSchema,
  selectedStepIndex: z.number().int().min(0),
}).superRefine((value, ctx) => {
  if (!value.analysis.steps.some((step) => step.index === value.selectedStepIndex))
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['selectedStepIndex'], message: 'selected step must exist' })
})
export type CorrectionContext = z.infer<typeof CorrectionContextSchema>

export const CorrectedDiagnosisSchema = z.object({
  misconceptionTag: z.enum(MISCONCEPTION_TAGS),
  explanation: StudentFacingMathTextSchema,
  followUp: FollowUpSchema,
})

export const AlternateFollowUpContextSchema = z.object({
  concept: z.string().min(1),
  diagnosis: StudentFacingMathTextSchema,
  previousProblems: z.array(StudentFacingMathTextSchema).min(1).max(5),
})
export type AlternateFollowUpContext = z.infer<typeof AlternateFollowUpContextSchema>

export const AnalyzeResponseSchema = z.union([
  AnalysisResultSchema,
  z.object({ kind: z.literal('unreadable'), tips: z.array(z.string()) }),
  z.object({ kind: z.literal('not-math') }),
])
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>
