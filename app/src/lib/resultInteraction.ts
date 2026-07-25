export function initialExpandedStepIndexes(errorStepIndex: number | null): Set<number> {
  return errorStepIndex === null ? new Set() : new Set([errorStepIndex])
}

export function selectStepIndex(_current: number | null, next: number): number {
  return next
}

export function toggleExpandedStepIndexes(expanded: ReadonlySet<number>, index: number): Set<number> {
  const next = new Set(expanded)
  if (next.has(index)) next.delete(index)
  else next.add(index)
  return next
}

export function expandStepIndex(expanded: ReadonlySet<number>, index: number): Set<number> {
  const next = new Set(expanded)
  next.add(index)
  return next
}
