import type { AnalyzeResponse, MisconceptionTag } from '@snap/shared'
import { tagLabel } from './labels'
import type { ScanRecord, TrendSource } from './scanTypes'

export const MIN_DIRECTIONAL_EVIDENCE = 2

export type PatternSummary = {
  tag: MisconceptionTag
  thisWeek: number
  lastWeek: number
  trend: 'more' | 'fewer' | 'same' | 'not-enough-data'
  resolvedFollowUps: number
}

export type TagSummary = PatternSummary

const WEEK = 7 * 86_400_000

type TaggedAttempt = { tag: MisconceptionTag; createdAt: string }

function activeAnalysis(scan: ScanRecord): Extract<AnalyzeResponse, { kind: 'analysis' }> | null {
  const revision = scan.activeRevision
  if (
    scan.lifecycle !== 'complete'
    || scan.feedback === 'rejected'
    || scan.feedback === 'excluded'
    || revision === null
    || revision.feedback === 'rejected'
    || revision.response.kind !== 'analysis'
  ) return null
  return revision.response
}

function taggedScanAttempt(scan: ScanRecord): TaggedAttempt | null {
  const analysis = activeAnalysis(scan)
  return analysis?.misconceptionTag === null || analysis === null
    ? null
    : { tag: analysis.misconceptionTag, createdAt: scan.createdAt }
}

function taggedLegacyAttempt(source: Extract<TrendSource, { kind: 'legacy' }>): TaggedAttempt | null {
  return source.correct || source.tag === null ? null : { tag: source.tag, createdAt: source.createdAt }
}

function weekFor(createdAt: string, now: Date): 'this-week' | 'last-week' | null {
  const time = Date.parse(createdAt)
  const age = now.getTime() - time
  if (!Number.isFinite(time) || age < 0 || age >= 2 * WEEK) return null
  return age < WEEK ? 'this-week' : 'last-week'
}

function isResolvedByChild(parent: ScanRecord, child: ScanRecord): boolean {
  const parentAnalysis = activeAnalysis(parent)
  const childAnalysis = activeAnalysis(child)
  const parentRevision = parent.activeRevision
  const childRevision = child.activeRevision
  return parent.followUp !== null
    && parent.followUpStatus === 'resolved'
    && parentAnalysis?.misconceptionTag !== null
    && parentAnalysis !== null
    && child.attemptKind === 'follow-up'
    && child.parentScanId === parent.id
    && childAnalysis !== null
    && parentRevision !== null
    && childRevision !== null
    && Date.parse(childRevision.createdAt) >= Date.parse(parentRevision.createdAt)
    && (childAnalysis.errorStepIndex === null || childAnalysis.misconceptionTag !== parentAnalysis.misconceptionTag)
}

function resolvedFollowUps(scans: ScanRecord[], now: Date): Map<MisconceptionTag, number> {
  const resolved = new Map<MisconceptionTag, number>()
  for (const parent of scans) {
    const parentAttempt = taggedScanAttempt(parent)
    if (parentAttempt === null || weekFor(parentAttempt.createdAt, now) !== 'this-week') continue
    if (!scans.some((child) => isResolvedByChild(parent, child))) continue
    resolved.set(parentAttempt.tag, (resolved.get(parentAttempt.tag) ?? 0) + 1)
  }
  return resolved
}

export function summarize(sources: TrendSource[], now: Date): PatternSummary[] {
  const thisWeek = new Map<MisconceptionTag, number>()
  const lastWeek = new Map<MisconceptionTag, number>()
  const scans: ScanRecord[] = []

  for (const source of sources) {
    const attempt = source.kind === 'scan'
      ? (scans.push(source.scan), taggedScanAttempt(source.scan))
      : taggedLegacyAttempt(source)
    if (attempt === null) continue
    const week = weekFor(attempt.createdAt, now)
    if (week === null) continue
    const counts = week === 'this-week' ? thisWeek : lastWeek
    counts.set(attempt.tag, (counts.get(attempt.tag) ?? 0) + 1)
  }

  const resolved = resolvedFollowUps(scans, now)
  return [...thisWeek.keys()]
    .map((tag): PatternSummary => {
      const current = thisWeek.get(tag) ?? 0
      const previous = lastWeek.get(tag) ?? 0
      const evidence = current + previous
      const trend = evidence < MIN_DIRECTIONAL_EVIDENCE
        ? 'not-enough-data'
        : current > previous ? 'more' : current < previous ? 'fewer' : 'same'
      return { tag, thisWeek: current, lastWeek: previous, trend, resolvedFollowUps: resolved.get(tag) ?? 0 }
    })
    .sort((left, right) => (
      right.thisWeek - left.thisWeek
      || right.resolvedFollowUps - left.resolvedFollowUps
      || tagLabel(left.tag).localeCompare(tagLabel(right.tag))
    ))
}
