import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, findNodeHandle, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import type { AnalyzeResponse } from '@snap/shared'
import { ApiError, type ApiFailure, analyzePhoto, correctDiagnosis } from '../src/lib/api'
import { getLocalScanRepository } from '../src/lib/history'
import { adoptResultSession, adoptReviewSession, beginFollowUp, getSession, persistAnalysis, recoverAnalysis, resetSession, resultSession, reviewSession } from '../src/lib/session'
import { createSessionResetTransition } from '../src/lib/sessionResetTransition'
import { createAsyncLock, createRunFence } from '../src/lib/analysisAsync'
import { analysisRevisionReason, beginAnalysisReset, persistAnalysisRun } from '../src/lib/analysisPersistence'
import {
  CorrectionStorageError,
  createCorrectionFence,
  createGeneratedCorrectionRetry,
  type CorrectionRun,
} from '../src/lib/correctionAsync'
import { createCorrectionBusyState } from '../src/lib/correctionBusy'
import { createAnalysisFinalization, createCompletedReviewReturn } from '../src/lib/analysisFinalization'
import { announce, createFeedbackEventGate, systemHaptics } from '../src/lib/feedback.native'
import type { ScanRevision } from '../src/lib/scanTypes'
import { tagLabel } from '../src/lib/labels'
import { AppButton } from '../src/components/AppButton'
import { AppIcon } from '../src/components/AppIcon'
import { AppScreen } from '../src/components/AppScreen'
import { AnalysisProgress } from '../src/components/AnalysisProgress'
import { StepTimeline, type StepTimelineHandle } from '../src/components/StepTimeline'
import { PhotoOverlay } from '../src/components/PhotoOverlay'
import { ZoomablePhoto } from '../src/components/ZoomablePhoto'
import { DiagnosisFeedback } from '../src/components/DiagnosisFeedback'
import { analysisPresentation, analysisRecoveryPresentation } from '../src/ui/presentation'
import { colors, spacing } from '../src/ui/theme'
import { expandStepIndex, initialExpandedStepIndexes, selectStepIndex, toggleExpandedStepIndexes } from '../src/lib/resultInteraction'
import { isDurableFeedbackAvailable, synthesizeAllCorrectResponse, type CorrectionFailure } from '../src/ui/diagnosisFeedback'
import { initialAnalysisEntry } from '../src/lib/analysisEntry'

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
  const initialEntry = useRef(initialAnalysisEntry(getSession())).current
  const [result, setResult] = useState<AnalyzeResponse | null>(initialEntry.result)
  const [failure, setFailure] = useState<RecoverableFailure | null>(null)
  const [unsaved, setUnsaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [reviewReturnFailed, setReviewReturnFailed] = useState(false)
  const [completedReturnFailed, setCompletedReturnFailed] = useState(false)
  const [isReturningCompleted, setIsReturningCompleted] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [analysisRunId, setAnalysisRunId] = useState(0)
  const [isResetting, setIsResetting] = useState(false)
  const [resetFailed, setResetFailed] = useState(false)
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null)
  const [expandedStepIndexes, setExpandedStepIndexes] = useState<Set<number>>(() => new Set())
  const [showAllSteps, setShowAllSteps] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [pendingPhotoFocusIndex, setPendingPhotoFocusIndex] = useState<number | null>(null)
  const [timelineLayoutVersion, setTimelineLayoutVersion] = useState(0)
  const [feedbackBusy, setFeedbackBusy] = useState(false)
  const [correctionFailure, setCorrectionFailure] = useState<CorrectionFailure | null>(null)
  const [feedbackAccepted, setFeedbackAccepted] = useState(false)
  const [durableResultRevisionId, setDurableResultRevisionId] = useState<string | null>(null)
  const [openingFollowUp, setOpeningFollowUp] = useState(false)
  const [followUpOpenFailed, setFollowUpOpenFailed] = useState(false)
  const { photoUri: uri, pendingScanId: scanId } = getSession()
  const resetTransition = useRef<(() => Promise<void>) | null>(null)
  const activeRequest = useRef<AbortController | null>(null)
  const correctionFence = useRef(createCorrectionFence())
  const correctionBusy = useRef(createCorrectionBusyState())
  const feedbackLock = useRef(createAsyncLock<void>())
  const retryCorrection = useRef<(() => void) | null>(null)
  const acceptDiagnosisRef = useRef<() => void>(() => {})
  const requestInFlight = useRef(false)
  const runFence = useRef(createRunFence())
  const saveLock = useRef(createAsyncLock<void>())
  const finalization = useRef(createAnalysisFinalization())
  const restoredResultFinalized = useRef(false)
  const completedReturn = useRef(createCompletedReviewReturn())
  const activeToken = useRef<number | null>(null)
  const pendingSave = useRef<PendingSave | null>(null)
  const mounted = useRef(true)
  const resultScrollRef = useRef<ScrollView | null>(null)
  const timelineRef = useRef<StepTimelineHandle | null>(null)
  const photoOffsetY = useRef(0)
  const timelineOffsetY = useRef(0)
  const timelineStepOffsets = useRef(new Map<number, number>())
  const feedbackEvents = useRef(createFeedbackEventGate())
  if (initialEntry.restoredResult && !restoredResultFinalized.current) {
    finalization.current.markSuccessfulHandoff()
    restoredResultFinalized.current = true
  }
  if (resetTransition.current === null)
    resetTransition.current = createSessionResetTransition(resetSession, () => router.dismissTo('/'))

  const announceForCurrentRun = useCallback((event: string, message: string) => {
    const token = activeToken.current
    if (token === null) return
    feedbackEvents.current.announceOnce(`${token}:${event}`, message, announce)
  }, [])

  const owns = useCallback((token: number) => (
    mounted.current && runFence.current.owns(token) && finalization.current.isActive()
  ), [])

  const ownsCorrection = useCallback((run: CorrectionRun, analysis: Extract<AnalyzeResponse, { kind: 'analysis' }>) => (
    mounted.current
    && correctionFence.current.owns(run)
    && getSession().pendingScanId === run.scanId
    && JSON.stringify(getSession().analysis) === JSON.stringify(analysis)
  ), [])

  const beginCorrectionBusy = useCallback((run: CorrectionRun) => {
    correctionBusy.current.begin(run.token)
    setFeedbackBusy(true)
  }, [])

  const finishCorrectionBusy = useCallback((run: CorrectionRun) => {
    if (correctionBusy.current.finish(run.token)) setFeedbackBusy(false)
  }, [])

  const persistPendingSave = useCallback(async (pending: PendingSave, token: number) => {
    await saveLock.current.run(async () => {
      if (!owns(token)) return
      if (mounted.current) setIsSaving(true)
      try {
        const saved = await persistAnalysisRun({
          isCurrent: () => owns(token),
          saveRevision: () => getLocalScanRepository().saveRevision(scanId!, pending.revision, pending.durationMs),
          validateSaved: (record) => record.activeRevision?.id === pending.revision.id,
          persistSession: () => persistAnalysis(scanId!, pending.response, pending.durationMs),
        })
        if (saved === null || !owns(token)) return
        if (mounted.current) setResult(pending.response)
        setDurableResultRevisionId(pending.revision.id)
        if (mounted.current) setUnsaved(false)
        finalization.current.markSuccessfulHandoff()
        if (pending.response.kind === 'analysis') {
          announceForCurrentRun('completed', 'Analysis completed.')
        }
        void feedbackEvents.current.completeOnce(pending.revision.id, systemHaptics)
      } catch {
        if (!owns(token)) return
        setDurableResultRevisionId(null)
        if (scanId) await getLocalScanRepository().setLifecycle(scanId, 'unsaved').catch(() => {})
        if (!owns(token)) return
        if (mounted.current) {
          setResult(pending.response)
          setUnsaved(true)
        }
      } finally {
        if (mounted.current && runFence.current.owns(token)) setIsSaving(false)
      }
    })
  }, [announceForCurrentRun, owns, scanId])

  const finalizationDependencies = useCallback((navigate: boolean) => {
    let recoveredRoute: 'review' | 'result' = 'review'
    return {
      interrupt: async () => {
        if (scanId) recoveredRoute = await recoverAnalysis(scanId)
      },
      restoreReview: async () => {},
      navigate: () => {
        if (navigate && mounted.current)
          router.replace(recoveredRoute === 'result' ? '/analyze' : '/review')
      },
    }
  }, [scanId])

  const returnToReview = useCallback(() => {
    runFence.current.invalidate()
    activeRequest.current?.abort()
    return correctionFence.current.invalidate().then(() => finalization.current.cancel(finalizationDependencies(true))).then(
      () => {
        announceForCurrentRun('cancelled', 'Analysis cancelled. Your reviewed photo is still available.')
        if (mounted.current) setReviewReturnFailed(false)
      },
      () => { if (mounted.current) setReviewReturnFailed(true) },
    )
  }, [announceForCurrentRun, finalizationDependencies])

  const returnCompletedResultToReview = useCallback(() => {
    if (mounted.current) {
      setCompletedReturnFailed(false)
      setIsReturningCompleted(true)
    }
    return correctionFence.current.invalidate().then(() => completedReturn.current.returnToReview({
      restoreReview: () => resetSession({ preserveDraft: true }),
      navigate: () => { if (mounted.current) router.replace('/review') },
    })).then(
      () => { if (mounted.current) setIsReturningCompleted(false) },
      () => {
        if (mounted.current) {
          setIsReturningCompleted(false)
          setCompletedReturnFailed(true)
        }
      },
    )
  }, [])

  const run = useCallback(() => {
    if (!uri || !scanId) { router.replace('/review'); return }
    if (requestInFlight.current) return
    requestInFlight.current = true
    finalization.current.begin()
    const token = runFence.current.begin()
    activeToken.current = token
    setAnalysisRunId(token)
    announceForCurrentRun('started', 'Analysis started. Usually takes less than a minute.')
    pendingSave.current = null
    if (mounted.current) {
      setFailure(null)
      setUnsaved(false)
      setResult(null)
      setDurableResultRevisionId(null)
      setElapsedSeconds(0)
    }
    const task = (async () => {
      try {
        await correctionFence.current.invalidate()
        if (!owns(token)) return
        const scan = await getLocalScanRepository().setLifecycle(scanId, 'analyzing')
        if (!owns(token)) return
        const controller = new AbortController()
        activeRequest.current = controller
        const startedAt = Date.now()
        const response = await analyzePhoto(uri, { signal: controller.signal })
        if (!owns(token)) return
        const durationMs = Math.max(0, Date.now() - startedAt)
        const pending: PendingSave = {
          response,
          durationMs,
          revision: {
            id: allocateRevisionId(),
            reason: analysisRevisionReason(scan),
            response,
            feedback: 'unreviewed',
            createdAt: new Date().toISOString(),
          },
        }
        if (!owns(token)) return
        pendingSave.current = pending
        await persistPendingSave(pending, token)
      } catch (error) {
        if (!owns(token)) return
        if (mounted.current) {
          if (error instanceof ApiError) setFailure(error.failure)
          else setFailure({ kind: 'persistence' })
        }
      } finally {
        if (runFence.current.owns(token)) {
          activeRequest.current = null
          requestInFlight.current = false
        }
      }
    })()
    runFence.current.track(token, task)
    finalization.current.track(task)
  }, [announceForCurrentRun, owns, persistPendingSave, scanId, uri])

  useEffect(() => {
    if (initialEntry.shouldRun) run()
  }, [initialEntry.shouldRun, run])
  useEffect(() => {
    if (initialEntry.result === null || scanId === null) return
    let current = true
    void getLocalScanRepository().get(scanId).then((scan) => {
      if (!current || !mounted.current || getSession().pendingScanId !== scanId) return
      setDurableResultRevisionId(scan?.activeRevision?.id ?? null)
      setFeedbackAccepted(scan?.feedback === 'accepted')
    })
    return () => { current = false }
  }, [initialEntry.result, scanId])
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => subscription.remove()
  }, [])
  useEffect(() => {
    if (!result || result.kind !== 'analysis') return
    const update = setTimeout(() => {
      const initialStep = result.errorStepIndex ?? result.steps[0]?.index ?? null
      setSelectedStepIndex(initialStep)
      setExpandedStepIndexes(initialExpandedStepIndexes(result.errorStepIndex))
      setShowAllSteps(result.errorStepIndex === null)
      setPendingPhotoFocusIndex(null)
      setFeedbackAccepted(false)
    }, 0)
    return () => clearTimeout(update)
  }, [result])
  useEffect(() => {
    if (result || failure) return
    const startedAt = Date.now()
    const t = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(t)
  }, [failure, result])
  useEffect(() => {
    if (!failure) return
    if (failure.kind === 'persistence') {
      announceForCurrentRun('failure', 'Analysis could not be saved. Your reviewed photo is still available.')
      return
    }
    announceForCurrentRun('failure', `Analysis unavailable. ${analysisRecoveryPresentation(failure).title}`)
  }, [announceForCurrentRun, failure])
  useEffect(() => {
    if (!result || result.kind === 'analysis') return
    const message = result.kind === 'not-math'
      ? 'Analysis completed. This photo does not look like math.'
      : 'Analysis completed. This photo is too hard to read.'
    announceForCurrentRun('classified', message)
  }, [announceForCurrentRun, result])
  useEffect(() => () => {
    mounted.current = false
    runFence.current.invalidate()
    activeRequest.current?.abort()
    void correctionFence.current.invalidate()
    finalization.current.abandon(finalizationDependencies(false))
  }, [finalizationDependencies])

  const retrySaving = useCallback(() => {
    const token = activeToken.current
    const pending = pendingSave.current
    if (token === null || pending === null || !owns(token)) return
    const task = persistPendingSave(pending, token)
    runFence.current.track(token, task)
    finalization.current.track(task)
  }, [owns, persistPendingSave])

  const snapAnother = useCallback(() => {
    setIsResetting(true)
    setResetFailed(false)
    void beginAnalysisReset({
      invalidateRun: () => runFence.current.invalidate(),
      abortRequest: () => { activeRequest.current?.abort() },
      markTerminal: () => { finalization.current.markSuccessfulHandoff() },
      invalidateCorrections: () => correctionFence.current.invalidate(),
      reset: () => resetTransition.current!(),
      navigate: () => {},
    }).catch(() => {
      if (!mounted.current) return
      setIsResetting(false)
      setResetFailed(true)
    })
  }, [])

  const openFollowUp = useCallback(() => {
    if (!scanId || openingFollowUp) return
    setOpeningFollowUp(true)
    setFollowUpOpenFailed(false)
    void beginFollowUp(scanId, {
      isCurrent: () => mounted.current && getSession().pendingScanId === scanId,
    }).then((committed) => {
      if (!mounted.current) return
      if (!committed) throw new Error('follow-up changed')
      router.push('/followup')
    }).catch(() => {
      if (mounted.current) setFollowUpOpenFailed(true)
    }).finally(() => {
      if (mounted.current) setOpeningFollowUp(false)
    })
  }, [openingFollowUp, scanId])

  const acceptDiagnosis = useCallback(() => {
    if (!scanId || feedbackLock.current.busy) return
    retryCorrection.current = () => acceptDiagnosisRef.current()
    const correction = correctionFence.current.begin(scanId)
    beginCorrectionBusy(correction)
    const task = feedbackLock.current.run(async () => {
      try {
        if (!correctionFence.current.owns(correction)) return
        await getLocalScanRepository().setFeedback(scanId, 'accepted')
        if (!correctionFence.current.owns(correction)) return
        setFeedbackAccepted(true)
        retryCorrection.current = null
      } catch {
        if (!correctionFence.current.owns(correction)) return
        setCorrectionFailure({ kind: 'storage' })
      } finally {
        finishCorrectionBusy(correction)
      }
    })
    correctionFence.current.track(correction, task)
  }, [beginCorrectionBusy, finishCorrectionBusy, scanId])
  useEffect(() => {
    acceptDiagnosisRef.current = acceptDiagnosis
  }, [acceptDiagnosis])

  const submitCorrection = useCallback((analysis: Extract<AnalyzeResponse, { kind: 'analysis' }>, selectedStepIndex: number, replacement?: Extract<AnalyzeResponse, { kind: 'analysis' }>) => {
    if (!scanId || !uri || durableResultRevisionId === null || feedbackLock.current.busy) return
    let activeCorrection: CorrectionRun | null = null
    const retry = createGeneratedCorrectionRetry({
      generate: async () => {
        const correction = activeCorrection
        if (!correction || !ownsCorrection(correction, analysis))
          throw new ApiError({ kind: 'cancelled' })
        const startedAt = Date.now()
        const next = replacement ?? await correctDiagnosis(uri, { analysis, selectedStepIndex }, { signal: correction.controller.signal })
        if (!ownsCorrection(correction, analysis))
          throw new ApiError({ kind: 'cancelled' })
        if (next.kind !== 'analysis') throw new ApiError({ kind: 'invalid-response', status: 200 })
        return {
          activeRevisionId: durableResultRevisionId,
          next,
          revision: {
            id: allocateRevisionId(),
            reason: 'student-correction' as const,
            response: next,
            feedback: 'corrected' as const,
            createdAt: new Date().toISOString(),
          },
          durationMs: Math.max(0, Date.now() - startedAt),
          resultState: resultSession(scanId, next),
        }
      },
      apply: async (generated) => {
        const correction = activeCorrection
        if (!correction || !ownsCorrection(correction, analysis)) return
        await getLocalScanRepository().applyCorrection(
          scanId,
          generated.activeRevisionId,
          generated.revision,
          generated.durationMs,
          generated.resultState,
          () => ownsCorrection(correction, analysis),
        )
        if (!ownsCorrection(correction, analysis)) return
        adoptResultSession(scanId, generated.next)
        if (!ownsCorrection(correction, analysis)) return
        setDurableResultRevisionId(generated.revision.id)
        setResult(generated.next)
        retryCorrection.current = null
        feedbackEvents.current.announceOnce(`correction:${generated.revision.id}`, 'Correction completed.', announce)
        void feedbackEvents.current.completeOnce(generated.revision.id, systemHaptics)
      },
    })
    const execute = () => {
      const correction = correctionFence.current.begin(scanId)
      activeCorrection = correction
      beginCorrectionBusy(correction)
      const task = feedbackLock.current.run(async () => {
        if (!ownsCorrection(correction, analysis)) return
        setCorrectionFailure(null)
        try {
          await retry.run()
        } catch (error) {
          if (!ownsCorrection(correction, analysis) || (error instanceof ApiError && error.failure.kind === 'cancelled')) return
          setCorrectionFailure(error instanceof CorrectionStorageError
            ? { kind: 'storage' }
            : error instanceof ApiError
              ? error.failure
              : { kind: 'network' })
        } finally {
          finishCorrectionBusy(correction)
        }
      })
      correctionFence.current.track(correction, task)
    }
    retryCorrection.current = execute
    execute()
  }, [beginCorrectionBusy, durableResultRevisionId, finishCorrectionBusy, ownsCorrection, scanId, uri])

  const excludeDiagnosis = useCallback((analysis: Extract<AnalyzeResponse, { kind: 'analysis' }>) => {
    if (!scanId || durableResultRevisionId === null || feedbackLock.current.busy) return
    const execute = () => {
      const correction = correctionFence.current.begin(scanId)
      beginCorrectionBusy(correction)
      const task = feedbackLock.current.run(async () => {
        if (!ownsCorrection(correction, analysis)) return
        setCorrectionFailure(null)
        try {
          const activeScan = await getLocalScanRepository().get(scanId)
          if (!ownsCorrection(correction, analysis)) return
          const activeRevision = activeScan?.activeRevision
          if (!activeRevision || activeRevision.id !== durableResultRevisionId || JSON.stringify(activeRevision.response) !== JSON.stringify(analysis)) return
          const nextSession = reviewSession()
          if (!ownsCorrection(correction, analysis)) return
          await getLocalScanRepository().excludeDiagnosis(scanId, nextSession, () => ownsCorrection(correction, analysis))
          if (!ownsCorrection(correction, analysis)) return
          adoptReviewSession()
          if (!ownsCorrection(correction, analysis)) return
          retryCorrection.current = null
          router.replace('/review')
        } catch {
          if (ownsCorrection(correction, analysis)) setCorrectionFailure({ kind: 'storage' })
        } finally {
          finishCorrectionBusy(correction)
        }
      })
      correctionFence.current.track(correction, task)
    }
    retryCorrection.current = execute
    execute()
  }, [beginCorrectionBusy, durableResultRevisionId, finishCorrectionBusy, ownsCorrection, scanId])

  const cancelCorrection = useCallback(() => {
    const token = correctionBusy.current.currentToken
    void correctionFence.current.invalidate().then(() => {
      if (token !== null && correctionBusy.current.finish(token)) setFeedbackBusy(false)
    })
    setCorrectionFailure(null)
  }, [])

  const scrollToPhoto = useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      resultScrollRef.current?.scrollTo({
        y: Math.max(0, photoOffsetY.current - spacing.md),
        animated: !reduceMotion,
      })
    }))
  }, [reduceMotion])

  const selectTimelineStep = useCallback((index: number) => {
    setSelectedStepIndex((current) => selectStepIndex(current, index))
    setShowAllSteps(true)
    scrollToPhoto()
  }, [scrollToPhoto])

  const toggleTimelineStepExpanded = useCallback((index: number) => {
    setExpandedStepIndexes((expanded) => toggleExpandedStepIndexes(expanded, index))
  }, [])

  const selectPhotoStep = useCallback((index: number) => {
    setSelectedStepIndex((current) => selectStepIndex(current, index))
    setExpandedStepIndexes((expanded) => expandStepIndex(expanded, index))
    setShowAllSteps(true)
    setPendingPhotoFocusIndex(index)
  }, [])

  const rememberTimelineStepLayout = useCallback((index: number, y: number) => {
    timelineStepOffsets.current.set(index, y)
    setTimelineLayoutVersion((version) => version + 1)
  }, [])

  useEffect(() => {
    if (pendingPhotoFocusIndex === null) return
    let innerFrame: number | null = null
    const frame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        const stepOffsetY = timelineStepOffsets.current.get(pendingPhotoFocusIndex)
        const stepNode = timelineRef.current?.getStepNode(pendingPhotoFocusIndex)
        if (stepOffsetY === undefined || !stepNode) return
        resultScrollRef.current?.scrollTo({
          y: Math.max(0, timelineOffsetY.current + stepOffsetY - spacing.md),
          animated: !reduceMotion,
        })
        const nodeHandle = findNodeHandle(stepNode)
        if (nodeHandle !== null) AccessibilityInfo.setAccessibilityFocus(nodeHandle)
        setPendingPhotoFocusIndex(null)
      })
    })
    return () => {
      cancelAnimationFrame(frame)
      if (innerFrame !== null) cancelAnimationFrame(innerFrame)
    }
  }, [pendingPhotoFocusIndex, reduceMotion, showAllSteps, timelineLayoutVersion])

  const resetFailure = resetFailed ? <ResetFailure onRetry={snapAnother} /> : null

  if (reviewReturnFailed) {
    return (
      <AppScreen contentStyle={styles.stateContent}>
        <View style={styles.stateCopy}>
          <Text style={styles.stateEyebrow}>RETURN UNAVAILABLE</Text>
          <Text style={styles.stateTitle}>We couldn’t return to your review.</Text>
          <Text style={styles.stateDetail}>Your reviewed photo is still saved. Try returning to review again.</Text>
        </View>
        <AppButton label="Try returning to review" onPress={() => { void returnToReview() }} />
      </AppScreen>
    )
  }

  if (completedReturnFailed) {
    return (
      <AppScreen contentStyle={styles.stateContent}>
        <View style={styles.stateCopy}>
          <Text style={styles.stateEyebrow}>RETURN UNAVAILABLE</Text>
          <Text style={styles.stateTitle}>We couldn’t return to your review.</Text>
          <Text style={styles.stateDetail}>Your completed result is still saved. Try returning to review again.</Text>
        </View>
        <AppButton label="Try returning to review" onPress={() => { void returnCompletedResultToReview() }} />
      </AppScreen>
    )
  }

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
    return uri ? <AnalysisProgress key={analysisRunId} uri={uri} elapsedSeconds={elapsedSeconds} descriptionIndex={Math.floor(elapsedSeconds / 6)} onCancel={() => { void returnToReview() }} /> : null
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
        {unsaved ? <UnsavedBanner onRetry={retrySaving} isSaving={isSaving} /> : null}
        <AppButton label={isReturningCompleted ? 'Returning…' : 'Return to review'} disabled={isReturningCompleted} onPress={() => { void returnCompletedResultToReview() }} />
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
        {unsaved ? <UnsavedBanner onRetry={retrySaving} isSaving={isSaving} /> : null}
        <AppButton label={isReturningCompleted ? 'Returning…' : 'Return to review'} disabled={isReturningCompleted} onPress={() => { void returnCompletedResultToReview() }} />
      </AppScreen>
    )
  }

  const correct = result.errorStepIndex === null
  const label = result.misconceptionTag ? tagLabel(result.misconceptionTag) : null
  const presentation = analysisPresentation(result)

  return (
    <AppScreen contentStyle={styles.resultContent} scrollRef={resultScrollRef}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Return to camera"
          accessibilityHint="Starts a new camera capture."
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
      {uri ? (
        <View onLayout={(event) => { photoOffsetY.current = event.nativeEvent.layout.y }}>
          <ZoomablePhoto
            uri={uri}
            renderOverlay={(geometry, zoomScale) => (
              <PhotoOverlay
                steps={result.steps}
                geometry={geometry}
                zoomScale={zoomScale}
                selectedStepIndex={selectedStepIndex}
                onSelectStep={selectPhotoStep}
              />
            )}
          />
        </View>
      ) : null}
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
      {unsaved ? <UnsavedBanner onRetry={retrySaving} isSaving={isSaving} /> : null}
      {isDurableFeedbackAvailable(result, { revisionId: durableResultRevisionId, isSaving, unsaved }) && !feedbackAccepted ? (
        <DiagnosisFeedback
          response={result}
          busy={feedbackBusy}
          failure={correctionFailure}
          onAccept={acceptDiagnosis}
          onCorrectStep={(index) => submitCorrection(result, index)}
          onAllCorrect={() => submitCorrection(result, result.errorStepIndex!, synthesizeAllCorrectResponse(result))}
          onNotCaptured={() => excludeDiagnosis(result)}
          onRetry={() => retryCorrection.current?.()}
          onCancelRequest={cancelCorrection}
          reduceMotion={reduceMotion}
        />
      ) : null}
      <View style={styles.timeline} onLayout={(event) => { timelineOffsetY.current = event.nativeEvent.layout.y }}>
        <StepTimeline
          ref={timelineRef}
          steps={result.steps}
          errorStepIndex={result.errorStepIndex}
          selectedStepIndex={selectedStepIndex}
          showAll={showAllSteps}
          onSelectStep={selectTimelineStep}
          onShowAll={() => setShowAllSteps((visible) => !visible)}
          expandedStepIndexes={expandedStepIndexes}
          onToggleStepExpanded={toggleTimelineStepExpanded}
          onStepLayout={rememberTimelineStepLayout}
          misconceptionLabel={label}
          explanation={result.explanation}
        />
      </View>
      <View style={styles.actions}>
        {result.followUp && !correct ? (
          <AppButton
            label="Try a similar problem"
            disabled={openingFollowUp}
            onPress={openFollowUp}
          />
        ) : null}
        {followUpOpenFailed ? <Text accessibilityRole="alert" style={styles.resetFailureCopy}>We couldn’t open this practice problem. Try again.</Text> : null}
        {resetFailure}
        <AppButton label="Snap another" onPress={snapAnother} disabled={isResetting} variant="tertiary" />
      </View>
    </AppScreen>
  )
}

