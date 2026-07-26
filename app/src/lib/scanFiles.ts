import { Directory, File, Paths } from 'expo-file-system'
import type { ScanRepository } from './scanRepository'

export type FilePort = {
  readonly scanDirectoryUri: string
  createScanDirectory(): void | Promise<void>
  copy(sourceUri: string, destinationUri: string): Promise<void>
  parentDirectoryUri(uri: string): string
  exists(uri: string): boolean
  delete(uri: string): void | Promise<void>
}

function normalizeDirectoryUri(uri: string): string {
  const parsed = new URL(uri)
  if (parsed.protocol !== 'file:') throw new Error('owned scan files must use file URIs')
  const normalized = parsed.toString()
  return normalized.endsWith('/') ? normalized : `${normalized}/`
}

function validateScanId(scanId: string): void {
  if (!scanId || scanId === '.' || scanId === '..' || /[\\/]/.test(scanId))
    throw new Error('scan ID must be a single path segment')
}

function destinationUri(scanId: string, files: FilePort): string {
  validateScanId(scanId)
  return new URL(`${scanId}.jpg`, normalizeDirectoryUri(files.scanDirectoryUri)).toString()
}

function createExpoFilePort(): FilePort {
  const scanDirectory = new Directory(Paths.document, 'scans')
  return {
    scanDirectoryUri: scanDirectory.uri,
    createScanDirectory: () => scanDirectory.create({ idempotent: true, intermediates: true }),
    copy: (sourceUri, destinationUri) => {
      const source = new File(sourceUri)
      const destination = new File(scanDirectory, new File(destinationUri).name)
      return source.copy(destination, { overwrite: true })
    },
    parentDirectoryUri: (uri) => new File(uri).parentDirectory.uri,
    exists: (uri) => new File(uri).exists,
    delete: (uri) => new File(uri).delete(),
  }
}

export async function ownScanPhoto(
  scanId: string,
  sourceUri: string,
  repository: Pick<ScanRepository, 'reserveOwnedPhoto'>,
  files: FilePort = createExpoFilePort(),
): Promise<string> {
  const destination = destinationUri(scanId, files)
  await files.createScanDirectory()
  await repository.reserveOwnedPhoto(destination)
  await files.copy(sourceUri, destination)
  return destination
}

export async function deleteOwnedPhoto(uri: string, files: FilePort = createExpoFilePort()): Promise<void> {
  const ownedDirectory = normalizeDirectoryUri(files.scanDirectoryUri)
  const parentDirectory = normalizeDirectoryUri(files.parentDirectoryUri(uri))
  if (parentDirectory !== ownedDirectory) throw new Error('photo is outside scan directory')
  if (!files.exists(uri)) return
  await files.delete(uri)
}

export async function flushCleanupQueue(repository: ScanRepository, files: FilePort = createExpoFilePort()): Promise<void> {
  const queuedUris = await repository.getCleanupQueue()
  for (const uri of new Set(queuedUris)) {
    try {
      await repository.cleanupQueuedUri(uri, () => deleteOwnedPhoto(uri, files))
    } catch {
      // Keep the cleanup marker so the next launch can retry safely.
    }
  }
}

export async function flushCommittedCleanup(repository: ScanRepository, files: FilePort = createExpoFilePort()): Promise<{ pending: boolean }> {
  try {
    await flushCleanupQueue(repository, files)
    return { pending: (await repository.getCleanupQueue()).length > 0 }
  } catch {
    return { pending: true }
  }
}
