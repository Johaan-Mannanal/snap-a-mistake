import * as SQLite from 'expo-sqlite'
import type { MisconceptionTag } from '@snap/shared'

export type HistoryRecord = { tag: MisconceptionTag | null; correct: boolean; createdAt: string }

let db: SQLite.SQLiteDatabase | null = null

export async function initDb(): Promise<void> {
  db = await SQLite.openDatabaseAsync('history.db')
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS analyses (id INTEGER PRIMARY KEY AUTOINCREMENT, tag TEXT, correct INTEGER NOT NULL, createdAt TEXT NOT NULL)',
  )
}

export async function recordAnalysis(e: { tag: MisconceptionTag | null; correct: boolean }): Promise<void> {
  if (!db) await initDb()
  await db!.runAsync('INSERT INTO analyses (tag, correct, createdAt) VALUES (?, ?, ?)', [
    e.tag, e.correct ? 1 : 0, new Date().toISOString(),
  ])
}

export async function loadHistory(): Promise<HistoryRecord[]> {
  if (!db) await initDb()
  const rows = await db!.getAllAsync<{ tag: string | null; correct: number; createdAt: string }>(
    'SELECT tag, correct, createdAt FROM analyses ORDER BY createdAt DESC',
  )
  return rows.map((r) => ({ tag: r.tag as HistoryRecord['tag'], correct: r.correct === 1, createdAt: r.createdAt }))
}
