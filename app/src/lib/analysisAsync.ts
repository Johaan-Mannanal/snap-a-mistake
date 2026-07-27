export type RunFence = {
  begin(): number
  invalidate(): Promise<void> | null
  owns(token: number): boolean
  track(token: number, task: Promise<void>): void
}

export function createRunFence(): RunFence {
  let generation = 0
  let active: Promise<void> | null = null

  return {
    begin() {
      generation += 1
      return generation
    },
    invalidate() {
      generation += 1
      return active
    },
    owns(token) {
      return generation === token
    },
    track(token, task) {
      const tracked = task.finally(() => {
        if (active === tracked) active = null
      })
      active = tracked
      if (!this.owns(token)) active = null
    },
  }
}

export type AnalysisAction = 'run' | 'retry-save' | 'discard' | 'back'

export type AnalysisActionCoordinator = {
  readonly active: AnalysisAction | null
  start(
    action: Extract<AnalysisAction, 'run' | 'retry-save'>,
    task: () => Promise<void>,
  ): Promise<void> | null
  transition(
    action: Extract<AnalysisAction, 'discard' | 'back'>,
    task: (previous: Promise<void>) => Promise<void>,
  ): Promise<void> | null
}

export function createAnalysisActionCoordinator(): AnalysisActionCoordinator {
  type ActiveAction = {
    id: symbol
    action: AnalysisAction
    promise: Promise<void>
  }
  let active: ActiveAction | null = null

  const launch = (action: AnalysisAction, task: () => Promise<void>) => {
    const id = Symbol(action)
    let resolve!: () => void
    let reject!: (error: unknown) => void
    const promise = new Promise<void>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise
      reject = rejectPromise
    })
    active = { id, action, promise }
    const clear = () => {
      if (active?.id === id) active = null
    }
    void promise.then(clear, clear)
    try {
      task().then(resolve, reject)
    } catch (error) {
      reject(error)
    }
    return promise
  }

  return {
    get active() { return active?.action ?? null },
    start(action, task) {
      if (active !== null) return null
      return launch(action, task)
    },
    transition(action, task) {
      if (active?.action === action) return active.promise
      if (active?.action === 'discard' || active?.action === 'back') return null
      const previous = active?.promise ?? Promise.resolve()
      return launch(action, () => task(previous))
    },
  }
}

export type AsyncLock<T> = {
  readonly busy: boolean
  run(task: () => Promise<T>): Promise<T>
}

export function createAsyncLock<T>(): AsyncLock<T> {
  let active: Promise<T> | null = null
  return {
    get busy() { return active !== null },
    run(task) {
      if (active) return active
      const current = task().finally(() => {
        if (active === current) active = null
      })
      active = current
      return current
    },
  }
}
