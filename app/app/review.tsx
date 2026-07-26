import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { AppButton } from '../src/components/AppButton'
import { AppScreen } from '../src/components/AppScreen'
import { ZoomablePhoto } from '../src/components/ZoomablePhoto'
import { getLocalScanRepository } from '../src/lib/history'
import { cleanupOwnedPhoto, flushCleanupQueue, ownScanPhoto } from '../src/lib/scanFiles'
import {
  advanceReviewTransaction,
  createReviewMutationCoordinator,
  createReviewTransaction,
  discardReviewTransaction,
  replaceReviewPhoto,
  resumeReviewTransaction,
  resetReviewForRetake,
  type ReviewTransaction,
} from '../src/lib/reviewTransaction'
import { acknowledgePrivacyDisclosure, clearSessionAfterAtomicDiscard, getSession, isPrivacyDisclosureAcknowledged, replacePendingPhoto, resetSession, resumeFollowUpCapture, setReviewedPhoto } from '../src/lib/session'
import type { ScanOrigin } from '../src/lib/scanTypes'
import { reviewPresentation } from '../src/ui/reviewScreen'
import { colors, spacing } from '../src/ui/theme'
import { useSystemBackTransition } from '../src/lib/useSystemBackTransition'

type PendingPhoto = { uri: string; origin: ScanOrigin }

function initialPendingPhoto(): PendingPhoto | null {
  const session = getSession()
  return session.photoUri && session.origin ? { uri: session.photoUri, origin: session.origin } : null
}