function UnsavedBanner({ onRetry, isSaving }: { onRetry: () => void; isSaving: boolean }) {
  return (
    <View style={styles.unsavedBanner}>
      <Text accessibilityRole="alert" style={styles.unsavedCopy}>{isSaving ? 'Saving this result…' : 'This result is visible, but it isn’t saved yet.'}</Text>
      <AppButton label={isSaving ? 'Saving…' : 'Retry saving'} onPress={onRetry} disabled={isSaving} variant="secondary" />
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
  stateTitle: { color: colors.chalk, fontSize: 28, fontWeight: '700', letterSpacing: -0.7 },
  stateDetail: { color: colors.muted, fontSize: 15 },
  tips: { gap: spacing.sm, marginTop: spacing.xs },
  tip: { color: colors.muted, fontSize: 15 },
  resultContent: { paddingTop: spacing.xs },
  topBar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topAction: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  topTitle: { color: colors.chalk, fontSize: 15, fontWeight: '700' },
  diagnosis: { gap: spacing.sm, paddingVertical: spacing.md },
  diagnosisEyebrow: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  verifiedLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  verifiedMark: { color: colors.success, fontSize: 15, fontWeight: '800' },
  headline: { flexShrink: 1, color: colors.chalk, fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  diagnosisDetail: { color: colors.muted, fontSize: 15 },
  timeline: { marginTop: spacing.xs },
  actions: { gap: spacing.md, marginTop: spacing.sm },
  resetFailure: { gap: spacing.sm },
  resetFailureCopy: { color: colors.error, fontSize: 15 },
  unsavedBanner: { gap: spacing.sm, paddingVertical: spacing.sm },
  unsavedCopy: { color: colors.error, fontSize: 15 },
})
