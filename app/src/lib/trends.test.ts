import { describe, expect, it } from 'vitest'
import type { AnalyzeResponse, MisconceptionTag } from '@snap/shared'
import type { ScanRecord, ScanRevision, TrendSource } from './scanTypes'
import { summarize } from './trends'

const now = new Date('2026-07-18T12:00:00.000Z')
const atDaysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString()

function response(tag: MisconceptionTag | null): AnalyzeResponse {
  return tag === null
    ? { kind: 'analysis', steps: [], errorStepIndex: null, misconceptionTag: null, explanation: null, followUp: null, verifierAgreed: true }
    : {
        kind: 'analysis', steps: [], errorStepIndex: 0, misconceptionTag: tag,
        explanation: 'The first incorrect step needs attention.',
        followUp: { problem: 'Try a similar problem.', concept: 'the same concept', hint: 'Check the first step.' },
        verifierAgreed: true,
      }
}

function revision(id: string, tag: MisconceptionTag | null, createdAt: string, feedback: ScanRevision['feedback'] = 'unreviewed'): ScanRevision {
  return { id, reason: 'initial', response: response(tag), feedback, createdAt }
}

function scan(id: string, tag: MisconceptionTag | null, daysAgo: number, overrides: Partial<ScanRecord> = {}): ScanRecord {
  const createdAt = atDaysAgo(daysAgo)
  const activeRevision = revision(`${id}-active`, tag, createdAt)
  return {
    id,
    imageUri: `file:///documents/${id}.jpg`,
    origin: 'camera',
    attemptKind: 'original',
    parentScanId: null,
    lifecycle: 'complete',
    activeRevision,
    revisions: [activeRevision],
    feedback: 'unreviewed',
    analysisDurationMs: 100,
    followUp: activeRevision.response.kind === 'analysis' ? activeRevision.response.followUp : null,
    followUpStatus: activeRevision.response.kind === 'analysis' && activeRevision.response.followUp ? 'ready' : 'none',
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  }
}

const source = (record: ScanRecord): TrendSource => ({ kind: 'scan', scan: record })
const legacy = (tag: MisconceptionTag, daysAgo: number): TrendSource => ({ kind: 'legacy', tag, correct: false, createdAt: atDaysAgo(daysAgo) })

