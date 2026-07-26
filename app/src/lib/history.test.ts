import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adaptExpoDatabase, type ExpoDatabaseSource } from './history'
import { createScanRepository } from './scanRepository'
import { clearSessionForDeletedScans, getSession, hydrateSession, resetSession } from './session'

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
}))

type ScanRow = {
  id: string
  image_uri: string
  origin: 'camera'
  attempt_kind: 'original'
  parent_scan_id: null
  lifecycle: 'review' | 'analyzing'
  active_revision_id: null
  feedback: 'unreviewed'
  analysis_duration_ms: null
  follow_up_json: null
  follow_up_status: 'none'
  created_at: string
  updated_at: string
}

function scanRow(id: string): ScanRow {
  return {
    id,
    image_uri: `file:///documents/scans/${id}.jpg`,
    origin: 'camera',
    attempt_kind: 'original',
    parent_scan_id: null,
    lifecycle: 'review',
    active_revision_id: null,
    feedback: 'unreviewed',
    analysis_duration_ms: null,
    follow_up_json: null,
    follow_up_status: 'none',
    created_at: '2026-07-24T12:00:00.000Z',
    updated_at: '2026-07-24T12:00:00.000Z',
  }
}

class NativeFaithfulDatabase {
  readonly scans = new Map<string, ScanRow>()
  readonly cleanup = new Set<string>()
  readonly appState = new Map<string, string>()
  readonly analyses: unknown[] = []
  failScanDelete = false

  async execAsync(): Promise<void> {}

  async runAsync(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowId: number }> {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase()
    if (normalized.startsWith('update scans set lifecycle')) {
      const [lifecycle, updatedAt, id] = params
      const row = this.scans.get(String(id))
      if (!row) return { changes: 0, lastInsertRowId: 0 }
      Object.assign(row, { lifecycle, updated_at: updatedAt })
      return { changes: 1, lastInsertRowId: 0 }
    }
    if (normalized.startsWith('insert') && normalized.includes('into cleanup_queue')) {
      this.cleanup.add(String(params[0]))
      return { changes: 1, lastInsertRowId: 0 }
    }
    if (normalized.startsWith('update cleanup_queue set created_at = created_at'))
      return { changes: this.cleanup.has(String(params[0])) ? 1 : 0, lastInsertRowId: 0 }
    if (normalized.startsWith('delete from cleanup_queue where image_uri')) {
      this.cleanup.delete(String(params[0]))
      return { changes: 1, lastInsertRowId: 0 }
    }
    if (normalized.startsWith('delete from scans where id')) {
      if (this.failScanDelete) throw new Error('delete failed')
      this.scans.delete(String(params[0]))
      return { changes: 1, lastInsertRowId: 0 }
    }
    if (normalized.startsWith('delete from scans')) {
      this.scans.clear()
      return { changes: 1, lastInsertRowId: 0 }
    }
    if (normalized.startsWith('delete from analyses')) {
      this.analyses.splice(0)
      return { changes: 1, lastInsertRowId: 0 }
    }
    if (normalized.startsWith('delete from app_state where')) {
      this.appState.delete(String(params[0]))
      return { changes: 1, lastInsertRowId: 0 }
    }
    if (normalized.startsWith('delete from app_state')) {
      this.appState.clear()
      return { changes: 1, lastInsertRowId: 0 }
    }
    throw new Error(`Unhandled run: ${sql}`)
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase()
    if (normalized.includes('from scans where image_uri')) {
      const referenced = [...this.scans.values()].some((row) => row.image_uri === String(params[0]))
      return (referenced ? { referenced: 1 } : null) as T | null
    }
    if (normalized.includes('from scans where id'))
      return (this.scans.get(String(params[0])) ?? null) as T | null
    if (normalized.includes('from app_state where key')) {
      const value = this.appState.get(String(params[0]))
      return value === undefined ? null : { value_json: value } as T
    }
    throw new Error(`Unhandled first: ${sql}`)
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase()
    if (normalized.includes('from scan_revisions where scan_id')) return []
    if (normalized.includes('with recursive descendant_scans')) {
      const row = this.scans.get(String(params[0]))
      return (row ? [row] : []) as T[]
    }
    if (normalized.includes('from scans where parent_scan_id')) return []
    if (normalized.includes('from scans')) return [...this.scans.values()] as T[]
    if (normalized.includes('from analyses')) return [] as T[]
    if (normalized.includes('from cleanup_queue'))
      return [...this.cleanup].map((image_uri) => ({ image_uri })) as T[]
    throw new Error(`Unhandled all: ${sql}`)
  }

