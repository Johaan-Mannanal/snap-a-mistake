import type { ScanRecord, ScanRevision } from '../lib/scanTypes'

export const DELETE_SCAN_CONFIRMATION = 'Delete this scan? Its photo, analysis, corrections, and follow-up will be removed from this phone. This cannot be undone.'
export const CLEAR_ALL_CONFIRMATION = 'Clear all history? Every saved photo, analysis, follow-up, correction, and learning pattern will be removed from this phone. This cannot be undone.'
export const DATA_PRIVACY_COPY = 'When you analyze, your photo is sent to our AI service. Our server does not keep it. Your completed scan and photo stay on this device until you delete them.'

export type ScanDetailPresentation =
  | {
    kind: 'result'
    statusLabel: 'Completed analysis' | 'Corrected analysis' | 'Diagnosis rejected'
    revisionId: string
    revisionStatus: string
    revision: ScanRevision
    photoAvailable: boolean
  }
  | { kind: 'interrupted'; statusLabel: 'Analysis interrupted'; detail: string; photoAvailable: boolean }
  | { kind: 'excluded'; statusLabel: 'Diagnosis excluded'; detail: string; photoAvailable: boolean }
  | { kind: 'pending'; statusLabel: string; detail: string; photoAvailable: boolean }

export function parseScanRouteId(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  try {
    const id = decodeURIComponent(value)
    return id && id !== '.' && id !== '..' && !/[\\/]/.test(id) ? id : null
  } catch {
    return null
  }
}

function revisionStatus(scan: ScanRecord, revision: ScanRevision): string {
  if (scan.feedback === 'rejected') return 'Rejected'
  if (scan.feedback === 'corrected' || revision.feedback === 'corrected' || revision.reason === 'student-correction') return 'Corrected'
  if (scan.feedback === 'accepted') return 'Confirmed'
  return 'Saved'
}

export type HistoricalFollowUpPresentation = {
  eyebrow: 'SAVED FOLLOW-UP'
  statusLabel: 'Ready' | 'In progress' | 'Resolved' | 'Needs another try'
  concept: string
  problem: string
  hint: string
  readOnlyDetail: 'Saved practice history · read only'
}

export function historicalFollowUpPresentation(scan: ScanRecord): HistoricalFollowUpPresentation | null {
  if (scan.followUp === null || scan.followUpStatus === 'none') return null
  const statusLabel = scan.followUpStatus === 'ready' ? 'Ready'
    : scan.followUpStatus === 'in-progress' ? 'In progress'
      : scan.followUpStatus === 'resolved' ? 'Resolved'
        : 'Needs another try'
  return {
    eyebrow: 'SAVED FOLLOW-UP',
    statusLabel,
    concept: scan.followUp.concept,
    problem: scan.followUp.problem,
    hint: scan.followUp.hint,
    readOnlyDetail: 'Saved practice history · read only',
  }
}

export function scanDetailPresentation(scan: ScanRecord, photoAvailable: boolean): ScanDetailPresentation {
  if (scan.feedback === 'excluded') {
    return {
      kind: 'excluded', statusLabel: 'Diagnosis excluded', photoAvailable,
      detail: 'This diagnosis was excluded from your learning history. The original scan remains here for audit only.',
    }
  }
  if (scan.lifecycle === 'interrupted') {
    return {
      kind: 'interrupted', statusLabel: 'Analysis interrupted', photoAvailable,
      detail: 'This analysis did not finish. No diagnosis was saved for this scan.',
    }
  }
  if (scan.activeRevision) {
    const corrected = scan.feedback === 'corrected'
      || scan.activeRevision.feedback === 'corrected'
      || scan.activeRevision.reason === 'student-correction'
    return {
      kind: 'result',
      statusLabel: scan.feedback === 'rejected'
        ? 'Diagnosis rejected'
        : corrected ? 'Corrected analysis' : 'Completed analysis',
      revisionId: scan.activeRevision.id, revisionStatus: revisionStatus(scan, scan.activeRevision),
      revision: scan.activeRevision, photoAvailable,
    }
  }

  const pending = scan.lifecycle === 'analyzing'
    ? { statusLabel: 'Analysis in progress', detail: 'This scan was saved before its analysis finished.' }
    : scan.lifecycle === 'unsaved'
      ? { statusLabel: 'Not saved', detail: 'This scan does not have a saved analysis yet.' }
      : { statusLabel: 'Ready to analyze', detail: 'This photo was saved without an analysis.' }
  return { kind: 'pending', ...pending, photoAvailable }
}
