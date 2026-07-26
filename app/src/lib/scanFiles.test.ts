import { describe, expect, it, vi } from 'vitest'
import type { ScanRepository } from './scanRepository'
import { deleteOwnedPhoto, flushCommittedCleanup, flushCleanupQueue, ownScanPhoto, type FilePort } from './scanFiles'

vi.mock('expo-file-system', () => ({
  Directory: class {},
  File: class {},
  Paths: { document: 'file:///documents/' },
}))

class MemoryFiles implements FilePort {
  readonly scanDirectoryUri = 'file:///documents/scans/'
  readonly files = new Set<string>()
  readonly copied: { source: string; destination: string }[] = []
  readonly deleted: string[] = []
  createdDirectories = 0
  failDeletesFor = new Set<string>()

  async createScanDirectory(): Promise<void> {
    this.createdDirectories += 1
  }

  async copy(sourceUri: string, destinationUri: string): Promise<void> {
    if (!this.files.has(sourceUri)) throw new Error('source file is missing')
    this.files.add(destinationUri)
    this.copied.push({ source: sourceUri, destination: destinationUri })
  }

  parentDirectoryUri(uri: string): string {
    return new URL('.', uri).toString()
  }

  exists(uri: string): boolean {
    return this.files.has(uri)
  }

  async delete(uri: string): Promise<void> {
    if (this.failDeletesFor.has(uri)) throw new Error('device temporarily unavailable')
    this.files.delete(uri)
    this.deleted.push(uri)
  }
}

class CleanupRepository {
  readonly acknowledged: string[] = []
  readonly settled: string[] = []

  constructor(private readonly queue: string[]) {}

  async getCleanupQueue(): Promise<string[]> {
    return [...this.queue]
  }

  async acknowledgeCleanup(uri: string): Promise<void> {
    this.acknowledged.push(uri)
  }

  async cleanupQueuedUri(uri: string, cleanup: () => Promise<void>): Promise<'deleted' | 'retained'> {
    this.settled.push(uri)
    await cleanup()
    this.acknowledged.push(uri)
    return 'deleted'
  }
}

class FailingQueueRepository extends CleanupRepository {
  async getCleanupQueue(): Promise<string[]> {
    throw new Error('queue unavailable')
  }
}

describe('scan file ownership', () => {
  it('creates the owned directory and copies a source image into its scan-specific destination', async () => {
    const files = new MemoryFiles()
    files.files.add('file:///cache/camera.jpg')

    await expect(ownScanPhoto('scan-1', 'file:///cache/camera.jpg', files))
      .resolves.toBe('file:///documents/scans/scan-1.jpg')

    expect(files.createdDirectories).toBe(1)
    expect(files.copied).toEqual([{ source: 'file:///cache/camera.jpg', destination: 'file:///documents/scans/scan-1.jpg' }])
  })

  it('does not claim an owned destination when the source image is missing', async () => {
    const files = new MemoryFiles()

    await expect(ownScanPhoto('scan-1', 'file:///cache/missing.jpg', files))
      .rejects.toThrow('source file is missing')

    expect(files.files.has('file:///documents/scans/scan-1.jpg')).toBe(false)
  })

  it('deletes only the exact owned file and treats an already missing owned file as cleaned up', async () => {
    const files = new MemoryFiles()
    files.files.add('file:///documents/scans/scan-1.jpg')

    await deleteOwnedPhoto('file:///documents/scans/scan-1.jpg', files)
    await deleteOwnedPhoto('file:///documents/scans/scan-1.jpg', files)

    expect(files.deleted).toEqual(['file:///documents/scans/scan-1.jpg'])
  })

  it('refuses to delete a URI outside the normalized owned scan directory', async () => {
    const files = new MemoryFiles()

    await expect(deleteOwnedPhoto('file:///tmp/not-owned.jpg', files)).rejects.toThrow('outside scan directory')
    await expect(deleteOwnedPhoto('file:///documents/scans/../private.jpg', files)).rejects.toThrow('outside scan directory')

    expect(files.deleted).toEqual([])
  })

  it('acknowledges cleanup entries only after an owned deletion succeeds or is already complete', async () => {
    const files = new MemoryFiles()
    files.files.add('file:///documents/scans/delete.jpg')
    files.files.add('file:///documents/scans/retry.jpg')
    files.failDeletesFor.add('file:///documents/scans/retry.jpg')
    const repository = new CleanupRepository([
      'file:///documents/scans/delete.jpg',
      'file:///documents/scans/missing.jpg',
      'file:///documents/scans/retry.jpg',
      'file:///tmp/not-owned.jpg',
    ])

    await flushCleanupQueue(repository as unknown as ScanRepository, files)

    expect(repository.acknowledged).toEqual([
      'file:///documents/scans/delete.jpg',
      'file:///documents/scans/missing.jpg',
    ])
    expect(files.files.has('file:///documents/scans/retry.jpg')).toBe(true)
  })

  it('settles duplicate queue entries only once so one owned image is deleted once', async () => {
    const files = new MemoryFiles()
    const uri = 'file:///documents/scans/shared.jpg'
    files.files.add(uri)
    const repository = new CleanupRepository([uri, uri, uri])

    await flushCleanupQueue(repository as unknown as ScanRepository, files)

    expect(repository.settled).toEqual([uri])
    expect(files.deleted).toEqual([uri])
  })

  it('reports cleanup as pending when a committed queue cannot be read', async () => {
    await expect(flushCommittedCleanup(new FailingQueueRepository([]) as unknown as ScanRepository, new MemoryFiles())).resolves.toEqual({ pending: true })
  })

  it('reports cleanup as pending when a committed owned file deletion fails', async () => {
    const files = new MemoryFiles()
    files.files.add('file:///documents/scans/retry.jpg')
    files.failDeletesFor.add('file:///documents/scans/retry.jpg')

    await expect(flushCommittedCleanup(new CleanupRepository(['file:///documents/scans/retry.jpg']) as unknown as ScanRepository, files))
      .resolves.toEqual({ pending: true })
  })
})
