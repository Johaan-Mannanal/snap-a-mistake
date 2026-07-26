import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalyzeResponse } from '@snap/shared'
import type { ScanRepository } from './scanRepository'
import {
  getFollowUpPractice,
  getSession,
  hydrateSession,
  replacePendingPhoto,
  resetSession,
  setPendingPhoto,
  setReviewedPhoto,
  startFollowUp,
  takeHydratedRouteIntent,
  returnFromFollowUp,
  resumeFollowUpCapture,
  beginFollowUp,
} from './session'
import {
  createReviewTransaction,
  createReviewMutationCoordinator,
  resumeReviewTransaction,
  advanceReviewTransaction,
} from './reviewTransaction'
import { createFollowUpHandoffCoordinator, replaceFollowUpProblem, type FollowUpPracticeState } from './followUp'
import { initialAnalysisEntry } from './analysisEntry'
import { PersistedSessionSchema } from './scanTypes'

const followUp = {
  problem: 'Simplify −(3x − 4).',
  concept: 'sign distribution',
  hint: 'Apply the negative sign to each term.',
}

const result: AnalyzeResponse = {
  kind: 'analysis',
  steps: [{
    index: 0, latex: '-(x + 2) = -x + 2', plain: 'negative x plus 2',
    yBandTopPct: 20, yBandBottomPct: 30, verdict: 'wrong',
  }],
  errorStepIndex: 0,
  misconceptionTag: 'sign-error',
  explanation: 'The sign changed.',
  followUp,
  verifierAgreed: true,
}

class SessionRepository {
  state: unknown = null
  lifecycle: string | null = null
  parentFollowUp = followUp
  committedResponse: AnalyzeResponse | null = null

  async getState<T>(_key: string, schema: { safeParse(value: unknown): { success: boolean; data?: T } }): Promise<T | null> {
    const parsed = schema.safeParse(this.state)
    return parsed.success ? parsed.data! : null
  }

  async setState(_key: string, value: unknown): Promise<void> {
    this.state = value
  }

  async deleteState(): Promise<void> {
    this.state = null
  }

  async interruptAnalysisAndRestoreSession(scanId: string, value: unknown) {
    expect(scanId).toMatch(/^(scan-1|child-1)$/)
    const review = PersistedSessionSchema.parse(value)
    if (this.committedResponse !== null) {
      const restored = {
        ...review,
        routeIntent: 'result' as const,
        analysis: this.committedResponse,
      }
      this.state = restored
      return restored
    }
    this.lifecycle = 'interrupted'
    this.state = review
    return review
  }

  async commitFollowUpStartIfCurrent(
    _parentScanId: string,
    value: unknown,
    _targetStatus: 'in-progress',
    isCurrent: () => boolean,
  ): Promise<boolean> {
    if (!isCurrent()) return false
    const persisted = PersistedSessionSchema.parse(value)
    this.state = persisted
    this.parentFollowUp = persisted.followUp ?? this.parentFollowUp
    return true
  }

  async get(scanId: string) {
    if (scanId !== 'parent-1') return null
    return {
      id: scanId,
      imageUri: 'file:///documents/scans/parent-1.jpg',
      origin: 'camera',
      parentScanId: null,
      activeRevision: { response: result },
      followUp: this.parentFollowUp,
    }
  }

  async commitFollowUpReturnIfCurrent(
    _parentScanId: string,
    value: unknown,
    isCurrent: () => boolean,
  ): Promise<boolean> {
    if (!isCurrent()) return false
    this.state = value
    return true
  }
}

beforeEach(async () => {
  await resetSession()
})

describe('cold-start state recovery', () => {
  it('commits an interrupted scan row and review session before exposing one route intent', async () => {
    const repository = new SessionRepository()
    repository.state = {
      routeIntent: 'analyze', pendingScanId: 'scan-1',
      photoUri: 'file:///documents/scans/scan-1.jpg', origin: 'camera',
      analysis: null, followUp: null, parentScanId: null,
    }

    await hydrateSession(repository as unknown as ScanRepository)

    expect(repository.lifecycle).toBe('interrupted')
    expect(repository.state).toMatchObject({ routeIntent: 'review', pendingScanId: 'scan-1' })
    expect(takeHydratedRouteIntent()).toBe('review')
    expect(takeHydratedRouteIntent()).toBeNull()
  })

  it('restores a cold result without scheduling a new analysis request', async () => {
    const repository = new SessionRepository()
    repository.state = {
      routeIntent: 'result', pendingScanId: 'scan-1',
      photoUri: 'file:///documents/scans/scan-1.jpg', origin: 'camera',
      analysis: result, followUp, parentScanId: null,
    }

    await hydrateSession(repository as unknown as ScanRepository)

    expect(takeHydratedRouteIntent()).toBe('result')
    expect(initialAnalysisEntry(getSession())).toEqual({
      result,
      shouldRun: false,
      restoredResult: true,
    })
  })

  it('prefers a committed revision when the session still says analyze', async () => {
    const repository = new SessionRepository()
    repository.committedResponse = result
    repository.state = {
      routeIntent: 'analyze', pendingScanId: 'scan-1',
      photoUri: 'file:///documents/scans/scan-1.jpg', origin: 'camera',
      analysis: null, followUp: null, parentScanId: null,
    }

    await hydrateSession(repository as unknown as ScanRepository)

    expect(repository.lifecycle).toBeNull()
    expect(takeHydratedRouteIntent()).toBe('result')
    expect(initialAnalysisEntry(getSession())).toMatchObject({
      result,
      shouldRun: false,
      restoredResult: true,
    })
  })

  it('does not let a camera callback silently replace a recoverable draft', async () => {
    const repository = new SessionRepository()
    await hydrateSession(repository as unknown as ScanRepository)
    await setPendingPhoto({ uri: 'file:///cache/first.jpg', origin: 'camera' })

    await expect(setPendingPhoto({ uri: 'file:///cache/late.jpg', origin: 'camera' }))
      .rejects.toThrow('active draft')
    expect(getSession().photoUri).toBe('file:///cache/first.jpg')
  })
})

