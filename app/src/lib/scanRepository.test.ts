import { describe, expect, it } from 'vitest'
import type { AnalyzeResponse } from '@snap/shared'
import { createScanRepository, type DatabasePort } from './scanRepository'
import type { NewScanDraft, ScanRevision } from './scanTypes'

type ScanRow = Record<string, unknown>
type RevisionRow = Record<string, unknown>

class MemoryDatabase implements DatabasePort {
  readonly tables = new Set<string>()
  readonly pragmas = new Set<string>()
  readonly scans = new Map<string, ScanRow>()
  readonly revisions = new Map<string, RevisionRow>()
  readonly appState = new Map<string, string>()
  readonly cleanup = new Set<string>()
  readonly analyses: Array<{ tag: string | null; correct: number; createdAt: string }> = []
  userVersion = 0
  failActiveSessionDeletion = false

  async execAsync(sql: string): Promise<void> {
    for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) {
      if (/PRAGMA journal_mode\s*=\s*WAL/i.test(statement)) this.pragmas.add('wal')
      if (/PRAGMA foreign_keys\s*=\s*ON/i.test(statement)) this.pragmas.add('foreign_keys')
      const create = statement.match(/CREATE TABLE IF NOT EXISTS\s+(\w+)/i)
      if (create?.[1]) this.tables.add(create[1])
      const version = statement.match(/PRAGMA user_version\s*=\s*(\d+)/i)
      if (version?.[1]) this.userVersion = Number(version[1])
    }
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase()
    if (normalized.startsWith('insert into scans')) {
      const [id, imageUri, origin, attemptKind, parentScanId, lifecycle, feedback, duration, followUp, followUpStatus, createdAt, updatedAt] = params
      this.scans.set(String(id), { id, image_uri: imageUri, origin, attempt_kind: attemptKind, parent_scan_id: parentScanId, lifecycle, active_revision_id: null, feedback, analysis_duration_ms: duration, follow_up_json: followUp, follow_up_status: followUpStatus, created_at: createdAt, updated_at: updatedAt })
      return { changes: 1 }
    }
    if (normalized.startsWith('insert into scan_revisions')) {
      const [id, scanId, reason, response, createdAt] = params
      this.revisions.set(String(id), { id, scan_id: scanId, reason, response_json: response, created_at: createdAt })
      return { changes: 1 }
    }
    if (normalized.startsWith('update scans set active_revision_id')) {
      const [activeRevisionId, lifecycle, duration, followUp, followUpStatus, feedback, updatedAt, id] = params
      const scan = this.scans.get(String(id))
      if (!scan) return { changes: 0 }
      Object.assign(scan, { active_revision_id: activeRevisionId, lifecycle, analysis_duration_ms: duration, follow_up_json: followUp, follow_up_status: followUpStatus, feedback, updated_at: updatedAt })
      return { changes: 1 }
    }
    if (normalized.startsWith('update scans set feedback')) {
      const [feedback, updatedAt, id] = params
      const scan = this.scans.get(String(id))
      if (!scan) return { changes: 0 }
      Object.assign(scan, { feedback, updated_at: updatedAt })
      return { changes: 1 }
    }
    if (normalized.startsWith('update scans set follow_up_status')) {
      const [followUpStatus, updatedAt, id] = params
      const scan = this.scans.get(String(id))
      if (!scan) return { changes: 0 }
      Object.assign(scan, { follow_up_status: followUpStatus, updated_at: updatedAt })
      return { changes: 1 }
    }
    if (normalized.startsWith('insert') && normalized.includes('into cleanup_queue')) {
      this.cleanup.add(String(params[0]))
      return { changes: 1 }
    }
    if (normalized.startsWith('delete from scans where id')) {
      const id = String(params[0])
      const scanIds = new Set([id])
      let foundChild = true
      while (foundChild) {
        foundChild = false
        for (const scan of this.scans.values()) {
          if (typeof scan.id === 'string' && typeof scan.parent_scan_id === 'string' && scanIds.has(scan.parent_scan_id) && !scanIds.has(scan.id)) {
            scanIds.add(scan.id)
            foundChild = true
          }
        }
      }
      for (const scanId of scanIds) this.scans.delete(scanId)
      for (const [revisionId, revision] of this.revisions) if (typeof revision.scan_id === 'string' && scanIds.has(revision.scan_id)) this.revisions.delete(revisionId)
      return { changes: 1 }
    }
    if (normalized.startsWith('delete from scans')) { this.scans.clear(); this.revisions.clear(); return { changes: 1 } }
    if (normalized.startsWith('delete from analyses')) { this.analyses.splice(0); return { changes: 1 } }
    if (normalized.startsWith('delete from app_state where')) {
      if (String(params[0]) === 'active-session' && this.failActiveSessionDeletion)
        throw new Error('state unavailable')
      this.appState.delete(String(params[0]))
      return { changes: 1 }
    }
    if (normalized.startsWith('delete from app_state')) { this.appState.clear(); return { changes: 1 } }
    if (normalized.startsWith('delete from cleanup_queue where image_uri')) { this.cleanup.delete(String(params[0])); return { changes: 1 } }
    if (normalized.startsWith('delete from cleanup_queue')) { this.cleanup.clear(); return { changes: 1 } }
    if (normalized.startsWith('insert into app_state')) { this.appState.set(String(params[0]), String(params[1])); return { changes: 1 } }
    throw new Error(`Unhandled run: ${sql}`)
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase()
    if (normalized.startsWith('pragma user_version')) return { user_version: this.userVersion } as T
    if (normalized.includes('from scans where id')) return (this.scans.get(String(params[0])) ?? null) as T | null
    if (normalized.includes('from app_state where key')) {
      const value = this.appState.get(String(params[0]))
      return value === undefined ? null : { value_json: value } as T
    }
    throw new Error(`Unhandled first: ${sql}`)
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase()
    if (normalized.includes('from scan_revisions where scan_id'))
      return [...this.revisions.values()].filter((revision) => revision.scan_id === String(params[0])) as T[]
    if (normalized.includes('from scans')) return [...this.scans.values()] as T[]
    if (normalized.includes('from analyses')) return this.analyses as T[]
    if (normalized.includes('from cleanup_queue')) return [...this.cleanup].map((image_uri) => ({ image_uri })) as T[]
    throw new Error(`Unhandled all: ${sql}`)
  }

  async withExclusiveTransactionAsync<T>(task: (transaction: DatabasePort) => Promise<T>): Promise<T> {
    const scans = new Map([...this.scans].map(([key, value]) => [key, { ...value }]))
    const revisions = new Map([...this.revisions].map(([key, value]) => [key, { ...value }]))
    const appState = new Map(this.appState)
    const cleanup = new Set(this.cleanup)
    try {
      return await task(this)
    } catch (error) {
      this.scans.clear(); scans.forEach((value, key) => this.scans.set(key, value))
      this.revisions.clear(); revisions.forEach((value, key) => this.revisions.set(key, value))
      this.appState.clear(); appState.forEach((value, key) => this.appState.set(key, value))
      this.cleanup.clear(); cleanup.forEach((value) => this.cleanup.add(value))
      throw error
    }
  }
}

