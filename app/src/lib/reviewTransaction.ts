import type { NewScanDraft } from './scanTypes'
import type { ReviewedPhoto } from './session'

export type ReviewTransaction = {
  scanId: string
  ownedUri: string | null
  draftCreated: boolean
  sessionPersisted: boolean
  disclosureAcknowledged: boolean
}

export type ReviewTransactionDependencies = {
  ownPhoto(scanId: string): Promise<string>
  findDraft(scanId: string): Promise<boolean>
  createDraft(input: NewScanDraft): Promise<unknown>
  persistReviewedPhoto(input: ReviewedPhoto): Promise<void>
  acknowledgeDisclosure(): Promise<void>
}

export type ReviewTransactionDiscardDependencies = {
  findDraft(scanId: string): Promise<boolean>
  deleteDraft(scanId: string): Promise<unknown>
  flushOwnedPhotos(): Promise<void>
  deleteOwnedPhoto(uri: string): Promise<void>
}

export function createReviewTransaction(scanId: string, disclosureAcknowledged = false): ReviewTransaction {
  return { scanId, ownedUri: null, draftCreated: false, sessionPersisted: false, disclosureAcknowledged }
}

export async function advanceReviewTransaction(
  transaction: ReviewTransaction,
  draft: Omit<NewScanDraft, 'id' | 'imageUri'>,
  dependencies: ReviewTransactionDependencies,
): Promise<ReviewTransaction> {
  if (transaction.ownedUri === null)
    transaction.ownedUri = await dependencies.ownPhoto(transaction.scanId)

  if (!transaction.draftCreated) {
    const persistedDraft = await dependencies.findDraft(transaction.scanId)
    if (!persistedDraft) {
      await dependencies.createDraft({
        ...draft,
        id: transaction.scanId,
        imageUri: transaction.ownedUri,
      })
    }
    transaction.draftCreated = true
  }

  if (!transaction.sessionPersisted) {
    await dependencies.persistReviewedPhoto({
      scanId: transaction.scanId,
      uri: transaction.ownedUri,
      origin: draft.origin,
      parentScanId: draft.parentScanId,
    })
    transaction.sessionPersisted = true
  }

  if (!transaction.disclosureAcknowledged) {
    await dependencies.acknowledgeDisclosure()
    transaction.disclosureAcknowledged = true
  }

  return transaction
}

export async function discardReviewTransaction(
  transaction: ReviewTransaction,
  dependencies: ReviewTransactionDiscardDependencies,
): Promise<void> {
  if (transaction.ownedUri === null) return

  const hasDraft = transaction.draftCreated || await dependencies.findDraft(transaction.scanId)
  if (hasDraft) {
    await dependencies.deleteDraft(transaction.scanId)
    await dependencies.flushOwnedPhotos()
  } else {
    await dependencies.deleteOwnedPhoto(transaction.ownedUri)
  }

  transaction.ownedUri = null
  transaction.draftCreated = false
  transaction.sessionPersisted = false
}