describe('same-photo retry and replacement ownership', () => {
  it('reuses the interrupted scan and owned image without copying or creating another draft', async () => {
    const transaction = resumeReviewTransaction(
      'scan-1',
      'file:///documents/scans/scan-1.jpg',
      true,
    )
    const ownPhoto = vi.fn()
    const createDraft = vi.fn()

    await advanceReviewTransaction(transaction, {
      origin: 'camera', attemptKind: 'original', parentScanId: null,
      createdAt: '2026-07-25T12:00:00.000Z',
    }, {
      ownPhoto,
      findDraft: vi.fn(async () => true),
      createDraft,
      persistReviewedPhoto: vi.fn(async () => {}),
      acknowledgeDisclosure: vi.fn(async () => {}),
    })

    expect(transaction.scanId).toBe('scan-1')
    expect(ownPhoto).not.toHaveBeenCalled()
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('keeps follow-up practice through capture, replacement, durable review, and restart', async () => {
    const repository = new SessionRepository()
    await hydrateSession(repository as unknown as ScanRepository)
    await startFollowUp('parent-1', followUp, {
      hintVisible: true,
      previousProblems: ['Simplify −(x + 2).'],
    })
    await setPendingPhoto({ uri: 'file:///cache/first.jpg', origin: 'camera' })
    await replacePendingPhoto({ uri: 'file:///cache/replacement.jpg', origin: 'library' })
    await setReviewedPhoto({
      scanId: 'child-1',
      uri: 'file:///documents/scans/child-1.jpg',
      origin: 'library',
      parentScanId: 'parent-1',
    })
    await hydrateSession(repository as unknown as ScanRepository)

    expect(getSession()).toMatchObject({
      routeIntent: 'review',
      pendingScanId: 'child-1',
      parentScanId: 'parent-1',
      followUp,
    })
    expect(getFollowUpPractice()).toEqual({
      followUp,
      hintVisible: true,
      previousProblems: ['Simplify −(x + 2).'],
    })
  })

  it('keeps the checked problem durable when a pending alternate resolves after camera handoff', async () => {
    const checkedProblem = {
      problem: 'Simplify −(3x − 4).',
      concept: 'sign distribution',
      hint: 'Apply the negative sign to each term.',
    }
    const lateAlternate = {
      problem: 'Simplify −(5x + 1).',
      concept: 'sign distribution',
      hint: 'Distribute the negative to both terms.',
    }
    const repository = new SessionRepository()
    repository.state = {
      routeIntent: 'result', pendingScanId: 'parent-1',
      photoUri: 'file:///documents/scans/parent-1.jpg', origin: 'camera',
      analysis: result, followUp: checkedProblem, parentScanId: null,
    }
    repository.parentFollowUp = checkedProblem
    await hydrateSession(repository as unknown as ScanRepository)
    await startFollowUp('parent-1', checkedProblem)
    const visiblePractice = getFollowUpPractice()
    if (visiblePractice === null) throw new Error('expected visible practice')
    const coordinator = createFollowUpHandoffCoordinator()
    let resolveAlternate!: (practice: FollowUpPracticeState) => void
    const pendingAlternate = new Promise<FollowUpPracticeState>((resolve) => { resolveAlternate = resolve })
    let alternateStarted = false
    let alternatePersistCalls = 0

    const alternate = coordinator.startAlternate(visiblePractice, {
      request: async () => {
        alternateStarted = true
        return pendingAlternate
      },
      persist: (replacement, isCurrent) => {
        alternatePersistCalls += 1
        return startFollowUp('parent-1', replacement.followUp, {
          hintVisible: replacement.hintVisible,
          previousProblems: replacement.previousProblems,
          isCurrent,
        })
      },
      isRouteCurrent: () => true,
    })
    expect(alternate.started).toBe(true)
    expect(alternateStarted).toBe(true)

    const check = coordinator.startCheck(visiblePractice, {
      persist: (snapshot, isCurrent) => startFollowUp('parent-1', snapshot.followUp, {
        hintVisible: snapshot.hintVisible,
        previousProblems: snapshot.previousProblems,
        isCurrent,
      }),
      isRouteCurrent: () => true,
    })
    expect(check.started).toBe(true)
    let cameraHandoffs = 0
    if (await check.promise) cameraHandoffs += 1

    const replacement = replaceFollowUpProblem(visiblePractice, lateAlternate)
    if (replacement === null) throw new Error('expected distinct late alternate')
    resolveAlternate(replacement)
    await expect(alternate.promise).resolves.toEqual({ kind: 'stale' })

    expect(cameraHandoffs).toBe(1)
    expect(alternatePersistCalls).toBe(0)
    expect(repository.parentFollowUp).toEqual(checkedProblem)
    expect(repository.state).toMatchObject({
      routeIntent: 'follow-up',
      parentScanId: 'parent-1',
      followUp: checkedProblem,
    })
    expect(getSession()).toMatchObject({
      routeIntent: 'follow-up',
      parentScanId: 'parent-1',
      followUp: checkedProblem,
    })

    await setPendingPhoto({ uri: 'file:///cache/child.jpg', origin: 'camera' })
    let childDraft: { parentScanId: string | null } | null = null
    await advanceReviewTransaction(
      createReviewTransaction('child-1', true),
      {
        origin: 'camera',
        attemptKind: 'follow-up',
        parentScanId: 'parent-1',
        createdAt: '2026-07-26T12:00:00.000Z',
      },
      {
        ownPhoto: async () => 'file:///documents/scans/child-1.jpg',
        findDraft: async () => false,
        createDraft: async (draft) => { childDraft = { parentScanId: draft.parentScanId } },
        persistReviewedPhoto: setReviewedPhoto,
        acknowledgeDisclosure: async () => {},
      },
    )

    expect(childDraft).toEqual({ parentScanId: 'parent-1' })
    expect(repository.parentFollowUp).toEqual(checkedProblem)
    expect(getSession()).toMatchObject({
      routeIntent: 'analyze',
      pendingScanId: 'child-1',
      parentScanId: 'parent-1',
      followUp: checkedProblem,
    })
  })

  it('returns a resumable practice session to the parent result instead of leaving stale follow-up intent', async () => {
    const repository = new SessionRepository()
    repository.state = {
      routeIntent: 'result', pendingScanId: 'parent-1',
      photoUri: 'file:///documents/scans/parent-1.jpg', origin: 'camera',
      analysis: result, followUp, parentScanId: null,
    }
    await hydrateSession(repository as unknown as ScanRepository)
    await startFollowUp('parent-1', followUp)

    await returnFromFollowUp('parent-1')

    expect(getSession()).toMatchObject({
      routeIntent: 'result',
      pendingScanId: 'parent-1',
      analysis: result,
    })
  })

  it('reopens the parent’s accepted alternate instead of the revision’s original problem', async () => {
    const repository = new SessionRepository()
    const acceptedAlternate = { ...followUp, problem: 'Simplify −(5x + 1).' }
    repository.parentFollowUp = acceptedAlternate
    repository.state = {
      routeIntent: 'result', pendingScanId: 'parent-1',
      photoUri: 'file:///documents/scans/parent-1.jpg', origin: 'camera',
      analysis: result, followUp, parentScanId: null,
    }
    await hydrateSession(repository as unknown as ScanRepository)

    await beginFollowUp('parent-1')

    expect(getSession()).toMatchObject({
      routeIntent: 'follow-up',
      parentScanId: 'parent-1',
      followUp: acceptedAlternate,
    })
  })

  it('returns a follow-up retake to camera with the same problem and parent', async () => {
    const repository = new SessionRepository()
    await hydrateSession(repository as unknown as ScanRepository)
    await startFollowUp('parent-1', followUp, { hintVisible: true })
    await setPendingPhoto({ uri: 'file:///cache/attempt.jpg', origin: 'camera' })

    await resumeFollowUpCapture()

    expect(getSession()).toMatchObject({
      routeIntent: 'follow-up',
      pendingScanId: null,
      photoUri: null,
      parentScanId: 'parent-1',
      followUp,
      followUpHintVisible: true,
    })
  })
})

describe('Review mutation ownership', () => {
  it('holds one lock across a native picker await and fences its late result after invalidation', async () => {
    const coordinator = createReviewMutationCoordinator()
    let releasePicker!: () => void
    const picker = new Promise<void>((resolve) => { releasePicker = resolve })
    const effects: string[] = []

    const choose = coordinator.run(async (owns) => {
      await picker
      if (owns()) effects.push('replace')
    })
    const analyze = coordinator.run(async () => { effects.push('analyze') })
    const retake = coordinator.run(async () => { effects.push('retake') })

    expect(coordinator.busy).toBe(true)
    await expect(analyze).resolves.toBe(false)
    await expect(retake).resolves.toBe(false)
    coordinator.invalidate()
    releasePicker()
    await expect(choose).resolves.toBe(true)
    expect(effects).toEqual([])
  })
})
