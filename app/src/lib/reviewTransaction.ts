import type { NewScanDraft } from './scanTypes'
import type { ReviewedPhoto } from './session'

export type ReviewTransaction = {
  scanId: string
  ownedUri: string | null
  draftCreated: boolean
  sessionPersisted: boolean
  disclosureAcknowledged: boolean
  preservesExistingScan: boolean
}

export type ReviewTransactionDependencies = {
  ownPhoto(scanId: string): Promise<string>
  findDraft(scanId: string): Promise<boolean>
  createDraft(input: NewScanDraft): Promise<unknown>
  persistReviewedPhoto(input: ReviewedPhoto): Promise<void>
  acknowledgeDisclosure(): Promise<void>
  isCurrent?(): boolean
}

export type ReviewTransactionDiscardDependencies = {
  findDraft(scanId: string): Promise<boolean>
  deleteDraft(scanId: string): Promise<unknown>
  flushOwnedPhotos(): Promise<void>
  deleteOwnedPhoto(uri: string): Promise<void>
  isCurrent?(): boolean
}

function isCurrent(dependencies: { isCurrent?(): boolean }): boolean {
  return dependencies.isCurrent?.() ?? true
}

export type ReviewActionLock = { current: boolean }

export function createReviewActionLock(): ReviewActionLock {
  return { current: false }
}

export async function runExclusiveReviewAction(lock: ReviewActionLock, action: () => Promise<void>): Promise<boolean> {
  if (lock.current) return false
  lock.current = true
  try {
    await action()
    return true
  } finally {
    lock.current = false
  }
}

export function createReviewTransaction(scanId: string, disclosureAcknowledged = false): ReviewTransaction {
  return {
    scanId, ownedUri: null, draftCreated: false, sessionPersisted: false,
    disclosureAcknowledged, preservesExistingScan: false,
  }
}

export function resumeReviewTransaction(
  scanId: string,
  ownedUri: string,
  disclosureAcknowledged = false,
): ReviewTransaction {
  return {
    scanId,
    ownedUri,
    draftCreated: false,
    sessionPersisted: false,
    disclosureAcknowledged,
    preservesExistingScan: true,
  }
}

export async function advanceReviewTransaction(
  transaction: ReviewTransaction,
  draft: Omit<NewScanDraft, 'id' | 'imageUri'>,
  dependencies: ReviewTransactionDependencies,
): Promise<ReviewTransaction> {
  if (!isCurrent(dependencies)) return transaction
  if (transaction.ownedUri === null) {
    transaction.ownedUri = await dependencies.ownPhoto(transaction.scanId)
    if (!isCurrent(dependencies)) return transaction
  }

  if (!transaction.draftCreated) {
    const persistedDraft = await dependencies.findDraft(transaction.scanId)
    if (!isCurrent(dependencies)) return transaction
    if (!persistedDraft) {
      await dependencies.createDraft({
        ...draft,
        id: transaction.scanId,
        imageUri: transaction.ownedUri,
      })
      if (!isCurrent(dependencies)) return transaction
    }
    transaction.draftCreated = true
  }

  if (!transaction.sessionPersisted) {
    if (!isCurrent(dependencies)) return transaction
    await dependencies.persistReviewedPhoto({
      scanId: transaction.scanId,
      uri: transaction.ownedUri,
      origin: draft.origin,
      parentScanId: draft.parentScanId,
    })
    if (!isCurrent(dependencies)) return transaction
    transaction.sessionPersisted = true
  }

  if (!transaction.disclosureAcknowledged) {
    if (!isCurrent(dependencies)) return transaction
    await dependencies.acknowledgeDisclosure()
    if (!isCurrent(dependencies)) return transaction
    transaction.disclosureAcknowledged = true
  }

  return transaction
}

export async function discardReviewTransaction(
  transaction: ReviewTransaction,
  dependencies: ReviewTransactionDiscardDependencies,
): Promise<void> {
  if (!isCurrent(dependencies)) return
  if (transaction.preservesExistingScan) return
  if (transaction.ownedUri === null) return

  const hasDraft = transaction.draftCreated || await dependencies.findDraft(transaction.scanId)
  if (!isCurrent(dependencies)) return
  if (hasDraft) {
    await dependencies.deleteDraft(transaction.scanId)
    if (!isCurrent(dependencies)) return
    await dependencies.flushOwnedPhotos()
  } else {
    await dependencies.deleteOwnedPhoto(transaction.ownedUri)
  }

  transaction.ownedUri = null
  transaction.draftCreated = false
  transaction.sessionPersisted = false
}

export async function replaceReviewPhoto(
  transaction: ReviewTransaction | null,
  dependencies: {
    persistReplacement(): Promise<void>
    discard(transaction: ReviewTransaction): Promise<void>
    isCurrent?(): boolean
  },
): Promise<{ cleanupFailed: boolean }> {
  if (!isCurrent(dependencies)) return { cleanupFailed: false }
  await dependencies.persistReplacement()
  if (!isCurrent(dependencies)) return { cleanupFailed: false }
  if (transaction === null) return { cleanupFailed: false }
  try {
    await dependencies.discard(transaction)
    return { cleanupFailed: false }
  } catch {
    return { cleanupFailed: true }
  }
}

export async function resetReviewForRetake(
  transaction: ReviewTransaction | null,
  dependencies: {
    discardReviewAndSession(input: { scanId: string; ownedUri: string | null }): Promise<void>
    clearInMemorySession(): void
    flushOwnedPhotos(): Promise<void>
    resetSession(): Promise<void>
    isCurrent?(): boolean
  },
): Promise<void> {
  if (!isCurrent(dependencies)) return
  if (transaction === null || transaction.preservesExistingScan) {
    await dependencies.resetSession()
    return
  }
  await dependencies.discardReviewAndSession({ scanId: transaction.scanId, ownedUri: transaction.ownedUri })
  if (!isCurrent(dependencies)) return
  dependencies.clearInMemorySession()
  transaction.ownedUri = null
  transaction.draftCreated = false
  transaction.sessionPersisted = false
  try {
    await dependencies.flushOwnedPhotos()
  } catch {
    // The committed cleanup queue will retry this safe, owned-file deletion at next launch.
  }
}

export type ReviewMutationCoordinator = {
  readonly busy: boolean
  run(action: (owns: () => boolean) => Promise<void>): Promise<boolean>
  invalidate(): void
}

export function createReviewMutationCoordinator(): ReviewMutationCoordinator {
  let locked = false
  let generation = 0
  return {
    get busy() {
      return locked
    },
    async run(action) {
      if (locked) return false
      locked = true
      const ownedGeneration = generation
      try {
        await action(() => generation === ownedGeneration)
        return true
      } finally {
        locked = false
      }
    },
    invalidate() {
      generation += 1
    },
  }
}