  async withExclusiveTransactionAsync(task: (transaction: NativeFaithfulDatabase) => Promise<void>): Promise<void> {
    const scans = new Map([...this.scans].map(([key, value]) => [key, { ...value }]))
    const cleanup = new Set(this.cleanup)
    try {
      await task(this)
      // Expo SQLite commits successfully but intentionally discards task returns.
    } catch (error) {
      this.scans.clear()
      scans.forEach((value, key) => this.scans.set(key, value))
      this.cleanup.clear()
      cleanup.forEach((value) => this.cleanup.add(value))
      throw error
    }
  }
}

describe('Expo SQLite repository adapter', () => {
  beforeEach(async () => {
    await resetSession()
  })

  it('returns delete commits so historical session and cleanup work can finish after commit', async () => {
    const native = new NativeFaithfulDatabase()
    native.scans.set('delete-me', scanRow('delete-me'))
    native.appState.set('active-session', JSON.stringify({
      routeIntent: 'review',
      pendingScanId: 'delete-me',
      photoUri: 'file:///documents/scans/delete-me.jpg',
      origin: 'camera',
      analysis: null,
      followUp: null,
      followUpHintVisible: false,
      previousFollowUpProblems: [],
      parentScanId: null,
    }))
    const repository = createScanRepository(adaptExpoDatabase(native as unknown as ExpoDatabaseSource))
    const physicallyDeleted: string[] = []
    await hydrateSession(repository)

    await expect((async () => {
      const committed = await repository.delete('delete-me')
      if (committed === null) throw new Error('expected committed deletion')
      await clearSessionForDeletedScans(committed.deletedScanIds)
      for (const uri of committed.queuedUris)
        await repository.cleanupQueuedUri(uri, async () => { physicallyDeleted.push(uri) })
    })()).resolves.toBeUndefined()

    expect(getSession()).toMatchObject({ routeIntent: 'capture', pendingScanId: null })
    expect(physicallyDeleted).toEqual(['file:///documents/scans/delete-me.jpg'])
    expect(native.cleanup).toEqual(new Set())
  })

  it('returns clear-all commits and another result-returning transaction value', async () => {
    const native = new NativeFaithfulDatabase()
    native.scans.set('keep-until-clear', scanRow('keep-until-clear'))
    const repository = createScanRepository(adaptExpoDatabase(native as unknown as ExpoDatabaseSource))

    await expect(repository.setLifecycle('keep-until-clear', 'analyzing'))
      .resolves.toMatchObject({ id: 'keep-until-clear', lifecycle: 'analyzing' })
    await expect(repository.clearAll()).resolves.toEqual({
      deletedScanIds: ['keep-until-clear'],
      queuedUris: ['file:///documents/scans/keep-until-clear.jpg'],
    })
  })

  it('preserves native rollback and propagates the original transaction error', async () => {
    const native = new NativeFaithfulDatabase()
    native.scans.set('delete-me', scanRow('delete-me'))
    native.failScanDelete = true
    const repository = createScanRepository(adaptExpoDatabase(native as unknown as ExpoDatabaseSource))

    await expect(repository.delete('delete-me')).rejects.toThrow('delete failed')
    expect(native.scans.has('delete-me')).toBe(true)
    expect(native.cleanup).toEqual(new Set())
  })
})
