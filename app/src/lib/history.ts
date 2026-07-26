import * as SQLite from 'expo-sqlite'
import {
  createScanRepository,
  type DatabasePort,
  type ScanRepositoryWithLegacyHistory,
} from './scanRepository'

export type ExpoDatabaseSource = Pick<
  SQLite.SQLiteDatabase,
  'execAsync' | 'runAsync' | 'getFirstAsync' | 'getAllAsync' | 'withExclusiveTransactionAsync'
>

function bindParams(params: unknown[] | undefined): SQLite.SQLiteBindValue[] {
  return (params ?? []) as SQLite.SQLiteBindValue[]
}

export function adaptExpoDatabase(database: ExpoDatabaseSource): DatabasePort {
  return {
    execAsync: (sql) => database.execAsync(sql),
    runAsync: (sql, params) => database.runAsync(sql, bindParams(params)),
    getFirstAsync: <T>(sql: string, params?: unknown[]) => database.getFirstAsync<T>(sql, bindParams(params)),
    getAllAsync: <T>(sql: string, params?: unknown[]) => database.getAllAsync<T>(sql, bindParams(params)),
    async withExclusiveTransactionAsync<T>(task: (transaction: DatabasePort) => Promise<T>): Promise<T> {
      let completed = false
      let result!: T
      await database.withExclusiveTransactionAsync(async (transaction) => {
        result = await task(adaptExpoDatabase(transaction))
        completed = true
      })
      if (!completed) throw new Error('exclusive transaction completed without running its task')
      return result
    },
  }
}

let db: SQLite.SQLiteDatabase | null = null
let repository: ScanRepositoryWithLegacyHistory | null = null

export async function initLocalScanStorage(): Promise<void> {
  if (repository) return
  db = await SQLite.openDatabaseAsync('history.db')
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS analyses (id INTEGER PRIMARY KEY AUTOINCREMENT, tag TEXT, correct INTEGER NOT NULL, createdAt TEXT NOT NULL)',
  )
  const createdRepository = createScanRepository(adaptExpoDatabase(db))
  await createdRepository.migrate()
  repository = createdRepository
}

export function getLocalScanRepository(): ScanRepositoryWithLegacyHistory {
  if (!repository) throw new Error('local scan storage is not initialized')
  return repository
}
