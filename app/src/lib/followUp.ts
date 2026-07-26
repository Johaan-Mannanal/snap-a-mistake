import type { AlternateFollowUpContext, FollowUp } from '@snap/shared'

const MAX_PREVIOUS_PROBLEMS = 5

export type FollowUpPracticeState = {
  followUp: FollowUp
  hintVisible: boolean
  previousProblems: string[]
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
