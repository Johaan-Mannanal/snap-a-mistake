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
    isRetry: value.routeIntent === 'follow-up',
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
  await commit({
    routeIntent: 'review', pendingScanId: null, photoUri: input.uri, origin: input.origin,
    analysis: null, followUp: null, parentScanId: null, isRetry: false, isInterrupted: false,
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
  await commit({
    routeIntent: 'result', pendingScanId: scanId, photoUri: session.photoUri, origin: session.origin,
    analysis: response, followUp: response.kind === 'analysis' ? response.followUp : null,
    parentScanId: session.parentScanId, isRetry: false, isInterrupted: false,
  })
}

export function startFollowUp(): void
export function startFollowUp(parentScanId: string, followUp: FollowUp): Promise<void>
export function startFollowUp(parentScanId?: string, followUp?: FollowUp): void | Promise<void> {
  if (parentScanId === undefined || followUp === undefined) {
    session = { ...session, isRetry: true, photoUri: null, analysis: null, isInterrupted: false }
    return
  }
  return commit({
    routeIntent: 'follow-up', pendingScanId: null, photoUri: null, origin: null,
    analysis: null, followUp, parentScanId, isRetry: true, isInterrupted: false,
  })
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

// Temporary compatibility wrapper. Task 6 migrates capture routes to setPendingPhoto.
export function setPhoto(uri: string): void {
  session = { ...session, photoUri: uri, analysis: null, isRetry: false }
}

// Temporary compatibility wrapper. Task 7 migrates analysis routes to persistAnalysis.
export function setAnalysis(a: AnalyzeResponse): void {
  const followUp = a.kind === 'analysis' ? a.followUp : null
  session = { ...session, analysis: a, followUp }
}
