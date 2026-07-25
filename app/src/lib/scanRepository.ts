import { type z } from 'zod'
import {
  AnalyzeResponseSchema,
  type AnalyzeResponse,
  type FollowUp,
  type MisconceptionTag,
} from '@snap/shared'
import {
  type FeedbackState,
  type FollowUpStatus,
  type NewScanDraft,
  type ScanRecord,
  ScanRecordSchema,
  type ScanRevision,
  ScanRevisionSchema,
  type TrendSource,
} from './scanTypes'

export interface DatabasePort {
  execAsync(sql: string): Promise<void>
  runAsync(sql: string, params?: unknown[]): Promise<{ changes: number }>
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>
  withExclusiveTransactionAsync<T>(task: (transaction: DatabasePort) => Promise<T>): Promise<T>
}

export interface ScanRepository {
  migrate(): Promise<void>
  createDraft(input: NewScanDraft): Promise<ScanRecord>
  saveRevision(scanId: string, revision: ScanRevision, durationMs: number): Promise<ScanRecord>
  setFeedback(scanId: string, feedback: FeedbackState): Promise<ScanRecord>
  setFollowUpStatus(scanId: string, status: FollowUpStatus): Promise<ScanRecord>
  get(scanId: string): Promise<ScanRecord | null>
  list(): Promise<ScanRecord[]>
  loadTrendSources(): Promise<TrendSource[]>
  delete(scanId: string): Promise<string | null>
  clearAll(): Promise<string[]>
  getCleanupQueue(): Promise<string[]>
  acknowledgeCleanup(imageUri: string): Promise<void>
  getState<T>(key: string, schema: z.ZodType<T>): Promise<T | null>
  setState<T>(key: string, value: T): Promise<void>
  deleteState(key: string): Promise<void>
}

export type ScanRepositoryWithLegacyHistory = ScanRepository & {
  recordLegacyAnalysis(entry: { tag: MisconceptionTag | null; correct: boolean; createdAt: string }): Promise<void>
}

type ScanRow = {
  id: string
  image_uri: string
  origin: ScanRecord['origin']
  attempt_kind: ScanRecord['attemptKind']
  parent_scan_id: string | null
  lifecycle: ScanRecord['lifecycle']
  active_revision_id: string | null
  feedback: FeedbackState
  analysis_duration_ms: number | null
  follow_up_json: string | null
  follow_up_status: FollowUpStatus
  created_at: string
  updated_at: string
}

type RevisionRow = {
  id: string
  scan_id: string
  reason: ScanRevision['reason']
  response_json: string
  created_at: string
}

const SCHEMA_VERSION = 1

const scanSelect = `
  SELECT id, image_uri, origin, attempt_kind, parent_scan_id, lifecycle,
         active_revision_id, feedback, analysis_duration_ms, follow_up_json,
         follow_up_status, created_at, updated_at
  FROM scans`

function now(): string {
  return new Date().toISOString()
}

function parseJson(value: string): unknown {
  return JSON.parse(value)
}

function responseFollowUp(response: AnalyzeResponse): FollowUp | null {
  return response.kind === 'analysis' ? response.followUp : null
}

function statusForResponse(response: AnalyzeResponse, current: FollowUpStatus): FollowUpStatus {
  if (responseFollowUp(response)) return current === 'none' ? 'ready' : current
  return 'none'
}

function draftRecord(input: NewScanDraft): ScanRecord {
  return ScanRecordSchema.parse({
    ...input,
    lifecycle: 'review',
    activeRevision: null,
    revisions: [],
    feedback: 'unreviewed',
    analysisDurationMs: null,
    followUp: null,
    followUpStatus: 'none',
    updatedAt: input.createdAt,
  })
}

