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
  it('preserves an active revision with an unlocated Unicode step', () => {
    const unlocatedResponse = {
      kind: 'analysis' as const,
      steps: [{ index: 41, latex: 'x^2', plain: 'x²', verdict: 'ok' as const }],
      errorStepIndex: null,
      misconceptionTag: null,
      explanation: null,
      followUp: null,
      verifierAgreed: true,
    }
    const unlocatedRevision = { ...revision, response: unlocatedResponse }

    expect(ScanRecordSchema.parse({
      ...scan,
      activeRevision: unlocatedRevision,
      revisions: [unlocatedRevision],
    }).activeRevision?.response).toEqual(unlocatedResponse)
  })

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
  const followUp = { problem: 'Simplify −(x + 2).', concept: 'sign distribution', hint: 'Distribute the negative to both terms.' }

  it('accepts only the fields needed by each resumable route', () => {
    expect(PersistedSessionSchema.parse({
      routeIntent: 'capture', pendingScanId: null, photoUri: null, origin: null,
      analysis: null, followUp: null, parentScanId: null,
    }).routeIntent).toBe('capture')
    expect(PersistedSessionSchema.parse({
      routeIntent: 'review', pendingScanId: null, photoUri: 'file:///temporary.jpg', origin: 'library',
      analysis: null, followUp: null, parentScanId: null,
    }).routeIntent).toBe('review')
    expect(PersistedSessionSchema.parse({
      routeIntent: 'analyze', pendingScanId: 'scan-1', photoUri: 'file:///documents/scans/scan-1.jpg', origin: 'camera',
      analysis: null, followUp: null, parentScanId: null,
    }).routeIntent).toBe('analyze')
    expect(PersistedSessionSchema.parse({
      routeIntent: 'result', pendingScanId: 'scan-1', photoUri: 'file:///documents/scans/scan-1.jpg', origin: 'camera',
      analysis: response, followUp: null, parentScanId: null,
    }).routeIntent).toBe('result')
    expect(PersistedSessionSchema.parse({
      routeIntent: 'result', pendingScanId: 'scan-1', photoUri: 'file:///documents/scans/scan-1.jpg', origin: 'camera',
      analysis: {
        kind: 'analysis',
        steps: [{
          index: 0, latex: 'x = -2', plain: 'x equals negative 2',
          yBandTopPct: 20, yBandBottomPct: 30, verdict: 'wrong',
        }],
        errorStepIndex: 0, misconceptionTag: 'sign-error',
        explanation: 'The sign changed.', followUp, verifierAgreed: true,
      },
      followUp, parentScanId: null,
    }).routeIntent).toBe('result')
    expect(PersistedSessionSchema.parse({
      routeIntent: 'follow-up', pendingScanId: null, photoUri: null, origin: null,
      analysis: null, followUp, parentScanId: 'scan-1',
    }).routeIntent).toBe('follow-up')
  })

  it('rejects impossible persisted states for every route intent', () => {
    expect(() => PersistedSessionSchema.parse({
      routeIntent: 'capture', pendingScanId: null, photoUri: 'file:///temporary.jpg', origin: null,
      analysis: null, followUp: null, parentScanId: null,
    })).toThrow('capture cannot retain scan data')
    expect(() => PersistedSessionSchema.parse({
      routeIntent: 'review', pendingScanId: null, photoUri: null, origin: null,
      analysis: null, followUp: null, parentScanId: null,
    })).toThrow('review requires photoUri and origin')
    expect(() => PersistedSessionSchema.parse({
      routeIntent: 'analyze', pendingScanId: null, photoUri: null, origin: null,
      analysis: null, followUp: null, parentScanId: null,
    })).toThrow('analyze requires pendingScanId, photoUri, and origin')
    expect(() => PersistedSessionSchema.parse({
      routeIntent: 'result', pendingScanId: null, photoUri: null, origin: null,
      analysis: null, followUp: null, parentScanId: null,
    })).toThrow('result requires pendingScanId, photoUri, origin, and analysis')
    expect(() => PersistedSessionSchema.parse({
      routeIntent: 'follow-up', pendingScanId: null, photoUri: null, origin: null,
      analysis: null, followUp: null, parentScanId: null,
    })).toThrow('follow-up requires parentScanId and followUp')
  })

  it('rejects stale route data and result follow-ups that do not match the active analysis', () => {
    expect(() => PersistedSessionSchema.parse({
      routeIntent: 'review', pendingScanId: null, photoUri: 'file:///temporary.jpg', origin: 'camera',
      analysis: response, followUp: null, parentScanId: null,
    })).toThrow('review cannot retain an analysis result')
    expect(() => PersistedSessionSchema.parse({
      routeIntent: 'analyze', pendingScanId: 'scan-1', photoUri: 'file:///documents/scans/scan-1.jpg', origin: 'camera',
      analysis: null, followUp, parentScanId: null,
    })).toThrow('active follow-up problem requires a parent scan')
    expect(() => PersistedSessionSchema.parse({
      routeIntent: 'result', pendingScanId: 'scan-1', photoUri: 'file:///documents/scans/scan-1.jpg', origin: 'camera',
      analysis: response, followUp, parentScanId: null,
    })).toThrow('result followUp must match analysis followUp')
    expect(() => PersistedSessionSchema.parse({
      routeIntent: 'follow-up', pendingScanId: 'scan-1', photoUri: 'file:///documents/scans/scan-1.jpg', origin: 'camera',
      analysis: response, followUp, parentScanId: 'scan-1',
    })).toThrow('follow-up cannot retain scan or analysis result')
  })

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

  it('retains the active follow-up problem, hint, and alternates through review and analysis', () => {
    const practice = {
      followUp,
      followUpHintVisible: true,
      previousFollowUpProblems: ['Simplify −(2x + 3).'],
      parentScanId: 'parent-1',
    }
    const review = PersistedSessionSchema.parse({
      routeIntent: 'review', pendingScanId: null, photoUri: 'file:///temporary.jpg', origin: 'camera',
      analysis: null, ...practice,
    })
    const analyze = PersistedSessionSchema.parse({
      routeIntent: 'analyze', pendingScanId: 'child-1',
      photoUri: 'file:///documents/scans/child-1.jpg', origin: 'camera',
      analysis: null, ...practice,
    })

    expect(review).toMatchObject(practice)
    expect(analyze).toMatchObject(practice)
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
