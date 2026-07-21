import { z } from 'zod'
import type { TranscribedStep } from '@snap/shared'

export function normalizeStepAnchorText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[−–—]/g, '-')
    .replace(/\\cdot|[×·]/g, '*')
    .replace(/\\(?:left|right|quad|[,;!])/g, '')
    .replace(/\s+/g, '')
    .replace(/[{}\[\]()]/g, '')
}

const nonEmptyFragment = z.string().min(1).refine(
  (value) => normalizeStepAnchorText(value).length > 0,
  'anchor fragment must contain mathematical content',
)

export const StepAnchorSchema = z.object({
  all: z.array(nonEmptyFragment).min(1),
  none: z.array(nonEmptyFragment).optional(),
})
export type StepAnchor = z.infer<typeof StepAnchorSchema>

export function matchStepAnchor(anchor: StepAnchor, step: Pick<TranscribedStep, 'latex' | 'plain'>) {
  const fields = [normalizeStepAnchorText(step.latex), normalizeStepAnchorText(step.plain)]
  const contains = (fragment: string) => {
    const normalized = normalizeStepAnchorText(fragment)
    return fields.some((field) => field.includes(normalized))
  }
  const missing = anchor.all.filter((fragment) => !contains(fragment))
  const forbidden = (anchor.none ?? []).filter(contains)
  return { pass: missing.length === 0 && forbidden.length === 0, missing, forbidden }
}