async function readRecord(db: DatabasePort, scanId: string): Promise<ScanRecord | null> {
  const row = await db.getFirstAsync<ScanRow>(`${scanSelect} WHERE id = ?`, [scanId])
  if (!row) return null
  const revisionRows = await db.getAllAsync<RevisionRow>(
    'SELECT id, scan_id, reason, response_json, created_at FROM scan_revisions WHERE scan_id = ? ORDER BY created_at ASC, id ASC',
    [scanId],
  )
  const revisions = revisionRows.map((revision) => ScanRevisionSchema.parse({
    id: revision.id,
    reason: revision.reason,
    response: AnalyzeResponseSchema.parse(parseJson(revision.response_json)),
    createdAt: revision.created_at,
  }))
  const activeRevision = row.active_revision_id === null
    ? null
    : revisions.find((revision) => revision.id === row.active_revision_id) ?? null
  return ScanRecordSchema.parse({
    id: row.id,
    imageUri: row.image_uri,
    origin: row.origin,
    attemptKind: row.attempt_kind,
    parentScanId: row.parent_scan_id,
    lifecycle: row.lifecycle,
    activeRevision,
    revisions,
    feedback: row.feedback,
    analysisDurationMs: row.analysis_duration_ms,
    followUp: row.follow_up_json === null ? null : parseJson(row.follow_up_json),
    followUpStatus: row.follow_up_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

async function requireRecord(db: DatabasePort, scanId: string): Promise<ScanRecord> {
  const scan = await readRecord(db, scanId)
  if (!scan) throw new Error(`scan not found: ${scanId}`)
  return scan
}

export function createScanRepository(db: DatabasePort): ScanRepositoryWithLegacyHistory {
  return {
    async migrate(): Promise<void> {
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
      await db.withExclusiveTransactionAsync(async (transaction) => {
        const currentVersion = (await transaction.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0
        if (currentVersion > SCHEMA_VERSION)
          throw new Error(`database version ${currentVersion} is newer than supported version ${SCHEMA_VERSION}`)
        if (currentVersion === SCHEMA_VERSION) return
        await transaction.execAsync(`
          CREATE TABLE IF NOT EXISTS scans (
            id TEXT PRIMARY KEY NOT NULL,
            image_uri TEXT NOT NULL,
            origin TEXT NOT NULL,
            attempt_kind TEXT NOT NULL,
            parent_scan_id TEXT REFERENCES scans(id) ON DELETE CASCADE,
            lifecycle TEXT NOT NULL,
            active_revision_id TEXT,
            feedback TEXT NOT NULL,
            analysis_duration_ms INTEGER,
            follow_up_json TEXT,
            follow_up_status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS scan_revisions (
            id TEXT PRIMARY KEY NOT NULL,
            scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
            reason TEXT NOT NULL,
            response_json TEXT NOT NULL,
            created_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS app_state (
            key TEXT PRIMARY KEY NOT NULL,
            value_json TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS cleanup_queue (
            image_uri TEXT PRIMARY KEY NOT NULL,
            created_at TEXT NOT NULL
          );
          PRAGMA user_version = ${SCHEMA_VERSION};
        `)
      })
    },

    async createDraft(input): Promise<ScanRecord> {
      const scan = draftRecord(input)
      await db.withExclusiveTransactionAsync(async (transaction) => {
        await transaction.runAsync(
          `INSERT INTO scans (
            id, image_uri, origin, attempt_kind, parent_scan_id, lifecycle,
            feedback, analysis_duration_ms, follow_up_json, follow_up_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [scan.id, scan.imageUri, scan.origin, scan.attemptKind, scan.parentScanId, scan.lifecycle,
            scan.feedback, scan.analysisDurationMs, null, scan.followUpStatus, scan.createdAt, scan.updatedAt],
        )
      })
      return scan
    },

    async saveRevision(scanId, revision, durationMs): Promise<ScanRecord> {
      const validatedRevision = ScanRevisionSchema.parse(revision)
      if (!Number.isInteger(durationMs) || durationMs < 0) throw new Error('durationMs must be a non-negative integer')
      return db.withExclusiveTransactionAsync(async (transaction) => {
        const scan = await requireRecord(transaction, scanId)
        const followUp = responseFollowUp(validatedRevision.response)
        const feedback: FeedbackState = validatedRevision.reason === 'student-correction' ? 'corrected' : scan.feedback
        const updatedAt = now()
        await transaction.runAsync(
          'INSERT INTO scan_revisions (id, scan_id, reason, response_json, created_at) VALUES (?, ?, ?, ?, ?)',
          [validatedRevision.id, scanId, validatedRevision.reason, JSON.stringify(validatedRevision.response), validatedRevision.createdAt],
        )
        await transaction.runAsync(
          `UPDATE scans SET active_revision_id = ?, lifecycle = ?, analysis_duration_ms = ?, follow_up_json = ?,
           follow_up_status = ?, feedback = ?, updated_at = ? WHERE id = ?`,
          [validatedRevision.id, 'complete', durationMs, followUp === null ? null : JSON.stringify(followUp),
            statusForResponse(validatedRevision.response, scan.followUpStatus), feedback, updatedAt, scanId],
        )
        return requireRecord(transaction, scanId)
      })
    },

    async setFeedback(scanId, feedback): Promise<ScanRecord> {
      return db.withExclusiveTransactionAsync(async (transaction) => {
        await requireRecord(transaction, scanId)
        await transaction.runAsync('UPDATE scans SET feedback = ?, updated_at = ? WHERE id = ?', [feedback, now(), scanId])
        return requireRecord(transaction, scanId)
      })
    },

    async setFollowUpStatus(scanId, status): Promise<ScanRecord> {
      return db.withExclusiveTransactionAsync(async (transaction) => {
        await requireRecord(transaction, scanId)
        await transaction.runAsync('UPDATE scans SET follow_up_status = ?, updated_at = ? WHERE id = ?', [status, now(), scanId])
        return requireRecord(transaction, scanId)
      })
    },

    async get(scanId): Promise<ScanRecord | null> {
      return readRecord(db, scanId)
    },

    async list(): Promise<ScanRecord[]> {
      const rows = await db.getAllAsync<ScanRow>(`${scanSelect} ORDER BY created_at DESC, id DESC`)
      return Promise.all(rows.map((row) => requireRecord(db, row.id)))
    },

    async loadTrendSources(): Promise<TrendSource[]> {
      const scans = await this.list()
      const legacy = await db.getAllAsync<{ tag: string | null; correct: number; createdAt: string }>(
        'SELECT tag, correct, createdAt FROM analyses ORDER BY createdAt DESC',
      )
      return [
        ...scans.map((scan): TrendSource => ({ kind: 'scan', scan })),
        ...legacy.map((row): TrendSource => ({
          kind: 'legacy', tag: row.tag as MisconceptionTag | null, correct: row.correct === 1, createdAt: row.createdAt,
        })),
      ]
    },

    async recordLegacyAnalysis(entry): Promise<void> {
      await db.withExclusiveTransactionAsync((transaction) => transaction.runAsync(
        'INSERT INTO analyses (tag, correct, createdAt) VALUES (?, ?, ?)',
        [entry.tag, entry.correct ? 1 : 0, entry.createdAt],
      ).then(() => undefined))
    },

    async delete(scanId): Promise<string | null> {
      return db.withExclusiveTransactionAsync(async (transaction) => {
        const scan = await readRecord(transaction, scanId)
        if (!scan) return null
        const descendants = await transaction.getAllAsync<{ image_uri: string }>(`
          WITH RECURSIVE descendant_scans(id, image_uri) AS (
            SELECT id, image_uri FROM scans WHERE id = ?
            UNION ALL
            SELECT scans.id, scans.image_uri
            FROM scans JOIN descendant_scans ON scans.parent_scan_id = descendant_scans.id
          )
          SELECT image_uri FROM descendant_scans
        `, [scanId])
        for (const descendant of descendants)
          await transaction.runAsync('INSERT INTO cleanup_queue (image_uri, created_at) VALUES (?, ?)', [descendant.image_uri, now()])
        await transaction.runAsync('DELETE FROM scans WHERE id = ?', [scanId])
        return scan.imageUri
      })
    },

    async clearAll(): Promise<string[]> {
      return db.withExclusiveTransactionAsync(async (transaction) => {
        const rows = await transaction.getAllAsync<{ image_uri: string }>('SELECT image_uri FROM scans')
        await transaction.runAsync('DELETE FROM scans')
        await transaction.runAsync('DELETE FROM analyses')
        await transaction.runAsync('DELETE FROM app_state')
        for (const row of rows)
          await transaction.runAsync(
            'INSERT OR IGNORE INTO cleanup_queue (image_uri, created_at) VALUES (?, ?)',
            [row.image_uri, now()],
          )
        const queued = await transaction.getAllAsync<{ image_uri: string }>(
          'SELECT image_uri FROM cleanup_queue ORDER BY created_at ASC, image_uri ASC',
        )
        return queued.map((row) => row.image_uri)
      })
    },

    async getCleanupQueue(): Promise<string[]> {
      const rows = await db.getAllAsync<{ image_uri: string }>(
        'SELECT image_uri FROM cleanup_queue ORDER BY created_at ASC, image_uri ASC',
      )
      return rows.map((row) => row.image_uri)
    },

    async acknowledgeCleanup(imageUri): Promise<void> {
      await db.withExclusiveTransactionAsync((transaction) => transaction.runAsync(
        'DELETE FROM cleanup_queue WHERE image_uri = ?', [imageUri],
      ).then(() => undefined))
    },

    async getState<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
      const row = await db.getFirstAsync<{ value_json: string }>('SELECT value_json FROM app_state WHERE key = ?', [key])
      if (!row) return null
      try {
        const parsed = schema.safeParse(parseJson(row.value_json))
        return parsed.success ? parsed.data : null
      } catch {
        return null
      }
    },

    async setState<T>(key: string, value: T): Promise<void> {
      await db.withExclusiveTransactionAsync((transaction) => transaction.runAsync(
        `INSERT INTO app_state (key, value_json) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
        [key, JSON.stringify(value)],
      ).then(() => undefined))
    },

    async deleteState(key: string): Promise<void> {
      await db.withExclusiveTransactionAsync((transaction) => transaction.runAsync(
        'DELETE FROM app_state WHERE key = ?', [key],
      ).then(() => undefined))
    },
  }
}
