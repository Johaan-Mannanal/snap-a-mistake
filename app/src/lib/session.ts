import type { AnalyzeResponse, FollowUp } from '@snap/shared'
import { z } from 'zod'
import { PersistedSessionSchema, type PersistedSession, type ScanOrigin } from './scanTypes'
import type { ScanRepository } from './scanRepository'
import type { FollowUpPracticeState } from './followUp'

const PRIVACY_DISCLOSURE_KEY = 'privacy-disclosure-v1'
const PrivacyDisclosureSchema = z.object({ acknowledged: z.literal(true) })

export type Session = {
  routeIntent: PersistedSession['routeIntent']
  pendingScanId: string | null
  photoUri: string | null
  origin: ScanOrigin | null
  analysis: AnalyzeResponse | null
  followUp: FollowUp | null
  followUpHintVisible: boolean
  previousFollowUpProblems: string[]
  parentScanId: string | null
  isRetry: boolean
  isInterrupted: boolean
}

type SessionCommitOptions = {
  isCurrent?: () => boolean
  hintVisible?: boolean
  previousProblems?: string[]
}

export type ReviewedPhoto = {
  scanId: string
  uri: string
  origin: ScanOrigin
  parentScanId?: string | null
}

const ACTIVE_SESSION_KEY = 'active-session'

function emptySession(): Session {
  return {
    routeIntent: 'capture', pendingScanId: null, photoUri: null, origin: null,
    analysis: null, followUp: null, followUpHintVisible: false, previousFollowUpProblems: [],
    parentScanId: null, isRetry: false, isInterrupted: false,
  }
}

let session: Session = emptySession()
let sessionRepository: ScanRepository | null = null
let privacyDisclosureAcknowledged = false
let hydratedRouteIntent: PersistedSession['routeIntent'] | null = null

function persisted(sessionValue: Session): PersistedSession {
  return PersistedSessionSchema.parse({
    routeIntent: sessionValue.routeIntent,
    pendingScanId: sessionValue.pendingScanId,
    photoUri: sessionValue.photoUri,
    origin: sessionValue.origin,
    analysis: sessionValue.analysis,
    followUp: sessionValue.followUp,
    followUpHintVisible: sessionValue.followUpHintVisible,
    previousFollowUpProblems: sessionValue.previousFollowUpProblems,
    parentScanId: sessionValue.parentScanId,
  })
}

function fromPersisted(value: PersistedSession, isInterrupted = false): Session {
  return {
    ...value,
    isRetry: value.routeIntent === 'follow-up' || (value.routeIntent === 'review' && value.parentScanId !== null),
    isInterrupted,
  }
}

async function commit(next: Session): Promise<void> {
  const state = persisted(next)
  if (sessionRepository) await sessionRepository.setState(ACTIVE_SESSION_KEY, state)
  session = next
}

export function getSession(): Session {
  return session
}

export async function hydrateSession(repository: ScanRepository): Promise<Session> {
  sessionRepository = repository
  hydratedRouteIntent = null
  privacyDisclosureAcknowledged = (await repository.getState(PRIVACY_DISCLOSURE_KEY, PrivacyDisclosureSchema)) !== null
  const stored = await repository.getState<PersistedSession>(ACTIVE_SESSION_KEY, PersistedSessionSchema)
  if (stored === null) {
    session = emptySession()
    await repository.deleteState(ACTIVE_SESSION_KEY)
    return session
  }

  if (stored.routeIntent === 'analyze') {
    if (stored.pendingScanId === null) throw new Error('persisted analysis is missing its scan ID')
    const interrupted = fromPersisted({ ...stored, routeIntent: 'review' }, true)
    const recovered = await repository.interruptAnalysisAndRestoreSession(stored.pendingScanId, persisted(interrupted))
    session = fromPersisted(recovered, recovered.routeIntent === 'review')
    hydratedRouteIntent = recovered.routeIntent
    return session
  }

  session = fromPersisted(stored)
  hydratedRouteIntent = stored.routeIntent
  return session
}

export function takeHydratedRouteIntent(): PersistedSession['routeIntent'] | null {
  const intent = hydratedRouteIntent
  hydratedRouteIntent = null
  return intent
}

export function isPrivacyDisclosureAcknowledged(): boolean {
  return privacyDisclosureAcknowledged
}

