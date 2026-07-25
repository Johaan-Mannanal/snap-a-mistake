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
