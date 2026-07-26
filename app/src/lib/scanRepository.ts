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
  type ScanLifecycle,
  type TrendSource,
  type PersistedSession,
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
  setLifecycle(scanId: string, lifecycle: Extract<ScanLifecycle, 'analyzing' | 'interrupted' | 'unsaved'>): Promise<ScanRecord>
  saveRevision(scanId: string, revision: ScanRevision, durationMs: number): Promise<ScanRecord>
  applyCorrection(scanId: string, rejectedRevisionId: string, revision: ScanRevision, durationMs: number, session?: PersistedSession, isCurrent?: () => boolean): Promise<ScanRecord>
  excludeDiagnosis(scanId: string, session?: PersistedSession, isCurrent?: () => boolean): Promise<ScanRecord>
  setFeedback(scanId: string, feedback: FeedbackState): Promise<ScanRecord>
  setFollowUpStatus(scanId: string, status: FollowUpStatus, isCurrent?: () => boolean): Promise<ScanRecord>
  get(scanId: string): Promise<ScanRecord | null>
  list(): Promise<ScanRecord[]>
  loadTrendSources(): Promise<TrendSource[]>
  delete(scanId: string): Promise<string | null>
  discardReviewAndSession(input: { scanId: string; ownedUri: string | null }): Promise<void>
  clearAll(): Promise<string[]>
  getCleanupQueue(): Promise<string[]>
  acknowledgeCleanup(imageUri: string): Promise<void>
  commitFollowUpStartIfCurrent(parentScanId: string, session: PersistedSession, targetStatus: FollowUpStatus, isCurrent: () => boolean): Promise<boolean>
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
  feedback: FeedbackState
  created_at: string
}

const SCHEMA_VERSION = 2
const ACTIVE_SESSION_KEY = 'active-session'

class FollowUpStartStaleError extends Error {}

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

function followUpStatusForChild(parent: ScanRecord, response: AnalyzeResponse): FollowUpStatus {
  const parentAnalysis = parent.activeRevision?.response
  const resolved = response.kind === 'analysis'
    && parentAnalysis?.kind === 'analysis'
    && (response.errorStepIndex === null || response.misconceptionTag !== parentAnalysis.misconceptionTag)
  return resolved ? 'resolved' : 'unresolved'
}

