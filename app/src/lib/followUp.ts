import type { AlternateFollowUpContext, FollowUp } from '@snap/shared'

const MAX_PREVIOUS_PROBLEMS = 5

export type FollowUpPracticeState = {
  followUp: FollowUp
  hintVisible: boolean
  previousProblems: string[]
}

export type FollowUpCheckRun = {
  readonly token: number
  readonly practice: FollowUpPracticeState
}

export type FollowUpCheckFence = {
  readonly busy: boolean
  begin(practice: FollowUpPracticeState): FollowUpCheckRun | null
  owns(run: FollowUpCheckRun): boolean
  track(run: FollowUpCheckRun, task: Promise<void>): void
  invalidate(): Promise<void>
}

export type FollowUpLeaveLock = {
  readonly busy: boolean
  run(task: () => Promise<void>): { started: boolean; promise: Promise<void> }
}

export type FollowUpRouteGate = {
  arm(): void
  canCheck(): boolean
  invalidate(): void
}

export type FollowUpAlternateResult =
  | { kind: 'updated'; practice: FollowUpPracticeState }
  | { kind: 'storage-failed'; practice: FollowUpPracticeState }
  | { kind: 'duplicate' }
  | { kind: 'stale' }

type FollowUpOperation<T> = {
  started: boolean
  promise: Promise<T>
}

export type FollowUpHandoffCoordinator = {
  readonly alternateBusy: boolean
  readonly checkBusy: boolean
  startAlternate(
    practice: FollowUpPracticeState,
    dependencies: {
      request(signal: AbortSignal): Promise<FollowUpPracticeState | null>
      persist(practice: FollowUpPracticeState, isCurrent: () => boolean): Promise<boolean>
      isRouteCurrent(): boolean
    },
  ): FollowUpOperation<FollowUpAlternateResult>
  startCheck(
    practice: FollowUpPracticeState,
    dependencies: {
      persist(practice: FollowUpPracticeState, isCurrent: () => boolean): Promise<boolean>
      isRouteCurrent(): boolean
    },
  ): FollowUpOperation<boolean>
  invalidate(): Promise<void>
}

export function createFollowUpHandoffCoordinator(): FollowUpHandoffCoordinator {
  const checkFence = createFollowUpCheckFence()
  let alternateController: AbortController | null = null
  let cachedAlternate: FollowUpPracticeState | null = null

  return {
    get alternateBusy() { return alternateController !== null },
    get checkBusy() { return checkFence.busy },
    startAlternate(practice, dependencies) {
      if (alternateController !== null || checkFence.busy)
        return { started: false, promise: Promise.resolve({ kind: 'stale' as const }) }
      const controller = new AbortController()
      alternateController = controller
      const owns = () => (
        alternateController === controller
        && !checkFence.busy
        && dependencies.isRouteCurrent()
      )
      const promise = (async (): Promise<FollowUpAlternateResult> => {
        try {
          const replacement = cachedAlternate ?? await dependencies.request(controller.signal)
          if (!owns()) return { kind: 'stale' }
          if (replacement === null) return { kind: 'duplicate' }
          let persisted: boolean
          try {
            persisted = await dependencies.persist(replacement, owns)
          } catch {
            if (!owns()) return { kind: 'stale' }
            cachedAlternate = replacement
            return { kind: 'storage-failed', practice: replacement }
          }
          if (!persisted || !owns()) return { kind: 'stale' }
          cachedAlternate = null
          return { kind: 'updated', practice: replacement }
        } catch (error) {
          if (!owns()) return { kind: 'stale' }
          throw error
        } finally {
          if (alternateController === controller) alternateController = null
        }
      })()
      return { started: true, promise }
    },
    startCheck(practice, dependencies) {
      const run = checkFence.begin(practice)
      if (run === null) return { started: false, promise: Promise.resolve(false) }
      const invalidatedAlternate = alternateController
      alternateController = null
      cachedAlternate = null
      invalidatedAlternate?.abort()
      const owns = () => checkFence.owns(run) && dependencies.isRouteCurrent()
      const promise = (async () => {
        if (!owns()) return false
        const persisted = await dependencies.persist(run.practice, owns)
        return persisted && owns()
      })()
      checkFence.track(run, promise.then(() => undefined))
      return { started: true, promise }
    },
    async invalidate() {
      const invalidatedAlternate = alternateController
      alternateController = null
      cachedAlternate = null
      invalidatedAlternate?.abort()
      await checkFence.invalidate()
    },
  }
}

export type AlternateFollowUpStartState = {
  hasPractice: boolean
  hasParent: boolean
  requestingAlternate: boolean
  checkingWork: boolean
  isLeaving: boolean
  routeCurrent: boolean
  checkOwned: boolean
  leaveOwned: boolean
}

export function canStartAlternateFollowUp(state: AlternateFollowUpStartState): boolean {
  return state.hasPractice
    && state.hasParent
    && !state.requestingAlternate
    && !state.checkingWork
    && !state.isLeaving
    && state.routeCurrent
    && !state.checkOwned
    && !state.leaveOwned
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

export function createFollowUpRouteGate(): FollowUpRouteGate {
  let armed = false
  return {
    arm() { armed = true },
    canCheck() { return armed },
    invalidate() { armed = false },
  }
}

export function beginFollowUpRouteActivation(
  gate: FollowUpRouteGate,
  schedule: (activate: () => void) => () => void,
): () => void {
  gate.invalidate()
  const cancel = schedule(() => gate.arm())
  return () => {
    cancel()
    gate.invalidate()
  }
}

export function createFollowUpCheckFence(): FollowUpCheckFence {
  let generation = 0
  let activeRun: FollowUpCheckRun | null = null
  let pending: Promise<void> = Promise.resolve()

  return {
    get busy() { return activeRun !== null },
    begin(practice) {
      if (activeRun !== null) return null
      generation += 1
      const run = {
        token: generation,
        practice: {
          followUp: { ...practice.followUp },
          hintVisible: practice.hintVisible,
          previousProblems: [...practice.previousProblems],
        },
      }
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

function normalizeConceptIdentity(concept: string): string {
  return concept.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

export function replaceFollowUpProblem(state: FollowUpPracticeState, alternate: FollowUp): FollowUpPracticeState | null {
  if (
    normalizeConceptIdentity(state.followUp.concept) !== normalizeConceptIdentity(alternate.concept)
    || state.followUp.problem === alternate.problem
    || state.previousProblems.includes(alternate.problem)
  ) return null
  return {
    followUp: { ...alternate, concept: state.followUp.concept },
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
