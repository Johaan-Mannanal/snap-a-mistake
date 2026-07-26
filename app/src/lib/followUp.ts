import type { AlternateFollowUpContext, FollowUp } from '@snap/shared'

const MAX_PREVIOUS_PROBLEMS = 5

export type FollowUpPracticeState = {
  followUp: FollowUp
  hintVisible: boolean
  previousProblems: string[]
}

export type FollowUpCheckRun = { readonly token: number }

export type FollowUpCheckFence = {
  begin(): FollowUpCheckRun
  owns(run: FollowUpCheckRun): boolean
  track(run: FollowUpCheckRun, task: Promise<void>): void
  invalidate(): Promise<void>
}

export type FollowUpLeaveLock = {
  readonly busy: boolean
  run(task: () => Promise<void>): { started: boolean; promise: Promise<void> }
}

export function createFollowUpLeaveLock(): FollowUpLeaveLock {
  let active: Promise<void> | null = null
  return {
    get busy() { return active !== null },
    run(task) {
      if (active) return { started: false, promise: active }
      const current = task().finally(() => {
        if (active === current) active = null
      })
      active = current
      return { started: true, promise: current }
    },
  }
}

export function createFollowUpCheckFence(): FollowUpCheckFence {
  let generation = 0
  let activeRun: FollowUpCheckRun | null = null
  let pending: Promise<void> = Promise.resolve()

  return {
    begin() {
      generation += 1
      const run = { token: generation }
      activeRun = run
      return run
    },
    owns(run) {
      return activeRun === run && generation === run.token
    },
    track(run, task) {
      const settled = task.finally(() => {
        if (activeRun === run) activeRun = null
        if (pending === settled) pending = Promise.resolve()
      })
      void settled.catch(() => {})
      pending = settled
    },
    async invalidate() {
      generation += 1
      activeRun = null
      await pending
    },
  }
}

export function createFollowUpPracticeState(followUp: FollowUp): FollowUpPracticeState {
  return { followUp, hintVisible: false, previousProblems: [] }
}

export function revealFollowUpHint(state: FollowUpPracticeState): FollowUpPracticeState {
  return { ...state, hintVisible: true }
}

export function replaceFollowUpProblem(state: FollowUpPracticeState, alternate: FollowUp): FollowUpPracticeState | null {
  if (state.followUp.concept !== alternate.concept || state.followUp.problem === alternate.problem || state.previousProblems.includes(alternate.problem)) return null
  return {
    followUp: alternate,
    hintVisible: false,
    previousProblems: [...state.previousProblems, state.followUp.problem].slice(-(MAX_PREVIOUS_PROBLEMS - 1)),
  }
}

export function buildAlternateFollowUpContext(state: FollowUpPracticeState, diagnosis: string): AlternateFollowUpContext {
  return {
    concept: state.followUp.concept,
    diagnosis,
    previousProblems: [...state.previousProblems, state.followUp.problem].slice(-MAX_PREVIOUS_PROBLEMS),
  }
}