function allocateScanId(): string {
  return `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export default function Review() {
  const [photo, setReviewPhoto] = useState<PendingPhoto | null>(initialPendingPhoto)
  const [disclosureAcknowledged, setDisclosureAcknowledged] = useState(isPrivacyDisclosureAcknowledged)
  const [isCopying, setIsCopying] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [retakeError, setRetakeError] = useState<string | null>(null)
  const [isRetaking, setIsRetaking] = useState(false)
  const [isChoosing, setIsChoosing] = useState(false)
  const entrySession = useRef(getSession()).current
  const transaction = useRef<ReviewTransaction | null>(
    entrySession.pendingScanId && entrySession.photoUri
      ? resumeReviewTransaction(entrySession.pendingScanId, entrySession.photoUri, disclosureAcknowledged)
      : null,
  )
  const cleanupTransaction = useRef<ReviewTransaction | null>(null)
  const mutation = useRef(createReviewMutationCoordinator())
  const mounted = useRef(true)

  useEffect(() => {
    if (!photo) router.replace('/')
  }, [photo])
  useEffect(() => () => {
    mounted.current = false
    mutation.current.invalidate()
  }, [])

  const analyze = () => {
    if (!photo) return
    void mutation.current.run(async (owns) => {
      setIsCopying(true)
      setCopyFailed(false)
      try {
      const currentSession = getSession()
      const repository = getLocalScanRepository()
      transaction.current ??= createReviewTransaction(allocateScanId(), disclosureAcknowledged)
      const completed = await advanceReviewTransaction(transaction.current, {
        origin: photo.origin,
        attemptKind: currentSession.parentScanId ? 'follow-up' : 'original',
        parentScanId: currentSession.parentScanId,
        createdAt: new Date().toISOString(),
      }, {
        ownPhoto: (scanId) => ownScanPhoto(scanId, photo.uri, repository),
        findDraft: async (scanId) => (await repository.get(scanId)) !== null,
        createDraft: (input) => repository.createDraft(input),
        persistReviewedPhoto: setReviewedPhoto,
        acknowledgeDisclosure: acknowledgePrivacyDisclosure,
        isCurrent: owns,
      })
      if (!owns()) return
      if (completed.disclosureAcknowledged) setDisclosureAcknowledged(true)
      router.replace('/analyze')
      } catch {
        if (owns()) setCopyFailed(true)
      } finally {
        if (owns() && mounted.current) setIsCopying(false)
      }
    })
  }

  const chooseAnother = () => {
    void mutation.current.run(async (owns) => {
      setIsChoosing(true)
      setSelectionError(null)
      try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })
      if (!owns()) return
      if (result.canceled) return
      const uri = result.assets?.[0]?.uri
      if (!uri) {
        setSelectionError('We couldn’t use that photo. Choose another one or keep this photo.')
        return
      }
      const repository = getLocalScanRepository()
      if (cleanupTransaction.current) {
        await discardReviewTransaction(cleanupTransaction.current, {
          findDraft: async (scanId) => (await repository.get(scanId)) !== null,
          deleteDraft: (scanId) => repository.delete(scanId),
          flushOwnedPhotos: () => flushCleanupQueue(repository),
          deleteOwnedPhoto: cleanupOwnedPhoto,
          isCurrent: owns,
        })
        cleanupTransaction.current = null
      }
      const priorTransaction = transaction.current
      const replacement = await replaceReviewPhoto(priorTransaction, {
        persistReplacement: () => replacePendingPhoto({ uri, origin: 'library' }),
        isCurrent: owns,
        discard: (savedTransaction) => discardReviewTransaction(savedTransaction, {
          findDraft: async (scanId) => (await repository.get(scanId)) !== null,
          deleteDraft: (scanId) => repository.delete(scanId),
          flushOwnedPhotos: () => flushCleanupQueue(repository),
          deleteOwnedPhoto: cleanupOwnedPhoto,
          isCurrent: owns,
        }),
      })
      if (!owns()) return
      setReviewPhoto({ uri, origin: 'library' })
      transaction.current = null
      cleanupTransaction.current = replacement.cleanupFailed ? priorTransaction : null
      if (replacement.cleanupFailed)
        setSelectionError('Your new photo is ready. We couldn’t clear the previous saved photo. Try clearing it again.')
      setCopyFailed(false)
      } catch {
        if (owns()) setSelectionError('We couldn’t open your library. Choose another photo when you’re ready.')
      } finally {
        if (owns() && mounted.current) setIsChoosing(false)
      }
    })
  }

  const retryCleanup = () => {
    void mutation.current.run(async (owns) => {
      const savedTransaction = cleanupTransaction.current
      if (!savedTransaction) return
      const repository = getLocalScanRepository()
      try {
      await discardReviewTransaction(savedTransaction, {
        findDraft: async (scanId) => (await repository.get(scanId)) !== null,
        deleteDraft: (scanId) => repository.delete(scanId),
        flushOwnedPhotos: () => flushCleanupQueue(repository),
        deleteOwnedPhoto: cleanupOwnedPhoto,
        isCurrent: owns,
      })
      if (!owns()) return
      cleanupTransaction.current = null
      setSelectionError(null)
      } catch {
        if (owns()) setSelectionError('We still couldn’t clear the previous saved photo. Your new photo is safe; try again when you’re ready.')
      }
    })
  }

  const retake = () => {
    void mutation.current.run(async (owns) => {
      setIsRetaking(true)
      setRetakeError(null)
      try {
        const currentSession = getSession()
        const repository = getLocalScanRepository()
        if (cleanupTransaction.current) {
          await discardReviewTransaction(cleanupTransaction.current, {
            findDraft: async (scanId) => (await repository.get(scanId)) !== null,
            deleteDraft: (scanId) => repository.delete(scanId),
            flushOwnedPhotos: () => flushCleanupQueue(repository),
            deleteOwnedPhoto: cleanupOwnedPhoto,
            isCurrent: owns,
          })
          cleanupTransaction.current = null
        }
        await resetReviewForRetake(transaction.current, {
          discardReviewAndSession: (input) => repository.discardReviewAndSession(input),
          clearInMemorySession: clearSessionAfterAtomicDiscard,
          flushOwnedPhotos: () => flushCleanupQueue(repository),
          resetSession: currentSession.parentScanId && currentSession.followUp
            ? async () => {
                const resumed = await resumeFollowUpCapture({ isCurrent: owns })
                if (!resumed) throw new Error('follow-up retake is no longer current')
              }
            : resetSession,
          isCurrent: owns,
        })
        if (!owns()) return
        transaction.current = null
        router.replace('/')
      } catch {
        if (owns()) setRetakeError('We couldn’t clear this saved photo. Your photo is still here. Try retake again.')
      } finally {
        if (owns() && mounted.current) setIsRetaking(false)
      }
    })
  }

  useSystemBackTransition(retake)

  if (!photo) return null

  const presentation = reviewPresentation({
    origin: photo.origin,
    disclosureAcknowledged,
    isCopying: isCopying || isRetaking || isChoosing,
    copyFailed,
  })

  return (
    <AppScreen contentStyle={styles.content}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>REVIEW</Text>
        <Text style={styles.title}>Make sure every line is readable.</Text>
        <Text style={styles.source}>{presentation.sourceLabel}</Text>
      </View>
      <ZoomablePhoto uri={photo.uri} />
      {presentation.privacyCopy ? <Text style={styles.privacy}>{presentation.privacyCopy}</Text> : null}
      {presentation.errorCopy ? <Text accessibilityRole="alert" style={styles.error}>{presentation.errorCopy}</Text> : null}
      {selectionError ? <Text accessibilityRole="alert" style={styles.error}>{selectionError}</Text> : null}
      {retakeError ? <Text accessibilityRole="alert" style={styles.error}>{retakeError}</Text> : null}
      <View style={styles.actions}>
        <AppButton label={presentation.primaryLabel} disabled={presentation.actionsDisabled} onPress={analyze} />
        <AppButton label={presentation.actions.retake} disabled={presentation.actionsDisabled} onPress={retake} variant="secondary" />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: presentation.actionsDisabled }}
          disabled={presentation.actionsDisabled}
          onPress={chooseAnother}
          style={[styles.chooseAnother, presentation.actionsDisabled && styles.disabled]}
        >
          <Text style={styles.chooseAnotherLabel}>{presentation.actions.replace}</Text>
        </Pressable>
        {cleanupTransaction.current ? <AppButton label="Try clearing previous photo" disabled={presentation.actionsDisabled} onPress={retryCleanup} variant="tertiary" /> : null}
        {retakeError ? <AppButton label="Try retake again" disabled={presentation.actionsDisabled} onPress={retake} variant="secondary" /> : null}
      </View>
    </AppScreen>
  )
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, gap: spacing.md },
  heading: { gap: spacing.xs },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  title: { color: colors.chalk, fontSize: 28, fontWeight: '700', letterSpacing: -0.7, lineHeight: 34 },
  source: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  privacy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
  error: { color: colors.error, fontSize: 14, lineHeight: 20, marginTop: spacing.xs },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  chooseAnother: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  chooseAnotherLabel: { color: colors.chalk, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  disabled: { opacity: 0.45 },
})
