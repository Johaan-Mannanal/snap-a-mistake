import { describe, expect, it } from 'vitest'
import type { ScanRecord, ScanRevision } from '../lib/scanTypes'
import {
  CLEAR_ALL_CONFIRMATION,
  DATA_PRIVACY_COPY,
  DELETE_SCAN_CONFIRMATION,
  historicalFollowUpPresentation,
  parseScanRouteId,
  scanDetailPresentation,
} from './scanDetail'

const revision: ScanRevision = {
  id: 'revision-1',
  reason: 'initial',
  feedback: 'unreviewed',
  createdAt: '2026-07-24T12:01:00.000Z',
  response: {
    kind: 'analysis', steps: [], errorStepIndex: null, misconceptionTag: null,
    explanation: null, followUp: null, verifierAgreed: true,
  },
}

function scan(overrides: Partial<ScanRecord> = {}): ScanRecord {
  return {
    id: 'scan-1', imageUri: 'file:///documents/scans/scan-1.jpg', origin: 'camera',
    attemptKind: 'original', parentScanId: null, lifecycle: 'complete', activeRevision: revision,
    revisions: [revision], feedback: 'unreviewed', analysisDurationMs: 400,
    followUp: null, followUpStatus: 'none', createdAt: '2026-07-24T12:00:00.000Z', updatedAt: '2026-07-24T12:01:00.000Z',
    ...overrides,
  }
}

describe('scan detail presentation', () => {
  it('uses the active revision as the read-only historical result', () => {
    const superseded = { ...revision, id: 'revision-old', reason: 'retry' as const }
    const presentation = scanDetailPresentation(scan({ activeRevision: revision, revisions: [superseded, revision] }), true)

    expect(presentation).toMatchObject({ kind: 'result', statusLabel: 'Completed analysis', revisionId: 'revision-1' })
  })

  it('identifies a corrected active revision accurately', () => {
    const corrected = { ...revision, reason: 'student-correction' as const, feedback: 'corrected' as const }

    expect(scanDetailPresentation(scan({ activeRevision: corrected, revisions: [corrected], feedback: 'corrected' }), true))
      .toMatchObject({ kind: 'result', statusLabel: 'Corrected analysis', revisionStatus: 'Corrected' })
  })

  it.each([
    ['accepted', 'Completed analysis', 'Confirmed'],
    ['rejected', 'Diagnosis rejected', 'Rejected'],
  ] as const)('uses scan-level %s feedback consistently in active-revision detail', (feedback, statusLabel, revisionStatus) => {
    expect(scanDetailPresentation(scan({ feedback }), true))
      .toMatchObject({ kind: 'result', statusLabel, revisionStatus })
  })

  it.each([
    ['ready', 'Ready'],
    ['in-progress', 'In progress'],
    ['resolved', 'Resolved'],
    ['unresolved', 'Needs another try'],
  ] as const)('restores the saved follow-up content with its %s status as read-only history', (followUpStatus, statusLabel) => {
    const followUp = {
      problem: 'Simplify −(x + 2).',
      concept: 'Sign distribution',
      hint: 'Distribute the negative to both terms.',
    }

    expect(historicalFollowUpPresentation(scan({ followUp, followUpStatus }))).toEqual({
      eyebrow: 'SAVED FOLLOW-UP',
      statusLabel,
      concept: 'Sign distribution',
      problem: 'Simplify −(x + 2).',
      hint: 'Distribute the negative to both terms.',
      readOnlyDetail: 'Saved practice history · read only',
    })
  })

  it('omits the historical follow-up section when none was saved', () => {
    expect(historicalFollowUpPresentation(scan())).toBeNull()
  })

  it('keeps interrupted scans distinct from a completed result', () => {
    expect(scanDetailPresentation(scan({ lifecycle: 'interrupted', activeRevision: null, revisions: [] }), true))
      .toEqual(expect.objectContaining({ kind: 'interrupted', statusLabel: 'Analysis interrupted' }))
  })

  it('keeps excluded diagnoses distinct and never chooses an old revision', () => {
    expect(scanDetailPresentation(scan({ lifecycle: 'review', feedback: 'excluded', activeRevision: null }), true))
      .toEqual(expect.objectContaining({ kind: 'excluded', statusLabel: 'Diagnosis excluded' }))
  })

  it('presents a placeholder when the owned photo is unavailable', () => {
    expect(scanDetailPresentation(scan(), false)).toMatchObject({ kind: 'result', photoAvailable: false })
  })

  it('rejects malformed or non-segment route IDs before loading', () => {
    expect(parseScanRouteId('scan-1')).toBe('scan-1')
    expect(parseScanRouteId('scan%2Fone')).toBeNull()
    expect(parseScanRouteId('%')).toBeNull()
    expect(parseScanRouteId(['scan-1'])).toBeNull()
    expect(parseScanRouteId('')).toBeNull()
  })

  it('uses the exact irreversible confirmation copy', () => {
    expect(DELETE_SCAN_CONFIRMATION).toBe('Delete this scan? Its photo, analysis, corrections, and follow-up will be removed from this phone. This cannot be undone.')
    expect(CLEAR_ALL_CONFIRMATION).toBe('Clear all history? Every saved photo, analysis, follow-up, correction, and learning pattern will be removed from this phone. This cannot be undone.')
  })

  it('states where analysis and saved data are handled', () => {
    expect(DATA_PRIVACY_COPY).toBe('When you analyze, your photo is sent to our AI service. Our server does not keep it. Your completed scan and photo stay on this device until you delete them.')
  })
})
