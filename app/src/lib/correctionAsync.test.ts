import { describe, expect, it } from 'vitest'
import {
  CorrectionStorageError,
  createCorrectionFence,
  createGeneratedCorrectionRetry,
} from './correctionAsync'

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

describe('generated correction retry', () => {
  it('retries a local save with the original validated response and no additional AI call', async () => {
    const original = { responseId: 'validated-response-1', explanation: 'The first sign change is incorrect.' }
    const later = { responseId: 'validated-response-2', explanation: 'This response must never be requested.' }
    let aiCalls = 0
    let saveCalls = 0
    const persisted: typeof original[] = []
    const retry = createGeneratedCorrectionRetry({
      generate: async () => {
        aiCalls += 1
        return aiCalls === 1 ? original : later
      },
      apply: async (response) => {
        saveCalls += 1
        if (saveCalls === 1) throw new Error('database unavailable')
        persisted.push(response)
      },
    })

    await expect(retry.run()).rejects.toBeInstanceOf(CorrectionStorageError)
    await expect(retry.run()).resolves.toBeUndefined()

    expect(aiCalls).toBe(1)
    expect(persisted).toEqual([original])
  })

  it('does not cache a failed AI request as a local retry', async () => {
    let aiCalls = 0
    const networkFailure = new Error('network unavailable')
    const retry = createGeneratedCorrectionRetry({
      generate: async () => {
        aiCalls += 1
        if (aiCalls === 1) throw networkFailure
        return { responseId: 'validated-response' }
      },
      apply: async () => {},
    })

    await expect(retry.run()).rejects.toBe(networkFailure)
    await expect(retry.run()).resolves.toBeUndefined()

    expect(aiCalls).toBe(2)
  })
})
