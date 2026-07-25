export type AnalysisTerminalIntent = 'active' | 'cancel-requested' | 'successful-handoff'

type FinalizationDependencies = {
  interrupt(): Promise<void>
  restoreReview(): Promise<void>
  navigate(): void
}

export type AnalysisFinalization = {
  readonly intent: AnalysisTerminalIntent
  begin(): void
  isActive(): boolean
  track(task: Promise<void>): void
  markSuccessfulHandoff(): void
  cancel(dependencies: FinalizationDependencies): Promise<void>
  abandon(dependencies: FinalizationDependencies): void
  settle(): Promise<void>
}

export function createAnalysisFinalization(): AnalysisFinalization {
  let intent: AnalysisTerminalIntent = 'active'
  let pending: Promise<void> = Promise.resolve()
  let cancellation: Promise<void> | null = null

  const waitForPending = async () => { await pending.catch(() => {}) }

  return {
    get intent() { return intent },
    begin() {
      intent = 'active'
      pending = Promise.resolve()
      cancellation = null
    },
    isActive() { return intent === 'active' },
    track(task) {
      pending = task.catch(() => {})
    },
    markSuccessfulHandoff() {
      if (intent === 'active') intent = 'successful-handoff'
    },
    cancel(dependencies) {
      if (cancellation) return cancellation
      intent = 'cancel-requested'
      const current = (async () => {
        await waitForPending()
        await dependencies.interrupt()
        await dependencies.restoreReview()
        dependencies.navigate()
      })()
      const tracked = current.finally(() => {
        if (cancellation === tracked) cancellation = null
      })
      cancellation = tracked
      return tracked
    },
    abandon(dependencies) {
      if (intent === 'successful-handoff') return
      void this.cancel(dependencies).catch(() => {})
    },
    async settle() {
      await pending.catch(() => {})
      await cancellation?.catch(() => {})
    },
  }
}

export type CompletedReviewReturn = {
  returnToReview(dependencies: { restoreReview(): Promise<void>; navigate(): void }): Promise<void>
}

export function createCompletedReviewReturn(): CompletedReviewReturn {
  let active: Promise<void> | null = null
  return {
    returnToReview(dependencies) {
      if (active) return active
      const current = (async () => {
        await dependencies.restoreReview()
        dependencies.navigate()
      })()
      const tracked = current.finally(() => {
        if (active === tracked) active = null
      })
      active = tracked
      return tracked
    },
  }
}
