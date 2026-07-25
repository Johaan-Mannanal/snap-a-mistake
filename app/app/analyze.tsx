import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import type { AnalyzeResponse } from '@snap/shared'
import { ApiError, type ApiFailure, analyzePhoto } from '../src/lib/api'
import { getLocalScanRepository, recordAnalysis } from '../src/lib/history'
import { getSession, persistAnalysis, resetSession } from '../src/lib/session'
import { createSessionResetTransition } from '../src/lib/sessionResetTransition'
import type { ScanRevision } from '../src/lib/scanTypes'
import { tagLabel } from '../src/lib/labels'
import { AppButton } from '../src/components/AppButton'
import { AppIcon } from '../src/components/AppIcon'
import { AppScreen } from '../src/components/AppScreen'
import { AnalysisProgress } from '../src/components/AnalysisProgress'
import { StepCard } from '../src/components/StepCard'
import { PhotoOverlay } from '../src/components/PhotoOverlay'
import { analysisPresentation, analysisRecoveryPresentation } from '../src/ui/presentation'
import { colors, spacing } from '../src/ui/theme'

type RecoverableFailure = ApiFailure | { kind: 'persistence' }

type PendingSave = {
  response: AnalyzeResponse
  revision: ScanRevision
  durationMs: number
}

function allocateRevisionId(): string {
  return `revision-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export default function Analyze() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [failure, setFailure] = useState<RecoverableFailure | null>(null)
  const [unsaved, setUnsaved] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isResetting, setIsResetting] = useState(false)
  const [resetFailed, setResetFailed] = useState(false)
  const { photoUri: uri, pendingScanId: scanId } = getSession()
  const resetTransition = useRef<(() => Promise<void>) | null>(null)
  const activeRequest = useRef<AbortController | null>(null)
  const requestInFlight = useRef(false)
  const cancelled = useRef(false)
  const cancellationTask = useRef<Promise<void> | null>(null)
  const pendingSave = useRef<PendingSave | null>(null)
  const durableResult = useRef(false)
  const mounted = useRef(true)
  if (resetTransition.current === null)
    resetTransition.current = createSessionResetTransition(resetSession, () => router.dismissTo('/'))

  const persistPendingSave = useCallback(async (pending: PendingSave) => {
    try {
      await getLocalScanRepository().saveRevision(scanId!, pending.revision, pending.durationMs)
      durableResult.current = true
      await persistAnalysis(scanId!, pending.response, pending.durationMs)
      if (mounted.current) setUnsaved(false)
      if (pending.response.kind === 'analysis')
        void recordAnalysis({ tag: pending.response.misconceptionTag, correct: pending.response.errorStepIndex === null }).catch(() => {})
    } catch {
      if (scanId) await getLocalScanRepository().setLifecycle(scanId, 'unsaved').catch(() => {})
      if (mounted.current) setUnsaved(true)
    }
  }, [scanId])

  const returnToReview = useCallback(async () => {
    cancelled.current = true
    activeRequest.current?.abort()
    if (cancellationTask.current) return cancellationTask.current
    cancellationTask.current = (async () => {
      try {
        if (scanId && !durableResult.current)
          await getLocalScanRepository().setLifecycle(scanId, 'interrupted')
        await resetSession({ preserveDraft: true })
        if (mounted.current) router.replace('/review')
      } catch {
        if (mounted.current) setFailure({ kind: 'persistence' })
      }
    })()
    return cancellationTask.current
  }, [scanId])

  const run = useCallback(async () => {
    if (!uri || !scanId) { router.replace('/review'); return }
    if (requestInFlight.current) return
    requestInFlight.current = true
    cancelled.current = false
    cancellationTask.current = null
    pendingSave.current = null
    durableResult.current = false
    if (mounted.current) {
      setFailure(null)
      setUnsaved(false)
      setResult(null)
      setElapsedSeconds(0)
    }
    try {
      const scan = await getLocalScanRepository().setLifecycle(scanId, 'analyzing')
      if (cancelled.current) {
        await returnToReview()
        return
      }
      const controller = new AbortController()
      activeRequest.current = controller
      const startedAt = Date.now()
      const response = await analyzePhoto(uri, { signal: controller.signal })
      const durationMs = Math.max(0, Date.now() - startedAt)
      const pending: PendingSave = {
        response,
        durationMs,
        revision: {
          id: allocateRevisionId(),
          reason: scan?.activeRevision ? 'retry' : 'initial',
          response,
          createdAt: new Date().toISOString(),
        },
      }
      pendingSave.current = pending
      if (mounted.current) setResult(response)
      await persistPendingSave(pending)
    } catch (error) {
      if (cancelled.current || (error instanceof ApiError && error.failure.kind === 'cancelled')) {
        if (mounted.current) await returnToReview()
        else if (scanId) await getLocalScanRepository().setLifecycle(scanId, 'interrupted').catch(() => {})
        return
      }
      if (mounted.current) {
        if (error instanceof ApiError) setFailure(error.failure)
        else setFailure({ kind: 'persistence' })
      }
    } finally {
      activeRequest.current = null
      requestInFlight.current = false
    }
  }, [persistPendingSave, returnToReview, scanId, uri])

  useEffect(() => { void run() }, [run])
  useEffect(() => {
    if (result || failure) return
    const startedAt = Date.now()
    const t = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(t)
  }, [failure, result])
  useEffect(() => () => {
    mounted.current = false
    activeRequest.current?.abort()
  }, [])

  const snapAnother = useCallback(() => {
    setIsResetting(true)
    setResetFailed(false)
    void resetTransition.current!().catch(() => {
      setIsResetting(false)
      setResetFailed(true)
    })
  }, [])

  const resetFailure = resetFailed ? <ResetFailure onRetry={snapAnother} /> : null

  if (failure) {
    if (failure.kind === 'persistence') {
      return (
        <AppScreen contentStyle={styles.stateContent}>
          <View style={styles.stateCopy}>
            <Text style={styles.stateEyebrow}>SAVE UNAVAILABLE</Text>
            <Text style={styles.stateTitle}>We couldn’t prepare this analysis.</Text>
            <Text style={styles.stateDetail}>Your reviewed photo is still saved. Try again or return to review it.</Text>
          </View>
          <AppButton label="Try again" onPress={() => { void run() }} />
          <AppButton label="Return to review" onPress={() => { void returnToReview() }} variant="secondary" />
        </AppScreen>
      )
    }
    const presentation = analysisRecoveryPresentation(failure)
    return (
      <AppScreen contentStyle={styles.stateContent}>
        <View style={styles.stateCopy}>
          <Text style={styles.stateEyebrow}>{presentation.eyebrow}</Text>
          <Text style={styles.stateTitle}>{presentation.title}</Text>
          <Text style={styles.stateDetail}>{presentation.detail}</Text>
        </View>
        {presentation.actions.includes('retry') ? <AppButton label="Try again" onPress={() => { void run() }} /> : null}
        <AppButton label="Return to review" onPress={() => { void returnToReview() }} variant="secondary" />
      </AppScreen>
    )
  }

  if (!result) {
    return uri ? <AnalysisProgress uri={uri} elapsedSeconds={elapsedSeconds} descriptionIndex={Math.floor(elapsedSeconds / 6)} onCancel={() => { void returnToReview() }} /> : null
  }

  if (result.kind === 'not-math') {
    const presentation = analysisRecoveryPresentation(result)
    return (
      <AppScreen contentStyle={styles.stateContent}>
        <View style={styles.stateCopy}>
          <Text style={styles.stateEyebrow}>{presentation.eyebrow}</Text>
          <Text style={styles.stateTitle}>{presentation.title}</Text>
          <Text style={styles.stateDetail}>{presentation.detail}</Text>
        </View>
        {unsaved ? <UnsavedBanner onRetry={() => { const pending = pendingSave.current; if (pending) void persistPendingSave(pending) }} /> : null}
        <AppButton label="Return to review" onPress={() => { void returnToReview() }} />
      </AppScreen>
    )
  }

  if (result.kind === 'unreadable') {
    const presentation = analysisRecoveryPresentation(result)
    return (
      <AppScreen contentStyle={styles.stateContent}>
        <View style={styles.stateCopy}>
          <Text style={styles.stateEyebrow}>{presentation.eyebrow}</Text>
          <Text style={styles.stateTitle}>{presentation.title}</Text>
          <View style={styles.tips}>
            {result.tips.map((tip) => <Text key={tip} style={styles.tip}>— {tip}</Text>)}
          </View>
        </View>
        {unsaved ? <UnsavedBanner onRetry={() => { const pending = pendingSave.current; if (pending) void persistPendingSave(pending) }} /> : null}
        <AppButton label="Return to review" onPress={() => { void returnToReview() }} />
      </AppScreen>
    )
  }

  const correct = result.errorStepIndex === null
  const label = result.misconceptionTag ? tagLabel(result.misconceptionTag) : null
  const presentation = analysisPresentation(result)

  return (
    <AppScreen contentStyle={styles.resultContent}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Return to camera"
          accessibilityState={{ disabled: isResetting }}
          disabled={isResetting}
          hitSlop={8}
          onPress={snapAnother}
          style={({ pressed }) => [styles.topAction, { opacity: pressed ? 0.5 : 1 }]}
        >
          <AppIcon name="camera" fallback="Camera" size={18} />
        </Pressable>
        <Text style={styles.topTitle}>Analysis</Text>
        <View style={styles.topAction} />
      </View>
      {uri && <PhotoOverlay uri={uri} steps={result.steps} />}
      <View style={styles.diagnosis}>
        {presentation.tone === 'success' ? (
          <View style={styles.verifiedLine}>
            <Text style={styles.verifiedMark}>✓</Text>
            <Text style={styles.headline}>{presentation.headline}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.diagnosisEyebrow}>{presentation.eyebrow}</Text>
            <Text style={styles.headline}>{presentation.headline}</Text>
          </>
        )}
        <Text style={styles.diagnosisDetail}>{presentation.detail}</Text>
      </View>
      {unsaved ? <UnsavedBanner onRetry={() => { const pending = pendingSave.current; if (pending) void persistPendingSave(pending) }} /> : null}
      <View style={styles.timeline}>
        {result.steps.map((s) => (
          <StepCard
            key={s.index}
            step={s}
            misconceptionLabel={s.index === result.errorStepIndex ? label : null}
            explanation={s.index === result.errorStepIndex ? result.explanation : null}
          />
        ))}
      </View>
      <View style={styles.actions}>
        {result.followUp && !correct ? <AppButton label="Try a similar problem" onPress={() => router.push('/followup')} /> : null}
        {resetFailure}
        <AppButton label="Snap another" onPress={snapAnother} disabled={isResetting} variant="tertiary" />
      </View>
    </AppScreen>
  )
}

function UnsavedBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.unsavedBanner}>
      <Text accessibilityRole="alert" style={styles.unsavedCopy}>This result is visible, but it isn’t saved yet.</Text>
      <AppButton label="Retry saving" onPress={onRetry} variant="secondary" />
    </View>
  )
}

function ResetFailure({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.resetFailure}>
      <Text accessibilityRole="alert" style={styles.resetFailureCopy}>We couldn’t clear this saved session. Your photo is still available.</Text>
      <AppButton label="Try again" onPress={onRetry} variant="secondary" />
    </View>
  )
}

const styles = StyleSheet.create({
  stateContent: { flexGrow: 1, justifyContent: 'center' },
  stateCopy: { gap: spacing.md, marginBottom: spacing.lg },
  stateEyebrow: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  stateTitle: { color: colors.chalk, fontSize: 28, fontWeight: '700', letterSpacing: -0.7, lineHeight: 34 },
  stateDetail: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  tips: { gap: spacing.sm, marginTop: spacing.xs },
  tip: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  resultContent: { paddingTop: spacing.xs },
  topBar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topAction: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  topTitle: { color: colors.chalk, fontSize: 15, fontWeight: '700' },
  diagnosis: { gap: spacing.sm, paddingVertical: spacing.md },
  diagnosisEyebrow: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  verifiedLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  verifiedMark: { color: colors.success, fontSize: 15, fontWeight: '800' },
  headline: { flexShrink: 1, color: colors.chalk, fontSize: 24, fontWeight: '700', letterSpacing: -0.5, lineHeight: 30 },
  diagnosisDetail: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  timeline: { marginTop: spacing.xs },
  actions: { gap: spacing.md, marginTop: spacing.sm },
  resetFailure: { gap: spacing.sm },
  resetFailureCopy: { color: colors.error, fontSize: 15, lineHeight: 22 },
  unsavedBanner: { gap: spacing.sm, paddingVertical: spacing.sm },
  unsavedCopy: { color: colors.error, fontSize: 15, lineHeight: 22 },
})
