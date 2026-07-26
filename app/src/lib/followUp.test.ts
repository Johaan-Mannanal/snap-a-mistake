import { describe, expect, it } from 'vitest'
import type { FollowUp } from '@snap/shared'
import {
  buildAlternateFollowUpContext,
  canStartAlternateFollowUp,
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
