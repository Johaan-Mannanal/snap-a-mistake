export type DiscardUnreadableDependencies = {
  deleteScan(scanId: string): Promise<unknown>
  clearSession(scanId: string): Promise<void>
  flushOwnedPhotos(): Promise<void>
  navigate(): void
}

export function createUnreadableDiscardTransition(): {
  discard(scanId: string, deps: DiscardUnreadableDependencies): Promise<void>
} {
  let active: Promise<void> | null = null

  return {
    discard(scanId, deps) {
      if (active) return active
      const work = (async () => {
        await deps.deleteScan(scanId)
        await deps.clearSession(scanId)
        await deps.flushOwnedPhotos().catch(() => {})
        deps.navigate()
      })()
      const tracked = work.finally(() => {
        if (active === tracked) active = null
      })
      active = tracked
      return tracked
    },
  }
}
