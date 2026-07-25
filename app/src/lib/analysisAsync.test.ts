import { describe, expect, it } from 'vitest'
import { createAsyncLock, createRunFence } from './analysisAsync'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('analysis async fencing', () => {
  it('ignores a response that resolves after cancellation', async () => {
    const fence = createRunFence()
    const response = deferred<string>()
    const persisted: string[] = []
    const token = fence.begin()
    const run = (async () => {
      const value = await response.promise
      if (!fence.owns(token)) return
      persisted.push(value)
    })()
    fence.track(token, run)

    fence.invalidate()
    response.resolve('analysis')
    await run

    expect(persisted).toEqual([])
  })

  it('waits for an in-flight save before the cancellation transition runs', async () => {
    const fence = createRunFence()
    const save = deferred<void>()
    const token = fence.begin()
    const run = save.promise
    fence.track(token, run)
    const inFlight = fence.invalidate()
    let transitioned = false
    const cancel = (async () => {
      await inFlight
      transitioned = true
    })()

    await Promise.resolve()
    expect(transitioned).toBe(false)
    save.resolve()
    await cancel
    expect(transitioned).toBe(true)
  })

  it.each([0, 1, 2, 3] as const)('stops stale work at async boundary %i before it can mutate the next store', async (boundary) => {
    const fence = createRunFence()
    const gates = [deferred<void>(), deferred<void>(), deferred<void>(), deferred<void>()]
    const mutations: string[] = []
    const token = fence.begin()
    const run = (async () => {
      await gates[0]!.promise
      if (!fence.owns(token)) return
      mutations.push('request')
      await gates[1]!.promise
      if (!fence.owns(token)) return
      mutations.push('revision')
      await gates[2]!.promise
      if (!fence.owns(token)) return
      mutations.push('session')
      await gates[3]!.promise
      if (!fence.owns(token)) return
      mutations.push('history')
    })()
    fence.track(token, run)

    for (let index = 0; index < boundary; index += 1) {
      gates[index]!.resolve()
      await Promise.resolve()
    }
    fence.invalidate()
    for (let index = boundary; index < gates.length; index += 1) gates[index]!.resolve()
    await run

    expect(mutations).toEqual([
      [],
      ['request'],
      ['request', 'revision'],
      ['request', 'revision', 'session'],
    ][boundary])
  })
})

describe('analysis async save lock', () => {
  it('coalesces rapid retry taps into one save', async () => {
    const lock = createAsyncLock<void>()
    const save = deferred<void>()
    let calls = 0
    const task = () => {
      calls += 1
      return save.promise
    }

    const first = lock.run(task)
    const second = lock.run(task)
    expect(calls).toBe(1)
    expect(lock.busy).toBe(true)
    save.resolve()
    await Promise.all([first, second])
    expect(lock.busy).toBe(false)
  })

  it('releases a failed cancellation lock so the next return-to-review tap can retry', async () => {
    const lock = createAsyncLock<void>()
    await expect(lock.run(async () => { throw new Error('state unavailable') })).rejects.toThrow('state unavailable')

    await expect(lock.run(async () => {})).resolves.toBeUndefined()
    expect(lock.busy).toBe(false)
  })

  it('allows retry saving after the previous save fails', async () => {
    const lock = createAsyncLock<void>()
    let attempts = 0

    await expect(lock.run(async () => {
      attempts += 1
      throw new Error('database unavailable')
    })).rejects.toThrow('database unavailable')
    await lock.run(async () => { attempts += 1 })

    expect(attempts).toBe(2)
  })
})
