import { describe, expect, it } from 'vitest'
import type { FollowUp } from '@snap/shared'
import {
  buildAlternateFollowUpContext,
  beginFollowUpRouteActivation,
  canStartAlternateFollowUp,
  createFollowUpRouteGate,
  createFollowUpHandoffCoordinator,
  createFollowUpPracticeState,
  createFollowUpCheckFence,
  createFollowUpLeaveLock,
  revealFollowUpHint,
  replaceFollowUpProblem,
} from './followUp'

const initial: FollowUp = {
  concept: 'sign distribution',
  problem: 'Simplify −(x + 2).',
  hint: 'Distribute the negative to both terms.',
}

describe('follow-up practice state', () => {
  it('keeps the hint hidden until the student explicitly reveals it', () => {
    const hidden = createFollowUpPracticeState(initial)

    expect(hidden.hintVisible).toBe(false)
    expect(revealFollowUpHint(hidden).hintVisible).toBe(true)
  })

  it('replaces a problem only when the validated alternate is distinct', () => {
    const state = createFollowUpPracticeState(initial)
    const alternate: FollowUp = { ...initial, problem: 'Simplify −(3x − 4).', hint: 'Apply the negative sign to each term.' }

    expect(replaceFollowUpProblem(state, alternate)).toEqual({
      followUp: alternate,
      hintVisible: false,
      previousProblems: [initial.problem],
    })
    expect(replaceFollowUpProblem(state, { ...initial })).toBeNull()
  })

  it('accepts case and whitespace variations without changing the requested concept identity', () => {
    const state = createFollowUpPracticeState(initial)
    const replacement = replaceFollowUpProblem(state, {
      concept: '  SIGN   Distribution ',
      problem: 'Simplify −(3x − 4).',
      hint: 'Apply the negative sign to each term.',
    })

    expect(replacement?.followUp).toEqual({
      concept: 'sign distribution',
      problem: 'Simplify −(3x − 4).',
      hint: 'Apply the negative sign to each term.',
    })
  })

  it('still rejects a genuinely different concept', () => {
    const state = createFollowUpPracticeState(initial)

    expect(replaceFollowUpProblem(state, {
      concept: 'combining like terms',
      problem: 'Simplify −(3x − 4).',
      hint: 'Apply the negative sign to each term.',
    })).toBeNull()
  })

  it('keeps the alternate request history bounded while including the current problem', () => {
    let state = createFollowUpPracticeState(initial)
    for (let index = 1; index <= 7; index += 1) {
      const next = replaceFollowUpProblem(state, {
        concept: initial.concept,
        problem: `Simplify −(${index}x + ${index + 1}).`,
        hint: 'Distribute first.',
      })
      if (!next) throw new Error('expected a distinct follow-up')
      state = next
    }

    const context = buildAlternateFollowUpContext(state, 'You lost the negative sign.')
    expect(context.previousProblems).toEqual([
      'Simplify −(3x + 4).',
      'Simplify −(4x + 5).',
      'Simplify −(5x + 6).',
      'Simplify −(6x + 7).',
      'Simplify −(7x + 8).',
    ])
    expect(context.previousProblems).toHaveLength(5)
  })
})

