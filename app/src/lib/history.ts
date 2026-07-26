import * as SQLite from 'expo-sqlite'
import { createScanRepository, type ScanRepositoryWithLegacyHistory } from './scanRepository'

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

export function getLocalScanRepository(): ScanRepositoryWithLegacyHistory {
  if (!repository) throw new Error('local scan storage is not initialized')
  return repository
}
