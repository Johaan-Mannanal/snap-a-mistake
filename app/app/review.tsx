import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { AppButton } from '../src/components/AppButton'
import { AppScreen } from '../src/components/AppScreen'
import { ZoomablePhoto } from '../src/components/ZoomablePhoto'
import { getLocalScanRepository } from '../src/lib/history'
import { ownScanPhoto } from '../src/lib/scanFiles'
import { acknowledgePrivacyDisclosure, getSession, isPrivacyDisclosureAcknowledged, setPendingPhoto, setReviewedPhoto } from '../src/lib/session'
import type { ScanOrigin } from '../src/lib/scanTypes'
import { reviewPresentation } from '../src/ui/reviewScreen'
import { colors, spacing } from '../src/ui/theme'

type PendingPhoto = { uri: string; origin: ScanOrigin }

function initialPendingPhoto(): PendingPhoto | null {
  const session = getSession()
  return session.photoUri && session.origin ? { uri: session.photoUri, origin: session.origin } : null
}

function allocateScanId(): string {
  return `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export default function Review() {
  const [photo, setPhoto] = useState<PendingPhoto | null>(initialPendingPhoto)
  const [disclosureAcknowledged, setDisclosureAcknowledged] = useState(isPrivacyDisclosureAcknowledged)
  const [isCopying, setIsCopying] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const copyLock = useRef(false)

  useEffect(() => {
    if (!photo) router.replace('/')
  }, [photo])

  if (!photo) return null

  const presentation = reviewPresentation({ origin: photo.origin, disclosureAcknowledged, isCopying, copyFailed })

  const analyze = async () => {
    if (copyLock.current) return
    copyLock.current = true
    setIsCopying(true)
    setCopyFailed(false)
    try {
      const scanId = allocateScanId()
      const ownedUri = await ownScanPhoto(scanId, photo.uri)
      const currentSession = getSession()
      await getLocalScanRepository().createDraft({
        id: scanId,
        imageUri: ownedUri,
        origin: photo.origin,
        attemptKind: currentSession.parentScanId ? 'follow-up' : 'original',
        parentScanId: currentSession.parentScanId,
        createdAt: new Date().toISOString(),
      })
      if (!disclosureAcknowledged) {
        await acknowledgePrivacyDisclosure()
        setDisclosureAcknowledged(true)
      }
      await setReviewedPhoto({
        scanId,
        uri: ownedUri,
        origin: photo.origin,
        parentScanId: currentSession.parentScanId,
      })
      router.replace('/analyze')
    } catch {
      setCopyFailed(true)
    } finally {
      copyLock.current = false
      setIsCopying(false)
    }
  }

  const chooseAnother = async () => {
    if (copyLock.current) return
    setSelectionError(null)
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })
      if (result.canceled) return
      const uri = result.assets?.[0]?.uri
      if (!uri) {
        setSelectionError('We couldn’t use that photo. Choose another one or keep this photo.')
        return
      }
      await setPendingPhoto({ uri, origin: 'library' })
      setPhoto({ uri, origin: 'library' })
      setCopyFailed(false)
    } catch {
      setSelectionError('We couldn’t open your library. Choose another photo when you’re ready.')
    }
  }

  const retake = () => {
    if (!copyLock.current) router.replace('/')
  }

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
      <View style={styles.actions}>
        <AppButton label={presentation.primaryLabel} disabled={presentation.actionsDisabled} onPress={() => { void analyze() }} />
        {presentation.actions.retake ? (
          <AppButton label={presentation.actions.retake} disabled={presentation.actionsDisabled} onPress={retake} variant="secondary" />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: presentation.actionsDisabled }}
          disabled={presentation.actionsDisabled}
          onPress={() => { void chooseAnother() }}
          style={[styles.chooseAnother, presentation.actionsDisabled && styles.disabled]}
        >
          <Text style={styles.chooseAnotherLabel}>{presentation.actions.replace}</Text>
        </Pressable>
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
