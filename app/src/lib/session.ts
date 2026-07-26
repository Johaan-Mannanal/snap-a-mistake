import type { AnalyzeResponse, FollowUp } from '@snap/shared'
import { z } from 'zod'
import type { ScanOrigin } from './scanTypes'
import { PersistedSessionSchema, type PersistedSession } from './scanTypes'
import type { ScanRepository } from './scanRepository'

const PRIVACY_DISCLOSURE_KEY = 'privacy-disclosure-v1'
const PrivacyDisclosureSchema = z.object({ acknowledged: z.literal(true) })

export type Session = {
  routeIntent: PersistedSession['routeIntent']
  pendingScanId: string | null
  photoUri: string | null
  origin: ScanOrigin | null
  analysis: AnalyzeResponse | null
  followUp: FollowUp | null
  parentScanId: string | null
  isRetry: boolean
  isInterrupted: boolean
}

type SessionCommitOptions = { isCurrent?: () => boolean }

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
    analysis: null, followUp: null, parentScanId: null, isRetry: false, isInterrupted: false,
  }
}

let session: Session = emptySession()
let sessionRepository: ScanRepository | null = null
let privacyDisclosureAcknowledged = false

function persisted(sessionValue: Session): PersistedSession {
  return PersistedSessionSchema.parse({
    routeIntent: sessionValue.routeIntent,
    pendingScanId: sessionValue.pendingScanId,
    photoUri: sessionValue.photoUri,
    origin: sessionValue.origin,
    analysis: sessionValue.analysis,
    followUp: sessionValue.followUp,
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

async function commitIfCurrent(next: Session, options: SessionCommitOptions): Promise<boolean> {
  const isCurrent = options.isCurrent ?? (() => true)
  if (!isCurrent()) return false
  const state = persisted(next)
  if (sessionRepository) {
    await sessionRepository.setState(ACTIVE_SESSION_KEY, state)
    if (!isCurrent()) {
      await sessionRepository.setState(ACTIVE_SESSION_KEY, persisted(session))
      return false
    }
  }
  if (!isCurrent()) return false
  session = next
  return true
}

export function getSession(): Session {
  return session
}

export async function hydrateSession(repository: ScanRepository): Promise<Session> {
  sessionRepository = repository
  privacyDisclosureAcknowledged = (await repository.getState(PRIVACY_DISCLOSURE_KEY, PrivacyDisclosureSchema)) !== null
  const stored = await repository.getState(ACTIVE_SESSION_KEY, PersistedSessionSchema)
  if (stored === null) {
    session = emptySession()
    await repository.deleteState(ACTIVE_SESSION_KEY)
    return session
  }

  if (stored.routeIntent === 'analyze') {
    const interrupted = fromPersisted({ ...stored, routeIntent: 'review' }, true)
    await repository.setState(ACTIVE_SESSION_KEY, persisted(interrupted))
    session = interrupted
    return session
  }

  session = fromPersisted(stored)
  return session
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
  const parentScanId = session.routeIntent === 'follow-up' ? session.parentScanId : null
  await commit({
    routeIntent: 'review', pendingScanId: null, photoUri: input.uri, origin: input.origin,
    analysis: null, followUp: null, parentScanId, isRetry: parentScanId !== null, isInterrupted: false,
  })
}

export async function replacePendingPhoto(input: { uri: string; origin: ScanOrigin }): Promise<void> {
  const parentScanId = session.routeIntent === 'review' ? session.parentScanId : null
  await commit({
    routeIntent: 'review', pendingScanId: null, photoUri: input.uri, origin: input.origin,
    analysis: null, followUp: null, parentScanId, isRetry: parentScanId !== null, isInterrupted: false,
  })
}

export async function setReviewedPhoto(input: ReviewedPhoto): Promise<void> {
  await commit({
    routeIntent: 'analyze', pendingScanId: input.scanId, photoUri: input.uri, origin: input.origin,
    analysis: null, followUp: null, parentScanId: input.parentScanId ?? null, isRetry: false, isInterrupted: false,
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
    followUp: null,
    isRetry: false,
    isInterrupted: false,
  }
}

export function adoptReviewSession(): void {
  session = reviewSession()
}

export function startFollowUp(parentScanId: string, followUp: FollowUp, options: SessionCommitOptions = {}): Promise<boolean> {
  return commitIfCurrent({
    routeIntent: 'follow-up', pendingScanId: null, photoUri: null, origin: null,
    analysis: null, followUp, parentScanId, isRetry: true, isInterrupted: false,
  }, options)
}

export async function resetSession(options: { preserveDraft?: boolean } = {}): Promise<void> {
  const preserveDraft = options.preserveDraft && session.photoUri !== null && session.origin !== null
  const next = preserveDraft
    ? { ...session, routeIntent: 'review' as const, analysis: null, followUp: null, isRetry: false, isInterrupted: false }
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

export function clearSessionAfterAtomicDiscard(): void {
  session = emptySession()
}