export async function acknowledgePrivacyDisclosure(): Promise<void> {
  if (privacyDisclosureAcknowledged) return
  if (sessionRepository) await sessionRepository.setState(PRIVACY_DISCLOSURE_KEY, { acknowledged: true })
  privacyDisclosureAcknowledged = true
}

export async function setPendingPhoto(input: { uri: string; origin: ScanOrigin }): Promise<void> {
  if (session.photoUri !== null)
    throw new Error('an active draft must be reviewed, replaced, or discarded before a new capture')
  const parentScanId = session.routeIntent === 'follow-up' ? session.parentScanId : null
  const followUp = parentScanId === null ? null : session.followUp
  await commit({
    routeIntent: 'review', pendingScanId: null, photoUri: input.uri, origin: input.origin,
    analysis: null, followUp,
    followUpHintVisible: followUp === null ? false : session.followUpHintVisible,
    previousFollowUpProblems: followUp === null ? [] : session.previousFollowUpProblems,
    parentScanId, isRetry: parentScanId !== null, isInterrupted: false,
  })
}

export async function replacePendingPhoto(input: { uri: string; origin: ScanOrigin }): Promise<void> {
  const parentScanId = session.routeIntent === 'review' ? session.parentScanId : null
  const followUp = parentScanId === null ? null : session.followUp
  await commit({
    routeIntent: 'review', pendingScanId: null, photoUri: input.uri, origin: input.origin,
    analysis: null, followUp,
    followUpHintVisible: followUp === null ? false : session.followUpHintVisible,
    previousFollowUpProblems: followUp === null ? [] : session.previousFollowUpProblems,
    parentScanId, isRetry: parentScanId !== null, isInterrupted: false,
  })
}

export async function setReviewedPhoto(input: ReviewedPhoto): Promise<void> {
  const parentScanId = input.parentScanId ?? null
  const followUp = parentScanId !== null && parentScanId === session.parentScanId ? session.followUp : null
  await commit({
    routeIntent: 'analyze', pendingScanId: input.scanId, photoUri: input.uri, origin: input.origin,
    analysis: null, followUp,
    followUpHintVisible: followUp === null ? false : session.followUpHintVisible,
    previousFollowUpProblems: followUp === null ? [] : session.previousFollowUpProblems,
    parentScanId, isRetry: parentScanId !== null, isInterrupted: false,
  })
}

export async function persistAnalysis(scanId: string, response: AnalyzeResponse, durationMs: number): Promise<void> {
  if (!Number.isInteger(durationMs) || durationMs < 0) throw new Error('durationMs must be a non-negative integer')
  await commit(resultSession(scanId, response))
}

export function resultSession(scanId: string, response: AnalyzeResponse): Session {
  return {
    routeIntent: 'result', pendingScanId: scanId, photoUri: session.photoUri, origin: session.origin,
    analysis: response, followUp: response.kind === 'analysis' ? response.followUp : null,
    followUpHintVisible: false, previousFollowUpProblems: [],
    parentScanId: session.parentScanId, isRetry: false, isInterrupted: false,
  }
}

export function adoptResultSession(scanId: string, response: AnalyzeResponse): void {
  session = resultSession(scanId, response)
}

export function reviewSession(): Session {
  if (session.photoUri === null || session.origin === null) throw new Error('a reviewed photo is required')
  return {
    ...session,
    routeIntent: 'review',
    analysis: null,
    followUp: session.parentScanId === null ? null : session.followUp,
    followUpHintVisible: session.parentScanId === null ? false : session.followUpHintVisible,
    previousFollowUpProblems: session.parentScanId === null ? [] : session.previousFollowUpProblems,
    isRetry: session.parentScanId !== null,
    isInterrupted: false,
  }
}

export function adoptReviewSession(): void {
  session = reviewSession()
}

export function startFollowUp(parentScanId: string, followUp: FollowUp, options: SessionCommitOptions = {}): Promise<boolean> {
  const next: Session = {
    routeIntent: 'follow-up', pendingScanId: null, photoUri: null, origin: null,
    analysis: null, followUp,
    followUpHintVisible: options.hintVisible ?? false,
    previousFollowUpProblems: options.previousProblems ?? [],
    parentScanId, isRetry: true, isInterrupted: false,
  }
  const base = persisted(session)
  const isCurrent = () => (
    (options.isCurrent?.() ?? true)
    && JSON.stringify(persisted(session)) === JSON.stringify(base)
  )
  if (!isCurrent()) return Promise.resolve(false)
  if (!sessionRepository) {
    session = next
    return Promise.resolve(true)
  }
  return sessionRepository.commitFollowUpStartIfCurrent(parentScanId, persisted(next), 'in-progress', isCurrent).then((committed) => {
    if (committed) session = next
    return committed
  })
}

