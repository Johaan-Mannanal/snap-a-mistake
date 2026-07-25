import * as SQLite from 'expo-sqlite'
import type { MisconceptionTag } from '@snap/shared'
import { createScanRepository, type ScanRepositoryWithLegacyHistory } from './scanRepository'

export type HistoryRecord = { tag: MisconceptionTag | null; correct: boolean; createdAt: string }

let db: SQLite.SQLiteDatabase | null = null
let repository: ScanRepositoryWithLegacyHistory | null = null

export async function initLocalScanStorage(): Promise<void> {
  if (repository) return
  db = await SQLite.openDatabaseAsync('history.db')
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS analyses (id INTEGER PRIMARY KEY AUTOINCREMENT, tag TEXT, correct INTEGER NOT NULL, createdAt TEXT NOT NULL)',
  )
  const createdRepository = createScanRepository(db as unknown as Parameters<typeof createScanRepository>[0])
  await createdRepository.migrate()
  repository = createdRepository
}

// Temporary compatibility facade. Analyze and Insights still read/write legacy aggregate rows.
export async function initDb(): Promise<void> {
  await initLocalScanStorage()
}

export async function recordAnalysis(e: { tag: MisconceptionTag | null; correct: boolean }): Promise<void> {
  await initLocalScanStorage()
  await repository!.recordLegacyAnalysis({ ...e, createdAt: new Date().toISOString() })
}

export async function loadHistory(): Promise<HistoryRecord[]> {
  await initLocalScanStorage()
  const rows = await db!.getAllAsync<{ tag: string | null; correct: number; createdAt: string }>(
    'SELECT tag, correct, createdAt FROM analyses ORDER BY createdAt DESC',
  )
  return rows.map((r) => ({ tag: r.tag as HistoryRecord['tag'], correct: r.correct === 1, createdAt: r.createdAt }))
}