describe('summarize', () => {
  it('counts retries for one scan only once, using its active revision', () => {
    const initial = revision('scan-1-initial', 'sign-error', atDaysAgo(2))
    const retry = revision('scan-1-retry', 'dropped-term', atDaysAgo(1))
    const record = scan('scan-1', 'dropped-term', 2, { activeRevision: retry, revisions: [initial, retry] })

    expect(summarize([source(record)], now)).toMatchObject([
      { tag: 'dropped-term', thisWeek: 1, lastWeek: 0, trend: 'not-enough-data' },
    ])
  })

  it('excludes rejected, excluded, unsaved, interrupted, draft, and non-analysis scans', () => {
    const rejected = revision('rejected', 'sign-error', atDaysAgo(1), 'rejected')
    const excluded = scan('excluded', 'sign-error', 1, { lifecycle: 'review', activeRevision: null, revisions: [rejected], feedback: 'excluded', followUp: null, followUpStatus: 'none' })
    const rejectedRecord = scan('rejected-record', 'sign-error', 1, { feedback: 'rejected' })
    const unsaved = scan('unsaved', 'sign-error', 1, { lifecycle: 'unsaved' })
    const interrupted = scan('interrupted', 'sign-error', 1, { lifecycle: 'interrupted' })
    const draft = scan('draft', 'sign-error', 1, { lifecycle: 'review', activeRevision: null, revisions: [], followUp: null, followUpStatus: 'none' })
    const nonAnalysisRevision: ScanRevision = { id: 'not-math', reason: 'initial', response: { kind: 'not-math' }, feedback: 'unreviewed', createdAt: atDaysAgo(1) }
    const nonAnalysis = scan('non-analysis', null, 1, { activeRevision: nonAnalysisRevision, revisions: [nonAnalysisRevision], followUp: null, followUpStatus: 'none' })

    expect(summarize([source(excluded), source(rejectedRecord), source(unsaved), source(interrupted), source(draft), source(nonAnalysis)], now)).toEqual([])
  })

  it('replaces a corrected active tag instead of preserving the rejected diagnosis', () => {
    const rejected = revision('scan-1-initial', 'sign-error', atDaysAgo(2), 'rejected')
    const corrected = { ...revision('scan-1-corrected', 'dropped-term', atDaysAgo(1)), reason: 'student-correction' as const, feedback: 'corrected' as const }
    const record = scan('scan-1', 'dropped-term', 2, { activeRevision: corrected, revisions: [rejected, corrected], feedback: 'corrected' })

    expect(summarize([source(record)], now)).toMatchObject([{ tag: 'dropped-term', thisWeek: 1 }])
    expect(summarize([source(record)], now).some((summary) => summary.tag === 'sign-error')).toBe(false)
  })

  it('requires two relevant attempts before it reports a direction', () => {
    const oneAttempt = summarize([source(scan('current', 'sign-error', 1))], now)
    const twoAttempts = summarize([source(scan('current', 'sign-error', 1)), source(scan('previous', 'sign-error', 8))], now)

    expect(oneAttempt).toMatchObject([{ tag: 'sign-error', thisWeek: 1, lastWeek: 0, trend: 'not-enough-data' }])
    expect(twoAttempts).toMatchObject([{ tag: 'sign-error', thisWeek: 1, lastWeek: 1, trend: 'same' }])
  })

  it('uses deterministic UTC week boundaries and never renders a zero-current row', () => {
    const atBoundary = source(scan('last-week-start', 'sign-error', 7))
    const outsideWindow = source(scan('outside-window', 'sign-error', 14))
    const current = source(scan('current', 'dropped-term', 7 - 1 / 86_400_000))

    expect(summarize([atBoundary, outsideWindow, current], now)).toEqual([
      { tag: 'dropped-term', thisWeek: 1, lastWeek: 0, trend: 'not-enough-data', resolvedFollowUps: 0 },
    ])
  })

  it('counts each valid resolved follow-up once for its parent tag', () => {
    const parent = scan('parent', 'sign-error', 1, { followUpStatus: 'resolved' })
    const resolvedChild = scan('child', null, 1, { attemptKind: 'follow-up', parentScanId: 'parent' })
    const duplicateResolvedChild = scan('child-2', null, 1, { attemptKind: 'follow-up', parentScanId: 'parent' })
    const statusOnly = scan('status-only', 'dropped-term', 1, { followUpStatus: 'resolved' })

    expect(summarize([source(parent), source(resolvedChild), source(duplicateResolvedChild), source(statusOnly)], now)).toEqual([
      { tag: 'sign-error', thisWeek: 1, lastWeek: 0, trend: 'not-enough-data', resolvedFollowUps: 1 },
      { tag: 'dropped-term', thisWeek: 1, lastWeek: 0, trend: 'not-enough-data', resolvedFollowUps: 0 },
    ])
  })

  it('does not credit a child that resolved a superseded parent revision', () => {
    const currentRevision = revision('parent-current', 'dropped-term', atDaysAgo(1))
    const parent = scan('parent', 'dropped-term', 3, { activeRevision: currentRevision, revisions: [currentRevision], followUpStatus: 'resolved' })
    const oldChild = scan('child', null, 2, { attemptKind: 'follow-up', parentScanId: 'parent' })

    expect(summarize([source(parent), source(oldChild)], now)).toEqual([
      { tag: 'dropped-term', thisWeek: 1, lastWeek: 0, trend: 'not-enough-data', resolvedFollowUps: 0 },
    ])
  })

  it('keeps legacy aggregate rows as distinct migration-era attempts and sorts stable summaries', () => {
    const rows = summarize([
      legacy('sign-error', 1),
      legacy('sign-error', 2),
      source(scan('dropped', 'dropped-term', 1)),
      source(scan('algebra', 'algebraic-slip', 1)),
    ], now)

    expect(rows).toMatchObject([
      { tag: 'sign-error', thisWeek: 2, trend: 'more' },
      { tag: 'algebraic-slip', thisWeek: 1 },
      { tag: 'dropped-term', thisWeek: 1 },
    ])
  })
})
