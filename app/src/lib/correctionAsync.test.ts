import { describe, expect, it } from 'vitest'
import { createCorrectionFence } from './correctionAsync'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

describe('correction run ownership', () => {
  it.each(['snap another', 'unmount', 'replacement navigation'] as const)('invalidates a pending correction during %s', async () => {
    const fence = createCorrectionFence()
    const api = deferred<void>()
    const run = fence.begin('scan-1')
    const commits: string[] = []
    const task = (async () => {
      await api.promise
      if (!fence.owns(run)) return
      commits.push('repository')
    })()
    fence.track(run, task)

    const settled = fence.invalidate()
    expect(run.controller.signal.aborted).toBe(true)
    api.resolve()
    await settled

    expect(commits).toEqual([])
  })

  it('only lets the current run commit after a replacement run begins', async () => {
    const fence = createCorrectionFence()
    const first = fence.begin('scan-1')
    const second = fence.begin('scan-1')

    expect(fence.owns(first)).toBe(false)
    expect(fence.owns(second)).toBe(true)
    expect(first.controller.signal.aborted).toBe(true)
  })
})
