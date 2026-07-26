import { describe, expect, it } from 'vitest'
import type { ScanRecord, ScanRevision } from '../lib/scanTypes'
import { insightsPresentation } from './insightsPresentation'

const createdAt = '2026-07-20T09:30:00.000Z'

function scan(overrides: Partial<ScanRecord> = {}): ScanRecord {
  const activeRevision: ScanRevision = {
    id: 'revision-1',
    reason: 'initial',
    response: {
      kind: 'analysis',
      steps: [{
        index: 0,
        latex: '−(x + 2) = −x + 2',
        plain: 'negative x plus 2',
        yBandTopPct: 10,
        yBandBottomPct: 20,
        verdict: 'wrong',
      }],
      errorStepIndex: 0,
      misconceptionTag: 'sign-error',
      explanation: 'The sign changes here.',
      followUp: { problem: 'Try another.', concept: 'signs', hint: 'Check each sign.' },
      verifierAgreed: true,
    },
    feedback: 'unreviewed',
    createdAt,
  }
  return {
    id: 'scan-1',
    imageUri: 'file:///documents/scans/scan-1.jpg',
    origin: 'camera',
    attemptKind: 'original',
    parentScanId: null,
    lifecycle: 'complete',
    activeRevision,
    revisions: [activeRevision],
    feedback: 'unreviewed',
    analysisDurationMs: 128,
    followUp: activeRevision.response.kind === 'analysis' ? activeRevision.response.followUp : null,
    followUpStatus: 'ready',
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  }
}

describe('insights presentation', () => {
  it('keeps local history visibly loading until both sources arrive', () => {
    expect(insightsPresentation({ kind: 'loading' })).toMatchObject({
      kind: 'loading',
      title: 'Loading local history…',
    })
  })

  it('uses different empty actions for patterns and previous scans', () => {
    const presentation = insightsPresentation({ kind: 'ready', patterns: [], scans: [] })

    expect(presentation).toMatchObject({
      kind: 'ready',
      patterns: {
        kind: 'empty', title: 'No patterns yet', detail: 'Complete analyses with a labeled misconception will appear here.', actionLabel: 'Scan a problem',
      },
      scans: {
        kind: 'empty', title: 'No previous scans', detail: 'Your scans stay on this device and will appear here.', actionLabel: 'Open camera',
      },
    })
  })

  it('never represents a local database failure as an empty history', () => {
    const presentation = insightsPresentation({ kind: 'error' })

    expect(presentation).toEqual({
      kind: 'error',
      title: "Couldn't load local history",
      detail: 'Your scans and photos remain on this device. Try again.',
      actionLabel: 'Try again',
    })
  })

  it('presents evidence-based patterns and previous scans without alarming raw counts', () => {
    const presentation = insightsPresentation({
      kind: 'ready',
      patterns: [{ tag: 'sign-error', thisWeek: 2, lastWeek: 0, trend: 'more', resolvedFollowUps: 1 }],
      scans: [scan()],
    })

    expect(presentation).toMatchObject({
      kind: 'ready',
      patterns: {
        kind: 'list',
        items: [{ title: 'Sign error', direction: 'Appearing more often than last week.', resolution: 'A follow-up was resolved.' }],
      },
      scans: {
        kind: 'list',
        items: [{ id: 'scan-1', imageUri: 'file:///documents/scans/scan-1.jpg' }],
      },
    })
    if (presentation.kind !== 'ready' || presentation.scans.kind !== 'list') throw new Error('expected scan list')
    expect(presentation.scans.items[0]).not.toHaveProperty('count')
  })

  it('labels scan status, tag, and follow-up state for a saved analysis', () => {
    const presentation = insightsPresentation({ kind: 'ready', patterns: [], scans: [scan()] })

    if (presentation.kind !== 'ready' || presentation.scans.kind !== 'list') throw new Error('expected scan list')
    expect(presentation.scans.items[0]).toMatchObject({
      statusLabel: 'Saved',
      tagLabel: 'Sign error',
      followUpLabel: 'Follow-up ready',
      attemptLabel: 'Original scan',
    })
  })

  const statusCases: [Partial<ScanRecord>, string][] = [
    [{ lifecycle: 'review', feedback: 'excluded', activeRevision: null, revisions: [], followUp: null, followUpStatus: 'none' }, 'Diagnosis excluded'],
    [{ feedback: 'rejected' }, 'Diagnosis rejected'],
    [{ feedback: 'corrected' }, 'Saved · corrected'],
    [{ feedback: 'accepted' }, 'Saved · confirmed'],
    [{ feedback: 'unreviewed' }, 'Saved'],
    [{ lifecycle: 'unsaved' }, 'Not saved'],
    [{ lifecycle: 'interrupted' }, 'Analysis interrupted'],
    [{ lifecycle: 'review', activeRevision: null, revisions: [], followUp: null, followUpStatus: 'none' }, 'Ready to analyze'],
    [{ lifecycle: 'analyzing' }, 'Analysis in progress'],
  ]

  it.each(statusCases)('gives %o an honest history status of %s', (overrides, expectedStatus) => {
    const presentation = insightsPresentation({ kind: 'ready', patterns: [], scans: [scan(overrides)] })

    if (presentation.kind !== 'ready' || presentation.scans.kind !== 'list') throw new Error('expected scan list')
    const item = presentation.scans.items[0]
    if (!item) throw new Error('expected scan item')
    expect(item.statusLabel).toBe(expectedStatus)
  })

  const recoveryCases: [ScanRevision['response'], string][] = [
    [{ kind: 'not-math' }, 'Not math'],
    [{ kind: 'unreadable', tips: ['Use more light.'] }, 'Photo unreadable'],
  ]

  it.each(recoveryCases)('keeps a completed %s result recognizable in history', (response, expectedStatus) => {
    const activeRevision: ScanRevision = { id: 'recovery', reason: 'initial', response, feedback: 'unreviewed', createdAt }
    const presentation = insightsPresentation({ kind: 'ready', patterns: [], scans: [scan({ activeRevision, revisions: [activeRevision], followUp: null, followUpStatus: 'none' })] })

    if (presentation.kind !== 'ready' || presentation.scans.kind !== 'list') throw new Error('expected scan list')
    const item = presentation.scans.items[0]
    if (!item) throw new Error('expected scan item')
    expect(item.statusLabel).toBe(expectedStatus)
  })

  it('orders previous scans newest first with IDs breaking equal timestamps', () => {
    const older = scan({ id: 'a', createdAt: '2026-07-19T09:30:00.000Z' })
    const newer = scan({ id: 'b', createdAt: '2026-07-20T09:30:00.000Z' })
    const tied = scan({ id: 'c', createdAt: '2026-07-20T09:30:00.000Z' })
    const presentation = insightsPresentation({ kind: 'ready', patterns: [], scans: [older, newer, tied] })

    if (presentation.kind !== 'ready' || presentation.scans.kind !== 'list') throw new Error('expected scan list')
    expect(presentation.scans.items.map((item) => item.id)).toEqual(['c', 'b', 'a'])
  })

  it('keeps destructive deletion copy explicit about local photos and linked history', () => {
    const presentation = insightsPresentation({ kind: 'ready', patterns: [], scans: [scan()] })

    if (presentation.kind !== 'ready' || presentation.scans.kind !== 'list') throw new Error('expected scan list')
    const item = presentation.scans.items[0]
    if (!item) throw new Error('expected scan item')
    expect(item.destructiveCopy).toBe('Deleting this scan permanently removes its photo and linked follow-up history from this device.')
  })
})
