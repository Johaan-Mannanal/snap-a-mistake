export type CorrectionRun = {
  readonly token: number
  readonly scanId: string
  readonly controller: AbortController
}

export type CorrectionFence = {
  begin(scanId: string): CorrectionRun
  owns(run: CorrectionRun): boolean
  track(run: CorrectionRun, task: Promise<void>): void
  invalidate(): Promise<void>
}

export class CorrectionStorageError extends Error {
  readonly cause: unknown

  constructor(cause: unknown) {
    super('generated correction could not be saved locally')
    this.name = 'CorrectionStorageError'
    this.cause = cause
  }
}

export function createGeneratedCorrectionRetry<T>(dependencies: {
  generate(): Promise<T>
  apply(generated: T): Promise<void>
}): { run(): Promise<void> } {
  let generated: T
  let hasGenerated = false
  return {
    async run() {
      if (!hasGenerated) {
        generated = await dependencies.generate()
        hasGenerated = true
      }
      try {
        await dependencies.apply(generated)
      } catch (error) {
        throw new CorrectionStorageError(error)
      }
    },
  }
}

export function createCorrectionFence(): CorrectionFence {
  let generation = 0
  let active: CorrectionRun | null = null
  let pending: Promise<void> = Promise.resolve()

  return {
    begin(scanId) {
      active?.controller.abort()
      generation += 1
      const run = { token: generation, scanId, controller: new AbortController() }
      active = run
      return run
    },
    owns(run) {
      return active === run && generation === run.token && !run.controller.signal.aborted
    },
    track(run, task) {
      const settled = task.catch(() => {}).finally(() => {
        if (active === run) active = null
      })
      pending = settled
    },
    async invalidate() {
      generation += 1
      active?.controller.abort()
      active = null
      await pending
    },
  }
}