async function updateParentFollowUpStatus(
  db: DatabasePort,
  child: ScanRecord,
  response: AnalyzeResponse,
): Promise<void> {
  if (child.parentScanId === null) return
  const parent = await requireRecord(db, child.parentScanId)
  if (parent.followUp === null) return
  const status = followUpStatusForChild(parent, response)
  if (parent.followUpStatus === status) return
  await db.runAsync('UPDATE scans SET follow_up_status = ?, updated_at = ? WHERE id = ?', [status, now(), parent.id])
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
    'SELECT id, scan_id, reason, response_json, feedback, created_at FROM scan_revisions WHERE scan_id = ? ORDER BY created_at ASC, id ASC',
    [scanId],
  )
  const revisions = revisionRows.map((revision) => ScanRevisionSchema.parse({
    id: revision.id,
    reason: revision.reason,
    response: AnalyzeResponseSchema.parse(parseJson(revision.response_json)),
    feedback: revision.feedback,
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
        if (currentVersion === 0) await transaction.execAsync(`
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
            feedback TEXT NOT NULL DEFAULT 'unreviewed',
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
        `)
        if (currentVersion === 1) await transaction.execAsync("ALTER TABLE scan_revisions ADD COLUMN feedback TEXT NOT NULL DEFAULT 'unreviewed';")
        await transaction.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`)
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

    async setLifecycle(scanId, lifecycle): Promise<ScanRecord> {
      return db.withExclusiveTransactionAsync(async (transaction) => {
        await requireRecord(transaction, scanId)
        await transaction.runAsync('UPDATE scans SET lifecycle = ?, updated_at = ? WHERE id = ?', [lifecycle, now(), scanId])
        return requireRecord(transaction, scanId)
      })
    },

    async saveRevision(scanId, revision, durationMs): Promise<ScanRecord> {
      const validatedRevision = ScanRevisionSchema.parse(revision)
      const savedRevision: ScanRevision = {
        ...validatedRevision,
        feedback: validatedRevision.reason === 'student-correction' ? 'corrected' : validatedRevision.feedback,
      }
      if (!Number.isInteger(durationMs) || durationMs < 0) throw new Error('durationMs must be a non-negative integer')
      return db.withExclusiveTransactionAsync(async (transaction) => {
        const scan = await requireRecord(transaction, scanId)
        const existingRevision = scan.revisions.find((item) => item.id === savedRevision.id)
        if (existingRevision && JSON.stringify(existingRevision) !== JSON.stringify(savedRevision))
          throw new Error(`revision ${savedRevision.id} does not match the saved revision`)
        const followUp = responseFollowUp(savedRevision.response)
        const feedback: FeedbackState = savedRevision.reason === 'student-correction' ? 'corrected' : scan.feedback
        const updatedAt = now()
        if (!existingRevision)
          await transaction.runAsync(
            'INSERT INTO scan_revisions (id, scan_id, reason, response_json, feedback, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [savedRevision.id, scanId, savedRevision.reason, JSON.stringify(savedRevision.response), savedRevision.feedback, savedRevision.createdAt],
          )
        await transaction.runAsync(
          `UPDATE scans SET active_revision_id = ?, lifecycle = ?, analysis_duration_ms = ?, follow_up_json = ?,
           follow_up_status = ?, feedback = ?, updated_at = ? WHERE id = ?`,
          [savedRevision.id, 'complete', durationMs, followUp === null ? null : JSON.stringify(followUp),
            statusForResponse(validatedRevision.response, scan.followUpStatus), feedback, updatedAt, scanId],
        )
        await updateParentFollowUpStatus(transaction, scan, validatedRevision.response)
        return requireRecord(transaction, scanId)
      })
    },

    async applyCorrection(scanId, rejectedRevisionId, revision, durationMs, persistedSession, isCurrent): Promise<ScanRecord> {
      const validatedRevision = ScanRevisionSchema.parse(revision)
      if (validatedRevision.reason !== 'student-correction') throw new Error('correction revisions must use student-correction')
      if (!Number.isInteger(durationMs) || durationMs < 0) throw new Error('durationMs must be a non-negative integer')
      const correctedRevision: ScanRevision = { ...validatedRevision, feedback: 'corrected' }
      return db.withExclusiveTransactionAsync(async (transaction) => {
        const requireCurrent = () => {
          if (isCurrent && !isCurrent()) throw new Error('correction is no longer current')
        }
        requireCurrent()
        const scan = await requireRecord(transaction, scanId)
        requireCurrent()
        const rejectedRevision = scan.revisions.find((item) => item.id === rejectedRevisionId)
        if (!rejectedRevision) throw new Error(`revision ${rejectedRevisionId} not found`)
        if (rejectedRevision.feedback === 'rejected') throw new Error('cannot replace a rejected revision')
        if (scan.activeRevision?.id !== rejectedRevisionId) throw new Error('only the active revision can be corrected')
        const existing = scan.revisions.find((item) => item.id === correctedRevision.id)
        if (existing && JSON.stringify(existing) !== JSON.stringify(correctedRevision))
          throw new Error(`revision ${correctedRevision.id} does not match the saved revision`)
        await transaction.runAsync('UPDATE scan_revisions SET feedback = ? WHERE id = ?', ['rejected', rejectedRevisionId])
        requireCurrent()
        if (!existing) await transaction.runAsync(
          'INSERT INTO scan_revisions (id, scan_id, reason, response_json, feedback, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [correctedRevision.id, scanId, correctedRevision.reason, JSON.stringify(correctedRevision.response), correctedRevision.feedback, correctedRevision.createdAt],
        )
        requireCurrent()
        const followUp = responseFollowUp(correctedRevision.response)
        await transaction.runAsync(
          `UPDATE scans SET active_revision_id = ?, lifecycle = ?, analysis_duration_ms = ?, follow_up_json = ?,
           follow_up_status = ?, feedback = ?, updated_at = ? WHERE id = ?`,
          [correctedRevision.id, 'complete', durationMs, followUp === null ? null : JSON.stringify(followUp),
            statusForResponse(correctedRevision.response, scan.followUpStatus), 'corrected', now(), scanId],
        )
        requireCurrent()
        await updateParentFollowUpStatus(transaction, scan, correctedRevision.response)
        requireCurrent()
        if (persistedSession) await transaction.runAsync(
          `INSERT INTO app_state (key, value_json) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
          [ACTIVE_SESSION_KEY, JSON.stringify(persistedSession)],
        )
        requireCurrent()
        const record = await requireRecord(transaction, scanId)
        requireCurrent()
        return record
      })
    },

    async setFeedback(scanId, feedback): Promise<ScanRecord> {
      return db.withExclusiveTransactionAsync(async (transaction) => {
        await requireRecord(transaction, scanId)
        await transaction.runAsync('UPDATE scans SET feedback = ?, updated_at = ? WHERE id = ?', [feedback, now(), scanId])
        return requireRecord(transaction, scanId)
      })
    },

    async excludeDiagnosis(scanId, persistedSession, isCurrent): Promise<ScanRecord> {
      return db.withExclusiveTransactionAsync(async (transaction) => {
        const requireCurrent = () => {
          if (isCurrent && !isCurrent()) throw new Error('exclusion is no longer current')
        }
        requireCurrent()
        const scan = await requireRecord(transaction, scanId)
        requireCurrent()
        await transaction.runAsync(
          `UPDATE scans SET active_revision_id = ?, lifecycle = ?, analysis_duration_ms = ?, follow_up_json = ?,
           follow_up_status = ?, feedback = ?, updated_at = ? WHERE id = ?`,
          [null, 'review', null, null, 'none', 'excluded', now(), scanId],
        )
        requireCurrent()
        await updateParentFollowUpStatus(transaction, scan, { kind: 'not-math' })
        requireCurrent()
        if (persistedSession) await transaction.runAsync(
          `INSERT INTO app_state (key, value_json) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
          [ACTIVE_SESSION_KEY, JSON.stringify(persistedSession)],
        )
        requireCurrent()
        const record = await requireRecord(transaction, scanId)
        requireCurrent()
        return record
      })
    },

    async setFollowUpStatus(scanId, status, isCurrent): Promise<ScanRecord> {
      return db.withExclusiveTransactionAsync(async (transaction) => {
        const requireCurrent = () => {
          if (isCurrent && !isCurrent()) throw new Error('follow-up status is no longer current')
        }
        requireCurrent()
        const scan = await requireRecord(transaction, scanId)
        requireCurrent()
        if (scan.followUpStatus === status) return scan
        await transaction.runAsync('UPDATE scans SET follow_up_status = ?, updated_at = ? WHERE id = ?', [status, now(), scanId])
        requireCurrent()
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
        ...scans.filter((scan) => scan.lifecycle === 'complete').map((scan): TrendSource => ({ kind: 'scan', scan })),
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

    async discardReviewAndSession(input): Promise<void> {
      await db.withExclusiveTransactionAsync(async (transaction) => {
        const scan = await readRecord(transaction, input.scanId)
        if (scan) {
          const descendants = await transaction.getAllAsync<{ image_uri: string }>(`
            WITH RECURSIVE descendant_scans(id, image_uri) AS (
              SELECT id, image_uri FROM scans WHERE id = ?
              UNION ALL
              SELECT scans.id, scans.image_uri
              FROM scans JOIN descendant_scans ON scans.parent_scan_id = descendant_scans.id
            )
            SELECT image_uri FROM descendant_scans
          `, [input.scanId])
          for (const descendant of descendants)
            await transaction.runAsync(
              'INSERT OR IGNORE INTO cleanup_queue (image_uri, created_at) VALUES (?, ?)',
              [descendant.image_uri, now()],
            )
          await transaction.runAsync('DELETE FROM scans WHERE id = ?', [input.scanId])
        } else if (input.ownedUri !== null) {
          await transaction.runAsync(
            'INSERT OR IGNORE INTO cleanup_queue (image_uri, created_at) VALUES (?, ?)',
            [input.ownedUri, now()],
          )
        }
        await transaction.runAsync('DELETE FROM app_state WHERE key = ?', [ACTIVE_SESSION_KEY])
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

    async commitFollowUpStartIfCurrent(parentScanId, session, targetStatus, isCurrent): Promise<boolean> {
      if (session.routeIntent !== 'follow-up' || session.parentScanId !== parentScanId || session.followUp === null)
        throw new Error('follow-up session does not match its parent scan')
      if (targetStatus !== 'in-progress') throw new Error('follow-up starts must target in-progress')
      try {
        return await db.withExclusiveTransactionAsync(async (transaction) => {
          const requireCurrent = () => {
            if (!isCurrent()) throw new FollowUpStartStaleError()
          }

          requireCurrent()
          const parent = await requireRecord(transaction, parentScanId)
          if (parent.followUp === null || (parent.followUpStatus !== 'ready' && parent.followUpStatus !== 'in-progress'))
            throw new Error('parent scan is not ready for a follow-up start')
          requireCurrent()

          if (parent.followUpStatus !== targetStatus) {
            await transaction.runAsync(
              'UPDATE scans SET follow_up_status = ?, updated_at = ? WHERE id = ?',
              [targetStatus, now(), parentScanId],
            )
          }
          requireCurrent()

          await transaction.runAsync(
            `INSERT INTO app_state (key, value_json) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
            [ACTIVE_SESSION_KEY, JSON.stringify(session)],
          )
          requireCurrent()
          return true
        })
      } catch (error) {
        if (error instanceof FollowUpStartStaleError) return false
        throw error
      }
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