describe('follow-up route gate', () => {
  it('rejects a pointer press that began before route activation even when released after activation', () => {
    const gate = createFollowUpRouteGate()

    gate.beginPress()
    gate.arm()

    expect(gate.consumePress()).toBe(false)
  })

  it('accepts one fresh press that begins after route activation', () => {
    const gate = createFollowUpRouteGate()
    gate.arm()

    gate.beginPress()

    expect(gate.consumePress()).toBe(true)
    expect(gate.consumePress()).toBe(false)
  })

  it('accepts deliberate non-pointer activation only after route activation', () => {
    const gate = createFollowUpRouteGate()

    expect(gate.consumeNonPointerActivation()).toBe(false)

    gate.arm()

    expect(gate.consumeNonPointerActivation()).toBe(true)
  })

  it('rejects a tokenless pointer or responder press after route activation', () => {
    const gate = createFollowUpRouteGate()
    gate.arm()

    expect(gate.consumePress()).toBe(false)
  })

  it('clears a pending press on blur', () => {
    const gate = createFollowUpRouteGate()
    gate.arm()
    gate.beginPress()

    gate.invalidate()

    expect(gate.consumePress()).toBe(false)
  })

  it('clears a press token after a canceled responder settles', async () => {
    const gate = createFollowUpRouteGate()
    gate.arm()
    gate.beginPress()

    gate.cancelPress()
    await Promise.resolve()

    expect(gate.consumePress()).toBe(false)
  })

  it('keeps a normal long-held release eligible for its synchronous onPress', async () => {
    const gate = createFollowUpRouteGate()
    gate.arm()
    gate.beginPress()

    gate.cancelPress()
    expect(gate.consumePress()).toBe(true)

    await Promise.resolve()
    expect(gate.consumePress()).toBe(false)
  })

  it('arms only after the focused route opening transition ends and unsubscribes plus disarms on blur', () => {
    const gate = createFollowUpRouteGate()
    const transitionEnds: ((event: { data: { closing: boolean } }) => void)[] = []
    let cancellations = 0
    const blur = beginFollowUpRouteActivation(gate, (listener) => {
      transitionEnds.push(listener)
      return () => { cancellations += 1 }
    })

    gate.beginPress()
    expect(gate.consumePress()).toBe(false)

    transitionEnds[0]!({ data: { closing: true } })
    gate.beginPress()
    expect(gate.consumePress()).toBe(false)

    transitionEnds[0]!({ data: { closing: false } })
    gate.beginPress()
    expect(gate.consumePress()).toBe(true)

    blur()
    expect(cancellations).toBe(1)
    gate.beginPress()
    expect(gate.consumePress()).toBe(false)
  })

  it('arms on web focus without minting a pointer token and disarms on blur', () => {
    const gate = createFollowUpRouteGate()
    let subscriptions = 0
    const blur = beginFollowUpRouteActivation(
      gate,
      () => {
        subscriptions += 1
        return () => {}
      },
      { armOnFocus: true },
    )

    expect(subscriptions).toBe(0)
    expect(gate.consumePress()).toBe(false)
    expect(gate.consumeNonPointerActivation()).toBe(true)

    blur()
    expect(gate.consumeNonPointerActivation()).toBe(false)
  })
})

describe('follow-up check fence', () => {
  it('keeps the checked problem and rejects a stale alternate press after check owns the handoff', async () => {
    const visible = createFollowUpPracticeState(initial)
    const alternate = replaceFollowUpProblem(visible, {
      ...initial,
      problem: 'Simplify −(3x − 4).',
      hint: 'Apply the negative sign to each term.',
    })
    if (alternate === null) throw new Error('expected a distinct alternate')
    const fence = createFollowUpCheckFence()
    const run = fence.begin(visible)
    if (run === null) throw new Error('expected check ownership')
    let submittedProblem: string | null = null
    const task = Promise.resolve().then(() => {
      submittedProblem = run.practice.followUp.problem
    })
    fence.track(run, task)

    expect(canStartAlternateFollowUp({
      hasPractice: true,
      hasParent: true,
      requestingAlternate: false,
      checkingWork: false,
      isLeaving: false,
      routeCurrent: true,
      checkOwned: fence.busy,
      leaveOwned: false,
    })).toBe(false)
    expect(run.practice.followUp).toEqual(visible.followUp)
    expect(run.practice.followUp).not.toEqual(alternate.followUp)
    await task
    expect(submittedProblem).toBe('Simplify −(x + 2).')
  })

  it('invalidates a check before its first durable boundary and waits for it to settle', async () => {
    let release!: () => void
    const boundary = new Promise<void>((resolve) => { release = resolve })
    const fence = createFollowUpCheckFence()
    const run = fence.begin(createFollowUpPracticeState(initial))
    if (run === null) throw new Error('expected check ownership')
    const effects: string[] = []
    const task = (async () => {
      await boundary
      if (fence.owns(run)) effects.push('persist-session')
    })()
    fence.track(run, task)

    const leaving = fence.invalidate()
    release()
    await leaving

    expect(effects).toEqual([])
  })

  it('invalidates a check after session persistence so it cannot update status or navigate', async () => {
    let release!: () => void
    const boundary = new Promise<void>((resolve) => { release = resolve })
    const fence = createFollowUpCheckFence()
    const run = fence.begin(createFollowUpPracticeState(initial))
    if (run === null) throw new Error('expected check ownership')
    const effects: string[] = []
    const task = (async () => {
      if (fence.owns(run)) effects.push('persist-session')
      await boundary
      if (fence.owns(run)) effects.push('persist-status')
      if (fence.owns(run)) effects.push('navigate')
    })()
    fence.track(run, task)

    const leaving = fence.invalidate()
    release()
    await leaving

    expect(effects).toEqual(['persist-session'])
  })

  it('consumes a rejecting tracked task during unmount-style invalidation', async () => {
    const fence = createFollowUpCheckFence()
    const run = fence.begin(createFollowUpPracticeState(initial))
    if (run === null) throw new Error('expected check ownership')
    const task = Promise.reject(new Error('state unavailable'))
    fence.track(run, task)

    await expect(fence.invalidate()).rejects.toThrow('state unavailable')
  })
})

