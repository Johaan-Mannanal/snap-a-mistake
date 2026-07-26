import type { ScanRecord } from './scanTypes'

export function analysisRevisionReason(scan: Pick<ScanRecord, 'revisions'>): 'initial' | 'retry' {
  return scan.revisions.length > 0 ? 'retry' : 'initial'
}

export async function persistAnalysisRun<T>(dependencies: {
  isCurrent(): boolean
  saveRevision(): Promise<T>
  validateSaved(saved: T): boolean
  persistSession(): Promise<void>
}): Promise<T | null> {
  if (!dependencies.isCurrent()) return null
  const saved = await dependencies.saveRevision()
  if (!dependencies.isCurrent()) return null
  if (!dependencies.validateSaved(saved)) throw new Error('saved revision is not active')
  await dependencies.persistSession()
  if (!dependencies.isCurrent()) return null
  return saved
}

export function beginAnalysisReset(dependencies: {
  invalidateRun(): Promise<void> | null
  abortRequest(): void
  markTerminal(): void
  invalidateCorrections(): Promise<void>
  reset(): Promise<void>
  navigate(): void
}): Promise<void> {
  const activeRun = dependencies.invalidateRun()
  dependencies.abortRequest()
  dependencies.markTerminal()
  const corrections = dependencies.invalidateCorrections()
  return (async () => {
    await corrections
    await activeRun
    await dependencies.reset()
    dependencies.navigate()
  })()
}
