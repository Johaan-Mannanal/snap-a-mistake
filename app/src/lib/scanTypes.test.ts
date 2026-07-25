import { describe, expect, it } from 'vitest'
import { PersistedSessionSchema, ScanRecordSchema } from './scanTypes'

const response = {
  kind: 'analysis' as const,
  steps: [],
  errorStepIndex: null,
  misconceptionTag: null,
  explanation: null,
  followUp: null,
  verifierAgreed: true,
}

const revision = {
  id: 'revision-1',
  reason: 'initial' as const,
  response,
  createdAt: '2026-07-24T12:00:00.000Z',
}

const scan = {
  id: 'scan-1',
  imageUri: 'file:///documents/scans/scan-1.jpg',
  origin: 'camera' as const,
  attemptKind: 'original' as const,
  parentScanId: null,
  lifecycle: 'complete' as const,
  activeRevision: revision,
  revisions: [revision],
  feedback: 'unreviewed' as const,
  analysisDurationMs: 1320,
  followUp: null,
  followUpStatus: 'none' as const,
  createdAt: '2026-07-24T11:59:00.000Z',
  updatedAt: '2026-07-24T12:00:00.000Z',
}

describe('ScanRecordSchema', () => {
  it('requires a parent scan for follow-up attempts', () => {
    expect(() => ScanRecordSchema.parse({ ...scan, attemptKind: 'follow-up', parentScanId: null }))
      .toThrow('follow-up requires parentScanId')
  })

  it('forbids a parent scan for original attempts', () => {
    expect(() => ScanRecordSchema.parse({ ...scan, parentScanId: 'parent-1' }))
      .toThrow('original requires parentScanId to be null')
  })

  it('validates lifecycle and feedback values', () => {
    expect(() => ScanRecordSchema.parse({ ...scan, lifecycle: 'saved' })).toThrow()
    expect(() => ScanRecordSchema.parse({ ...scan, feedback: 'maybe' })).toThrow()
  })

  it('requires an active follow-up whenever its status is not none', () => {
    expect(() => ScanRecordSchema.parse({ ...scan, followUpStatus: 'ready' }))
      .toThrow('followUpStatus requires followUp')
  })

  it('requires the active revision to be present in revision history', () => {
    expect(() => ScanRecordSchema.parse({
      ...scan,
      activeRevision: { ...revision, id: 'revision-2' },
    })).toThrow('activeRevision must be present in revisions')
  })

  it('requires the active revision payload to match its history entry', () => {
    expect(() => ScanRecordSchema.parse({
      ...scan,
      activeRevision: { ...revision, response: { kind: 'not-math' } },
    })).toThrow('activeRevision must match its revision history entry')
  })

  it('rejects an invalid model response before it can become a revision', () => {
    expect(() => ScanRecordSchema.parse({
      ...scan,
      activeRevision: { ...revision, response: { kind: 'analysis', steps: [] } },
      revisions: [{ ...revision, response: { kind: 'analysis', steps: [] } }],
    })).toThrow()
  })
})

describe('PersistedSessionSchema', () => {
  it('restores a valid interrupted analysis session', () => {
    const session = PersistedSessionSchema.parse({
      routeIntent: 'analyze',
      pendingScanId: 'scan-1',
      photoUri: 'file:///documents/scans/scan-1.jpg',
      origin: 'camera',
      analysis: null,
      followUp: null,
      parentScanId: null,
    })
    expect(session).toMatchObject({ routeIntent: 'analyze', pendingScanId: 'scan-1' })
  })

  it('rejects persisted sessions containing invalid response JSON', () => {
    expect(() => PersistedSessionSchema.parse({
      routeIntent: 'result',
      pendingScanId: 'scan-1',
      photoUri: 'file:///documents/scans/scan-1.jpg',
      origin: 'camera',
      analysis: { kind: 'analysis', steps: [] },
      followUp: null,
      parentScanId: null,
    })).toThrow()
  })
})
