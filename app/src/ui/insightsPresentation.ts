import { tagLabel } from '../lib/labels'
import type { ScanRecord } from '../lib/scanTypes'
import type { PatternSummary } from '../lib/trends'

export type InsightsDataState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; patterns: PatternSummary[]; scans: ScanRecord[] }

type EmptySection = { kind: 'empty'; title: string; detail: string; actionLabel: string }

export type PatternItemPresentation = { title: string; attemptCount: number; direction: string; resolution: string | null }
export type ScanItemPresentation = {
  id: string
  imageUri: string
  attemptLabel: string
  dateLabel: string
  timeLabel: string
  statusLabel: string
  tagLabel: string
  followUpLabel: string | null
  destructiveCopy: string
}

type PatternSection = EmptySection | { kind: 'list'; items: PatternItemPresentation[] }
type ScanSection = EmptySection | { kind: 'list'; items: ScanItemPresentation[] }

export type InsightsPresentation =
  | { kind: 'loading'; title: string }
  | { kind: 'error'; title: string; detail: string; actionLabel: string }
  | { kind: 'ready'; patterns: PatternSection; scans: ScanSection }

function patternDirection(pattern: PatternSummary): string {
  switch (pattern.trend) {
    case 'more': return 'Appearing more often than last week.'
    case 'fewer': return 'Showing up less often than last week.'
    case 'same': return 'Showing up at a similar rate to last week.'
    case 'not-enough-data': return 'More observations will make this pattern clearer.'
  }
}

function resolutionLabel(resolvedFollowUps: number): string | null {
  if (resolvedFollowUps === 0) return null
  return resolvedFollowUps === 1 ? 'A follow-up was resolved.' : 'Follow-ups were resolved.'
}

function statusLabel(scan: ScanRecord): string {
  if (scan.feedback === 'excluded') return 'Diagnosis excluded'
  if (scan.feedback === 'rejected') return 'Diagnosis rejected'

  const response = scan.activeRevision?.response
  if (response?.kind === 'not-math') return 'Not math'
  if (response?.kind === 'unreadable') return 'Photo unreadable'

  if (scan.lifecycle === 'unsaved') return 'Not saved'
  if (scan.lifecycle === 'interrupted') return 'Analysis interrupted'
  if (scan.lifecycle === 'review') return 'Ready to analyze'
  if (scan.lifecycle === 'analyzing') return 'Analysis in progress'
  if (scan.feedback === 'corrected') return 'Saved · corrected'
  if (scan.feedback === 'accepted') return 'Saved · confirmed'
  return 'Saved'
}

function analysisTagLabel(scan: ScanRecord): string {
  const response = scan.activeRevision?.response
  return response?.kind === 'analysis' && response.misconceptionTag !== null
    ? tagLabel(response.misconceptionTag)
    : 'No pattern label'
}

function followUpLabel(scan: ScanRecord): string | null {
  switch (scan.followUpStatus) {
    case 'ready': return 'Follow-up ready'
    case 'in-progress': return 'Follow-up in progress'
    case 'resolved': return 'Follow-up resolved'
    case 'unresolved': return 'Follow-up needs another try'
    case 'none': return null
  }
}

function scanPresentation(scan: ScanRecord): ScanItemPresentation {
  const date = new Date(scan.createdAt)
  return {
    id: scan.id,
    imageUri: scan.imageUri,
    attemptLabel: scan.attemptKind === 'follow-up' ? 'Follow-up scan' : 'Original scan',
    dateLabel: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    timeLabel: date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    statusLabel: statusLabel(scan),
    tagLabel: analysisTagLabel(scan),
    followUpLabel: followUpLabel(scan),
    destructiveCopy: 'Deleting this scan permanently removes its photo and linked follow-up history from this device.',
  }
}

export function insightsPresentation(state: InsightsDataState): InsightsPresentation {
  if (state.kind === 'loading') return { kind: 'loading', title: 'Loading local history…' }
  if (state.kind === 'error') {
    return {
      kind: 'error',
      title: "Couldn't load local history",
      detail: 'Your scans and photos remain on this device. Try again.',
      actionLabel: 'Try again',
    }
  }

  return {
    kind: 'ready',
    patterns: state.patterns.length === 0
      ? { kind: 'empty', title: 'No patterns yet', detail: 'Complete analyses with a labeled misconception will appear here.', actionLabel: 'Scan a problem' }
      : {
          kind: 'list',
          items: state.patterns.map((pattern) => ({
            title: tagLabel(pattern.tag), attemptCount: pattern.thisWeek,
            direction: patternDirection(pattern), resolution: resolutionLabel(pattern.resolvedFollowUps),
          })),
        },
    scans: state.scans.length === 0
      ? { kind: 'empty', title: 'No previous scans', detail: 'Your scans stay on this device and will appear here.', actionLabel: 'Open camera' }
      : {
          kind: 'list',
          items: [...state.scans]
            .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.id.localeCompare(left.id))
            .map(scanPresentation),
        },
  }
}
