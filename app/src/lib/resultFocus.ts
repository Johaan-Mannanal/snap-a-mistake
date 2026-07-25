import type { Step } from '@snap/shared'

/**
 * Keeps a result timeline oriented around the diagnosed break without assuming
 * that model-produced step indexes are consecutive.
 */
export function focusedStepIndexes(steps: readonly Step[], errorStepIndex: number | null): number[] {
  if (errorStepIndex === null) return steps.map((step) => step.index)

  const ordered = [...steps].sort((a, b) => a.index - b.index)
  const diagnosedPosition = ordered.findIndex((step) => step.index === errorStepIndex)
  if (diagnosedPosition === -1) return []

  return ordered.slice(Math.max(0, diagnosedPosition - 1), diagnosedPosition + 2).map((step) => step.index)
}