export async function beginFollowUp(parentScanId: string, options: SessionCommitOptions = {}): Promise<boolean> {
  if (!sessionRepository) return false
  const base = persisted(session)
  const parent = await sessionRepository.get(parentScanId)
  const followUp = parent?.followUp
    ?? (parent?.activeRevision?.response.kind === 'analysis' ? parent.activeRevision.response.followUp : null)
  if (followUp === null || followUp === undefined) throw new Error('parent follow-up is unavailable')
  const isCurrent = () => (
    (options.isCurrent?.() ?? true)
    && JSON.stringify(persisted(session)) === JSON.stringify(base)
  )
  if (!isCurrent()) return false
  return startFollowUp(parentScanId, followUp, { ...options, isCurrent })
}

export function getFollowUpPractice(): FollowUpPracticeState | null {
  if (session.followUp === null) return null
  return {
    followUp: session.followUp,
    hintVisible: session.followUpHintVisible,
    previousProblems: [...session.previousFollowUpProblems],
  }
}

export async function returnFromFollowUp(parentScanId: string, options: SessionCommitOptions = {}): Promise<boolean> {
  if (!sessionRepository) return false
  const base = persisted(session)
  const parent = await sessionRepository.get(parentScanId)
  const response = parent?.activeRevision?.response
  if (!parent || !response) throw new Error('parent result is unavailable')
  const next: Session = {
    routeIntent: 'result',
    pendingScanId: parent.id,
    photoUri: parent.imageUri,
    origin: parent.origin,
    analysis: response,
    followUp: response.kind === 'analysis' ? response.followUp : null,
    followUpHintVisible: false,
    previousFollowUpProblems: [],
    parentScanId: parent.parentScanId,
    isRetry: false,
    isInterrupted: false,
  }
  const isCurrent = () => (
    (options.isCurrent?.() ?? true)
    && JSON.stringify(persisted(session)) === JSON.stringify(base)
  )
  if (!isCurrent()) return false
  const committed = await sessionRepository.commitFollowUpReturnIfCurrent(
    parentScanId,
    persisted(next),
    isCurrent,
  )
  if (committed) session = next
  return committed
}

export async function resumeFollowUpCapture(options: SessionCommitOptions = {}): Promise<boolean> {
  if (session.parentScanId === null || session.followUp === null)
    throw new Error('follow-up capture is unavailable')
  return startFollowUp(session.parentScanId, session.followUp, {
    ...options,
    hintVisible: session.followUpHintVisible,
    previousProblems: session.previousFollowUpProblems,
  })
}

export async function resetSession(options: { preserveDraft?: boolean } = {}): Promise<void> {
  const preserveDraft = options.preserveDraft && session.photoUri !== null && session.origin !== null
  const next = preserveDraft
    ? {
        ...session,
        routeIntent: 'review' as const,
        analysis: null,
        followUp: session.parentScanId === null ? null : session.followUp,
        followUpHintVisible: session.parentScanId === null ? false : session.followUpHintVisible,
        previousFollowUpProblems: session.parentScanId === null ? [] : session.previousFollowUpProblems,
        isRetry: session.parentScanId !== null,
        isInterrupted: false,
      }
    : emptySession()
  if (!sessionRepository) {
    session = next
    return
  }
  if (next.routeIntent === 'capture') {
    await sessionRepository.deleteState(ACTIVE_SESSION_KEY)
    session = next
    return
  }
  await sessionRepository.setState(ACTIVE_SESSION_KEY, persisted(next))
  session = next
}

export async function clearSessionForDeletedScan(scanId: string): Promise<void> {
  await clearSessionForDeletedScans([scanId])
}

export async function clearSessionForDeletedScans(scanIds: Iterable<string>): Promise<void> {
  const deleted = new Set(scanIds)
  if (!deleted.has(session.pendingScanId ?? '') && !deleted.has(session.parentScanId ?? '')) return
  await resetSession()
}

export function clearSessionAfterAtomicDiscard(): void {
  session = emptySession()
}
