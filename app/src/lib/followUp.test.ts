import { describe, expect, it } from 'vitest'
import type { FollowUp } from '@snap/shared'
import {
  buildAlternateFollowUpContext,
  createFollowUpPracticeState,
  createFollowUpCheckFence,
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
  it('invalidates a check before its first durable boundary and waits for it to settle', async () => {
    let release!: () => void
    const boundary = new Promise<void>((resolve) => { release = resolve })
    const fence = createFollowUpCheckFence()
    const run = fence.begin()
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
    const run = fence.begin()
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
})