const draft = (id = 'scan-1'): NewScanDraft => ({
  id,
  imageUri: `file:///documents/scans/${id}.jpg`,
  origin: 'camera',
  attemptKind: 'original',
  parentScanId: null,
  createdAt: '2026-07-24T12:00:00.000Z',
})

const analysis: AnalyzeResponse = {
  kind: 'analysis', steps: [], errorStepIndex: null, misconceptionTag: null,
  explanation: null, followUp: null, verifierAgreed: true,
}

const revision = (id: string, reason: ScanRevision['reason']): ScanRevision => ({
  id, reason, response: analysis, createdAt: '2026-07-24T12:01:00.000Z',
})

const diagnosisRevision: ScanRevision = {
  id: 'revision-with-follow-up',
  reason: 'initial',
  response: {
    kind: 'analysis', steps: [], errorStepIndex: 0, misconceptionTag: 'sign-error',
    explanation: 'The sign changed without distributing the negative.',
    followUp: { problem: 'Simplify −(x + 2).', concept: 'sign distribution', hint: 'Distribute the negative to both terms.' },
    verifierAgreed: true,
  },
  createdAt: '2026-07-24T12:01:00.000Z',
}

describe('scan repository migration', () => {
  it('creates the full local schema once and leaves legacy analyses readable', async () => {
    const db = new MemoryDatabase()
    db.analyses.push({ tag: 'sign-error', correct: 0, createdAt: '2026-07-20T12:00:00.000Z' })
    const repository = createScanRepository(db)

    await repository.migrate()
    await repository.migrate()

    expect([...db.tables].sort()).toEqual(['app_state', 'cleanup_queue', 'scan_revisions', 'scans'])
    expect(db.userVersion).toBe(1)
    expect(db.pragmas).toEqual(new Set(['wal', 'foreign_keys']))
    await expect(repository.loadTrendSources()).resolves.toEqual([
      { kind: 'legacy', tag: 'sign-error', correct: false, createdAt: '2026-07-20T12:00:00.000Z' },
    ])
  })

  it('rejects a database created by a newer schema version', async () => {
    const db = new MemoryDatabase()
    db.userVersion = 2

    await expect(createScanRepository(db).migrate())
      .rejects.toThrow('database version 2 is newer than supported version 1')
    expect(db.tables).toHaveLength(0)
  })
})