describe('alternate follow-up local retry', () => {
  it('retries the exact generated alternate after storage failure without another request', async () => {
    const coordinator = createFollowUpHandoffCoordinator()
    const replacement = replaceFollowUpProblem(createFollowUpPracticeState(initial), {
      ...initial,
      problem: 'Simplify −(3x − 4).',
    })
    if (replacement === null) throw new Error('expected distinct alternate')
    let requestCalls = 0
    let persistCalls = 0
    const dependencies = {
      request: async () => {
        requestCalls += 1
        return replacement
      },
      persist: async (candidate: typeof replacement) => {
        persistCalls += 1
        expect(candidate).toEqual(replacement)
        if (persistCalls === 1) throw new Error('local storage unavailable')
        return true
      },
      isRouteCurrent: () => true,
    }

    const first = coordinator.startAlternate(createFollowUpPracticeState(initial), dependencies)
    await expect(first.promise).resolves.toEqual({ kind: 'storage-failed', practice: replacement })
    const retry = coordinator.startAlternate(createFollowUpPracticeState(initial), dependencies)
    await expect(retry.promise).resolves.toEqual({ kind: 'updated', practice: replacement })

    expect(requestCalls).toBe(1)
    expect(persistCalls).toBe(2)
  })

  it('requests the model again after a network generation failure', async () => {
    const coordinator = createFollowUpHandoffCoordinator()
    let requestCalls = 0
    const dependencies = {
      request: async () => {
        requestCalls += 1
        if (requestCalls === 1) throw new Error('network unavailable')
        return replaceFollowUpProblem(createFollowUpPracticeState(initial), {
          ...initial,
          problem: 'Simplify −(3x − 4).',
        })
      },
      persist: async () => true,
      isRouteCurrent: () => true,
    }

    await expect(coordinator.startAlternate(createFollowUpPracticeState(initial), dependencies).promise)
      .rejects.toThrow('network unavailable')
    await expect(coordinator.startAlternate(createFollowUpPracticeState(initial), dependencies).promise)
      .resolves.toMatchObject({ kind: 'updated' })
    expect(requestCalls).toBe(2)
  })
})

describe('follow-up leave lock', () => {
  it('coalesces repeated Back taps into one owned leave operation', async () => {
    const lock = createFollowUpLeaveLock()
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    let calls = 0

    const first = lock.run(async () => { calls += 1; await pending })
    const second = lock.run(async () => { calls += 1 })
    const third = lock.run(async () => { calls += 1 })

    expect(first.started).toBe(true)
    expect(second.started).toBe(false)
    expect(third.started).toBe(false)
    expect(lock.busy).toBe(true)
    release()
    await Promise.all([first.promise, second.promise, third.promise])
    expect(calls).toBe(1)
    expect(lock.busy).toBe(false)
  })

  it('clears after a leave failure so retry owns a new operation', async () => {
    const lock = createFollowUpLeaveLock()
    const failed = lock.run(async () => { throw new Error('state unavailable') })

    await expect(failed.promise).rejects.toThrow('state unavailable')
    const retry = lock.run(async () => {})

    expect(retry.started).toBe(true)
    await expect(retry.promise).resolves.toBeUndefined()
  })
})
