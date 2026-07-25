import { describe, expect, it } from 'vitest'
import { createAnalysisFinalization } from './analysisFinalization'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

type Calls = string[]

function dependencies(calls: Calls, lifecycle?: Promise<void>, session?: Promise<void>) {
  return {
    interrupt: async () => { calls.push('interrupted'); await lifecycle },
    restoreReview: async () => { calls.push('review'); await session },
    navigate: () => { calls.push('navigate') },
  }
}

describe('analysis finalization integration', () => {
  it('cancels before a save and restores the reviewed session', async () => {
    const finalization = createAnalysisFinalization()
    const save = deferred<void>()
    const calls: Calls = []
    const persistence = (async () => {
      await save.promise
      if (!finalization.isActive()) return
      calls.push('save')
    })()
    finalization.track(persistence)

    const cancel = finalization.cancel(dependencies(calls))
    save.resolve()
    await cancel

    expect(calls).toEqual(['interrupted', 'review', 'navigate'])
  })

  it('compensates a committed revision when cancellation wins before session persistence settles', async () => {
    const finalization = createAnalysisFinalization()
    const session = deferred<void>()
    const calls: Calls = []
    const persistence = (async () => {
      calls.push('saveRevision')
      await session.promise
      if (!finalization.isActive()) return
      calls.push('persistAnalysis')
      finalization.markSuccessfulHandoff()
    })()
    finalization.track(persistence)

    const cancel = finalization.cancel(dependencies(calls))
    session.resolve()
    await cancel

    expect(calls).toEqual(['saveRevision', 'interrupted', 'review', 'navigate'])
    expect(finalization.intent).toBe('cancel-requested')
  })

  it('compensates session persistence that was already started before cancellation', async () => {
    const finalization = createAnalysisFinalization()
    const session = deferred<void>()
    const calls: Calls = []
    const persistence = (async () => {
      calls.push('saveRevision')
      calls.push('persistAnalysis')
      await session.promise
      if (!finalization.isActive()) return
      finalization.markSuccessfulHandoff()
    })()
    finalization.track(persistence)
    await Promise.resolve()

    const cancel = finalization.cancel(dependencies(calls))
    session.resolve()
    await cancel

    expect(calls).toEqual(['saveRevision', 'persistAnalysis', 'interrupted', 'review', 'navigate'])
  })

  it('abandons an unmounted active run with the same durable compensation', async () => {
    const finalization = createAnalysisFinalization()
    const session = deferred<void>()
    const calls: Calls = []
    const persistence = (async () => {
      calls.push('saveRevision')
      await session.promise
      if (finalization.isActive()) calls.push('persistAnalysis')
    })()
    finalization.track(persistence)

    finalization.abandon(dependencies(calls))
    session.resolve()
    await finalization.settle()

    expect(calls).toEqual(['saveRevision', 'interrupted', 'review', 'navigate'])
  })

  it('does not compensate an intentional successful handoff on unmount', async () => {
    const finalization = createAnalysisFinalization()
    const calls: Calls = []
    finalization.markSuccessfulHandoff()

    finalization.abandon(dependencies(calls))
    await finalization.settle()

    expect(calls).toEqual([])
  })

  it('releases a failed cancellation so returning to review can be retried', async () => {
    const finalization = createAnalysisFinalization()
    const calls: Calls = []
    await expect(finalization.cancel({
      interrupt: async () => { throw new Error('storage unavailable') },
      restoreReview: async () => {},
      navigate: () => {},
    })).rejects.toThrow('storage unavailable')

    await finalization.cancel(dependencies(calls))
    expect(calls).toEqual(['interrupted', 'review', 'navigate'])
  })
})