describe('scan repository records', () => {
  it('saves a retry on the same scan instead of creating another scan', async () => {
    const db = new MemoryDatabase()
    const repository = createScanRepository(db)
    await repository.migrate()
    await repository.createDraft(draft())

    const saved = await repository.saveRevision('scan-1', revision('revision-1', 'retry'), 400)

    expect(db.scans).toHaveLength(1)
    expect(saved.activeRevision?.id).toBe('revision-1')
    expect(saved.lifecycle).toBe('complete')
  })

  it('clears stale follow-up state when a retry has no follow-up', async () => {
    const db = new MemoryDatabase()
    const repository = createScanRepository(db)
    await repository.migrate()
    await repository.createDraft(draft())
    await repository.saveRevision('scan-1', diagnosisRevision, 400)

    const saved = await repository.saveRevision('scan-1', revision('revision-2', 'retry'), 420)

    expect(saved.followUp).toBeNull()
    expect(saved.followUpStatus).toBe('none')
  })

  it('adds a correction revision and switches the active revision atomically', async () => {
    const db = new MemoryDatabase()
    const repository = createScanRepository(db)
    await repository.migrate()
    await repository.createDraft(draft())
    await repository.saveRevision('scan-1', revision('revision-1', 'initial'), 400)

    const saved = await repository.saveRevision('scan-1', revision('revision-2', 'student-correction'), 420)

    expect(saved.revisions.map((item) => item.id)).toEqual(['revision-1', 'revision-2'])
    expect(saved.activeRevision?.id).toBe('revision-2')
    expect(db.scans.get('scan-1')?.active_revision_id).toBe('revision-2')
  })

  it('deletes a scan, cascades its revisions, and queues its owned image', async () => {
    const db = new MemoryDatabase()
    const repository = createScanRepository(db)
    await repository.migrate()
    await repository.createDraft(draft())
    await repository.saveRevision('scan-1', revision('revision-1', 'initial'), 400)

    await expect(repository.delete('scan-1')).resolves.toBe('file:///documents/scans/scan-1.jpg')
    expect(db.revisions).toHaveLength(0)
    expect(db.cleanup).toEqual(new Set(['file:///documents/scans/scan-1.jpg']))
  })

  it('atomically removes a reviewed draft, queues its owned photo, and clears the active session', async () => {
    const db = new MemoryDatabase()
    const repository = createScanRepository(db)
    await repository.migrate()
    await repository.createDraft(draft())
    await repository.setState('active-session', { routeIntent: 'review' })

    await repository.discardReviewAndSession({ scanId: 'scan-1', ownedUri: 'file:///documents/scans/scan-1.jpg' })

    expect(db.scans).toHaveLength(0)
    expect(db.appState.has('active-session')).toBe(false)
    expect(db.cleanup).toEqual(new Set(['file:///documents/scans/scan-1.jpg']))
  })

  it('rolls back review disposal when clearing the active session fails', async () => {
    const db = new MemoryDatabase()
    const repository = createScanRepository(db)
    await repository.migrate()
    await repository.createDraft(draft())
    await repository.setState('active-session', { routeIntent: 'review' })
    db.failActiveSessionDeletion = true

    await expect(repository.discardReviewAndSession({ scanId: 'scan-1', ownedUri: 'file:///documents/scans/scan-1.jpg' }))
      .rejects.toThrow('state unavailable')

    expect(db.scans).toHaveLength(1)
    expect(db.appState.has('active-session')).toBe(true)
    expect(db.cleanup).toEqual(new Set())
  })

  it('deletes linked follow-up scans with their parent and queues every owned image', async () => {
    const db = new MemoryDatabase()
    const repository = createScanRepository(db)
    await repository.migrate()
    await repository.createDraft(draft('parent'))
    await repository.createDraft({
      ...draft('follow-up'),
      attemptKind: 'follow-up',
      parentScanId: 'parent',
    })

    await repository.delete('parent')

    expect(db.scans).toHaveLength(0)
    expect(db.cleanup).toEqual(new Set([
      'file:///documents/scans/parent.jpg',
      'file:///documents/scans/follow-up.jpg',
    ]))
  })

  it('retains prior and newly queued cleanup obligations through clear-all until acknowledged', async () => {
    const db = new MemoryDatabase()
    const repository = createScanRepository(db)
    await repository.migrate()
    await repository.createDraft(draft())
    await repository.saveRevision('scan-1', revision('revision-1', 'initial'), 400)
    db.analyses.push({ tag: 'sign-error', correct: 0, createdAt: '2026-07-20T12:00:00.000Z' })
    db.cleanup.add('file:///documents/scans/failed-before-clear.jpg')
    await repository.setState('active-session', { routeIntent: 'review' })

    await expect(repository.clearAll()).resolves.toEqual([
      'file:///documents/scans/failed-before-clear.jpg',
      'file:///documents/scans/scan-1.jpg',
    ])
    expect(db.scans).toHaveLength(0)
    expect(db.revisions).toHaveLength(0)
    expect(db.analyses).toHaveLength(0)
    expect(db.appState).toHaveLength(0)
    expect(db.cleanup).toEqual(new Set([
      'file:///documents/scans/failed-before-clear.jpg',
      'file:///documents/scans/scan-1.jpg',
    ]))
    await expect(repository.getCleanupQueue()).resolves.toEqual([
      'file:///documents/scans/failed-before-clear.jpg',
      'file:///documents/scans/scan-1.jpg',
    ])

    await repository.acknowledgeCleanup('file:///documents/scans/scan-1.jpg')
    await expect(repository.getCleanupQueue()).resolves.toEqual([
      'file:///documents/scans/failed-before-clear.jpg',
    ])
  })
})
