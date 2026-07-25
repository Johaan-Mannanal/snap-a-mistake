import { describe, expect, it, vi } from 'vitest'
import { advanceReviewTransaction, createReviewTransaction, discardReviewTransaction } from './reviewTransaction'

const draft = {
  imageUri: 'file:///documents/scans/scan-1.jpg', origin: 'camera' as const,
  attemptKind: 'original' as const, parentScanId: null, createdAt: '2026-07-25T12:00:00.000Z',
}

function dependencies() {
  const created = new Set<string>()
  return {
    ownPhoto: vi.fn(async (scanId: string) => `file:///documents/scans/${scanId}.jpg`),
    createDraft: vi.fn(async ({ id }: { id: string }) => { created.add(id) }),
    findDraft: vi.fn(async (scanId: string) => created.has(scanId)),
    persistReviewedPhoto: vi.fn(async () => {}),
    acknowledgeDisclosure: vi.fn(async () => {}),
  }
}

describe('review transaction', () => {
  it('runs copy, draft, session, and disclosure in that order', async () => {
    const calls: string[] = []
    const deps = dependencies()
    deps.ownPhoto.mockImplementation(async (scanId) => { calls.push('copy'); return `file:///documents/scans/${scanId}.jpg` })
    deps.createDraft.mockImplementation(async () => { calls.push('draft') })
    deps.persistReviewedPhoto.mockImplementation(async () => { calls.push('session') })
    deps.acknowledgeDisclosure.mockImplementation(async () => { calls.push('disclosure') })

    await advanceReviewTransaction(createReviewTransaction('scan-1'), draft, deps)

    expect(calls).toEqual(['copy', 'draft', 'session', 'disclosure'])
  })

  it('keeps the same pending transaction retryable when its owned copy fails', async () => {
    const transaction = createReviewTransaction('scan-1')
    const deps = dependencies()
    deps.ownPhoto.mockRejectedValueOnce(new Error('storage unavailable'))

    await expect(advanceReviewTransaction(transaction, draft, deps)).rejects.toThrow('storage unavailable')
    await advanceReviewTransaction(transaction, draft, deps)

    expect(transaction.scanId).toBe('scan-1')
    expect(deps.ownPhoto).toHaveBeenCalledTimes(2)
    expect(deps.createDraft).toHaveBeenCalledTimes(1)
  })

  it('reuses the owned photo and scan ID when draft creation fails before succeeding', async () => {
    const transaction = createReviewTransaction('scan-1')
    const deps = dependencies()
    deps.createDraft.mockRejectedValueOnce(new Error('database unavailable'))

    await expect(advanceReviewTransaction(transaction, draft, deps)).rejects.toThrow('database unavailable')
    await advanceReviewTransaction(transaction, draft, deps)

    expect(deps.ownPhoto).toHaveBeenCalledTimes(1)
    expect(deps.createDraft).toHaveBeenCalledTimes(2)
    expect(deps.createDraft.mock.calls.map(([input]) => input.id)).toEqual(['scan-1', 'scan-1'])
  })

  it('does not duplicate a draft if creation committed before reporting an error', async () => {
    const transaction = createReviewTransaction('scan-1')
    const deps = dependencies()
    const created = new Set<string>()
    deps.createDraft.mockImplementationOnce(async ({ id }) => { created.add(id); throw new Error('response lost') })
    deps.findDraft.mockImplementation(async (scanId) => created.has(scanId))

    await expect(advanceReviewTransaction(transaction, draft, deps)).rejects.toThrow('response lost')
    await advanceReviewTransaction(transaction, draft, deps)

    expect(deps.createDraft).toHaveBeenCalledTimes(1)
    expect(deps.persistReviewedPhoto).toHaveBeenCalledTimes(1)
  })

  it('retries session persistence without recopying or redrafting', async () => {
    const transaction = createReviewTransaction('scan-1')
    const deps = dependencies()
    deps.persistReviewedPhoto.mockRejectedValueOnce(new Error('state unavailable'))

    await expect(advanceReviewTransaction(transaction, draft, deps)).rejects.toThrow('state unavailable')
    await advanceReviewTransaction(transaction, draft, deps)

    expect(deps.ownPhoto).toHaveBeenCalledTimes(1)
    expect(deps.createDraft).toHaveBeenCalledTimes(1)
    expect(deps.persistReviewedPhoto).toHaveBeenCalledTimes(2)
    expect(deps.acknowledgeDisclosure).toHaveBeenCalledTimes(1)
  })

  it('retries a disclosure failure without duplicating the owned scan', async () => {
    const transaction = createReviewTransaction('scan-1')
    const deps = dependencies()
    deps.acknowledgeDisclosure.mockRejectedValueOnce(new Error('state unavailable'))

    await expect(advanceReviewTransaction(transaction, draft, deps)).rejects.toThrow('state unavailable')
    await advanceReviewTransaction(transaction, draft, deps)

    expect(deps.ownPhoto).toHaveBeenCalledTimes(1)
    expect(deps.createDraft).toHaveBeenCalledTimes(1)
    expect(deps.persistReviewedPhoto).toHaveBeenCalledTimes(1)
    expect(deps.acknowledgeDisclosure).toHaveBeenCalledTimes(2)
  })

  it('removes an abandoned durable draft and flushes its owned cleanup before replacement', async () => {
    const transaction = createReviewTransaction('scan-1')
    transaction.ownedUri = 'file:///documents/scans/scan-1.jpg'
    transaction.draftCreated = true
    const deleteDraft = vi.fn(async () => {})
    const flushOwnedPhotos = vi.fn(async () => {})
    const deleteOwnedPhoto = vi.fn(async () => {})

    await discardReviewTransaction(transaction, {
      findDraft: async () => true,
      deleteDraft,
      flushOwnedPhotos,
      deleteOwnedPhoto,
    })

    expect(deleteDraft).toHaveBeenCalledWith('scan-1')
    expect(flushOwnedPhotos).toHaveBeenCalledOnce()
    expect(deleteOwnedPhoto).not.toHaveBeenCalled()
    expect(transaction.ownedUri).toBeNull()
  })
})
