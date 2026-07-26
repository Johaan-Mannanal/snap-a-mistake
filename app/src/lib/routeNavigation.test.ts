import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createAnalysisFinalization } from './analysisFinalization'
import { createFollowUpLeaveLock } from './followUp'
import { createReviewMutationCoordinator } from './reviewTransaction'
import { createSessionResetTransition } from './sessionResetTransition'
import {
  analysisSystemBackAction,
  registerSystemBackTransition,
  statefulRouteScreenOptions,
  type SystemBackPort,
} from './routeNavigation'

const layoutSource = readFileSync(resolve(__dirname, '../../app/_layout.tsx'), 'utf8')
const reviewSource = readFileSync(resolve(__dirname, '../../app/review.tsx'), 'utf8')
const analyzeSource = readFileSync(resolve(__dirname, '../../app/analyze.tsx'), 'utf8')
const followUpSource = readFileSync(resolve(__dirname, '../../app/followup.tsx'), 'utf8')

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

function backPort() {
  let listener: (() => boolean) | null = null
  const remove = vi.fn()
  const port: SystemBackPort = {
    addEventListener: (_event, next) => {
      listener = next
      return { remove }
    },
  }
  return {
    port,
    press: () => {
      if (listener === null) throw new Error('back listener unavailable')
      return listener()
    },
    remove,
  }
}

describe('stateful route navigation', () => {
  it('disables native gestures only for Review, Analyze, and Follow-up', () => {
    expect(statefulRouteScreenOptions('review')).toEqual({ gestureEnabled: false })
    expect(statefulRouteScreenOptions('analyze')).toEqual({ gestureEnabled: false })
    expect(statefulRouteScreenOptions('followup')).toEqual({ gestureEnabled: false })
    expect(statefulRouteScreenOptions('insights')).toEqual({})
    for (const route of ['review', 'analyze', 'followup'])
      expect(layoutSource).toContain(`name="${route}" options={statefulRouteScreenOptions('${route}')}`)
    expect(reviewSource).toContain('useSystemBackTransition(retake)')
    expect(analyzeSource).toContain('useSystemBackTransition(analysisSystemBackAction(result !== null')
    expect(followUpSource).toContain('useSystemBackTransition(leave)')
  })

  it('intercepts system back and unregisters without affecting programmatic navigation', () => {
    const back = backPort()
    const transition = vi.fn()
    const subscription = registerSystemBackTransition(back.port, transition)

    expect(back.press()).toBe(true)
    expect(transition).toHaveBeenCalledOnce()
    subscription.remove()
    expect(back.remove).toHaveBeenCalledOnce()
  })

  it('runs Review cleanup once and fences its late completion', async () => {
    const back = backPort()
    const coordinator = createReviewMutationCoordinator()
    const pending = deferred()
    const navigate = vi.fn()
    let actions = 0
    registerSystemBackTransition(back.port, () => {
      void coordinator.run(async (owns) => {
        actions += 1
        await pending.promise
        if (owns()) navigate()
      })
    })

    expect(back.press()).toBe(true)
    expect(back.press()).toBe(true)
    coordinator.invalidate()
    pending.resolve()
    await pending.promise
    await Promise.resolve()

    expect(actions).toBe(1)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('coalesces active Analyze cancellation and restores Review once', async () => {
    const back = backPort()
    const finalization = createAnalysisFinalization()
    const pending = deferred()
    const calls: string[] = []
    finalization.track(pending.promise)
    registerSystemBackTransition(back.port, () => {
      void finalization.cancel({
        interrupt: async () => { calls.push('interrupt') },
        restoreReview: async () => { calls.push('review') },
        navigate: () => { calls.push('navigate') },
      })
    })

    back.press()
    back.press()
    pending.resolve()
    await finalization.settle()

    expect(calls).toEqual(['interrupt', 'review', 'navigate'])
  })

  it('selects active cancellation before a result and intentional reset after a result', () => {
    const active = vi.fn()
    const result = vi.fn()
    analysisSystemBackAction(false, { active, result })()
    analysisSystemBackAction(true, { active, result })()
    expect(active).toHaveBeenCalledOnce()
    expect(result).toHaveBeenCalledOnce()
  })

  it('coalesces Result reset and Follow-up parent return on double back', async () => {
    const resultBack = backPort()
    const resetPending = deferred()
    const reset = vi.fn(async () => resetPending.promise)
    const resultNavigate = vi.fn()
    const resetTransition = createSessionResetTransition(reset, resultNavigate)
    let resultTransition: Promise<void> | null = null
    registerSystemBackTransition(resultBack.port, () => {
      resultTransition = resetTransition()
    })
    resultBack.press()
    resultBack.press()

    const followBack = backPort()
    const leaveLock = createFollowUpLeaveLock()
    const returnPending = deferred()
    const returnParent = vi.fn(async () => returnPending.promise)
    const followNavigate = vi.fn()
    let followTransition: Promise<void> | null = null
    registerSystemBackTransition(followBack.port, () => {
      followTransition = leaveLock.run(async () => {
        await returnParent()
        followNavigate()
      }).promise
    })
    followBack.press()
    followBack.press()

    resetPending.resolve()
    returnPending.resolve()
    await resultTransition
    await followTransition

    expect(reset).toHaveBeenCalledOnce()
    expect(resultNavigate).toHaveBeenCalledOnce()
    expect(returnParent).toHaveBeenCalledOnce()
    expect(followNavigate).toHaveBeenCalledOnce()
  })
})
