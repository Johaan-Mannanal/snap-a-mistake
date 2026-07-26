import { useCallback, useEffect, useRef, useState } from 'react'
import { File } from 'expo-file-system'
import { router, useLocalSearchParams } from 'expo-router'
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native'
import type { AnalyzeResponse } from '@snap/shared'
import { AppScreen } from '../../src/components/AppScreen'
import { AppButton } from '../../src/components/AppButton'
import { ConfirmAction } from '../../src/components/ConfirmAction'
import { PhotoOverlay } from '../../src/components/PhotoOverlay'
import { StepTimeline } from '../../src/components/StepTimeline'
import { ZoomablePhoto } from '../../src/components/ZoomablePhoto'
import { AppIcon } from '../../src/components/AppIcon'
import { getLocalScanRepository } from '../../src/lib/history'
import { clearSessionAfterAtomicDiscard, clearSessionForDeletedScans } from '../../src/lib/session'
import { flushCommittedCleanup } from '../../src/lib/scanFiles'
import { initialExpandedStepIndexes, selectStepIndex, toggleExpandedStepIndexes } from '../../src/lib/resultInteraction'
import { tagLabel } from '../../src/lib/labels'
import { analysisPresentation, analysisRecoveryPresentation } from '../../src/ui/presentation'
import { colors, spacing } from '../../src/ui/theme'
import {
  DELETE_SCAN_CONFIRMATION,
  historicalFollowUpPresentation,
  parseScanRouteId,
  scanDetailPresentation,
  type ScanDetailPresentation,
} from '../../src/ui/scanDetail'
import type { ScanRecord } from '../../src/lib/scanTypes'

type DetailState =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'missing' }
  | { kind: 'error' }
  | { kind: 'ready'; scan: ScanRecord; presentation: ScanDetailPresentation }
  | { kind: 'deleted'; cleanupPending: boolean }

function ownedPhotoAvailable(uri: string): boolean {
  try {
    return new File(uri).exists
  } catch {
    return false
  }
}

export default function ScanDetail() {
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const scanId = parseScanRouteId(params.id)
  const [state, setState] = useState<DetailState>(() => scanId ? { kind: 'loading' } : { kind: 'invalid' })
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteFailure, setDeleteFailure] = useState<string | null>(null)
  const requestId = useRef(0)
  const actionInFlight = useRef(false)
  const deleteTriggerRef = useRef<View | null>(null)

  const load = useCallback(() => {
    if (!scanId) {
      setState({ kind: 'invalid' })
      return
    }
    const current = ++requestId.current
    setState({ kind: 'loading' })
    void (async () => {
      try {
        const scan = await getLocalScanRepository().get(scanId)
        if (requestId.current !== current) return
        if (!scan) {
          setState({ kind: 'missing' })
          return
        }
        setState({ kind: 'ready', scan, presentation: scanDetailPresentation(scan, ownedPhotoAvailable(scan.imageUri)) })
      } catch {
        if (requestId.current === current) setState({ kind: 'error' })
      }
    })()
  }, [scanId])

  useEffect(() => {
    queueMicrotask(load)
    return () => { requestId.current += 1 }
  }, [load])

  const deleteScan = async () => {
    if (!scanId || actionInFlight.current) return
    actionInFlight.current = true
    setDeleteFailure(null)
    try {
      const repository = getLocalScanRepository()
      const committed = await repository.delete(scanId)
      if (committed === null) {
        setConfirmingDelete(false)
        setState({ kind: 'missing' })
        return
      }
      try {
        await clearSessionForDeletedScans(committed.deletedScanIds)
      } catch {
        // The durable record is already gone; never leave the in-memory camera pointed at it.
        clearSessionAfterAtomicDiscard()
      }
      setConfirmingDelete(false)
      setState({ kind: 'deleted', cleanupPending: true })
      AccessibilityInfo.announceForAccessibility('Scan removed from history. Checking photo cleanup.')
      void settleCleanup(repository)
    } catch {
      setConfirmingDelete(false)
      setDeleteFailure('We couldn’t remove this scan from local history. Nothing was deleted. Try again.')
      AccessibilityInfo.announceForAccessibility('We couldn’t remove this scan from local history. Nothing was deleted. Try again.')
    } finally {
      actionInFlight.current = false
    }
  }

  const retryCleanup = () => {
    void settleCleanup(getLocalScanRepository())
  }

  const settleCleanup = async (repository: ReturnType<typeof getLocalScanRepository>) => {
    const { pending } = await flushCommittedCleanup(repository)
    setState({ kind: 'deleted', cleanupPending: pending })
    AccessibilityInfo.announceForAccessibility(pending
      ? 'Scan removed from history. Photo cleanup needs another try.'
      : 'Photo cleanup finished.')
  }

  if (state.kind === 'loading') return <DetailStateScreen title="Loading saved scan…" />
  if (state.kind === 'invalid') return <DetailStateScreen title="This scan link is invalid" detail="Choose a saved scan from Insights." />
  if (state.kind === 'missing') return <DetailStateScreen title="This scan is no longer available" detail="It may have been removed from this device." />
  if (state.kind === 'error') return <DetailStateScreen title="We couldn’t load this scan" detail="Your saved history remains on this device. Try again." onRetry={load} />
  if (state.kind === 'deleted') {
    return (
      <DetailStateScreen
        title="Scan removed"
        detail={state.cleanupPending ? 'The history entry is gone. Its photo cleanup needs another try and will be retried safely.' : 'Its photo, analysis, corrections, and follow-up were removed from this device.'}
        onRetry={state.cleanupPending ? retryCleanup : undefined}
        retryLabel="Retry photo cleanup"
      />
    )
  }

  return (
    <HistoricalResult
      scan={state.scan}
      presentation={state.presentation}
      deleteFailure={deleteFailure}
      deleteTriggerRef={deleteTriggerRef}
      onDelete={() => setConfirmingDelete(true)}
      onBack={() => router.back()}
      confirmation={(
        <ConfirmAction
          visible={confirmingDelete}
          title="Delete this scan?"
          copy={DELETE_SCAN_CONFIRMATION}
          confirmLabel="Delete scan"
          restoreFocusRef={deleteTriggerRef}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={deleteScan}
        />
      )}
    />
  )
}

function HistoricalResult(props: {
  scan: ScanRecord
  presentation: ScanDetailPresentation
  deleteFailure: string | null
  deleteTriggerRef: React.RefObject<View | null>
  onDelete: () => void
  onBack: () => void
  confirmation: React.ReactNode
}) {
  const result = props.presentation.kind === 'result' ? props.presentation.revision.response : null
  const followUp = historicalFollowUpPresentation(props.scan)
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(() => result?.kind === 'analysis' ? result.errorStepIndex : null)
  const [expandedStepIndexes, setExpandedStepIndexes] = useState<Set<number>>(() => result?.kind === 'analysis' ? initialExpandedStepIndexes(result.errorStepIndex) : new Set())
  const [showAllSteps, setShowAllSteps] = useState(false)
  const selectStep = (index: number) => {
    setSelectedStepIndex((current) => selectStepIndex(current, index))
    setExpandedStepIndexes((current) => {
      const next = new Set(current)
      next.add(index)
      return next
    })
  }

  const content = (() => {
    if (props.presentation.kind !== 'result') return <Text style={styles.stateDetail}>{props.presentation.detail}</Text>
    const activeResult = props.presentation.revision.response
    return activeResult.kind === 'analysis'
      ? <AnalysisResult response={activeResult} selectedStepIndex={selectedStepIndex} setSelectedStepIndex={selectStep} expandedStepIndexes={expandedStepIndexes} setExpandedStepIndexes={setExpandedStepIndexes} showAllSteps={showAllSteps} setShowAllSteps={setShowAllSteps} />
      : <RecoveryResult response={activeResult} />
  })()

  return (
    <AppScreen contentStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Insights" hitSlop={8} onPress={props.onBack} style={styles.topAction}>
          <AppIcon name="chevron.left" fallback="‹" size={22} />
        </Pressable>
        <Text style={styles.topTitle}>Saved scan</Text>
        <View style={styles.topAction} />
      </View>
      <View style={styles.audit}>
        <Text style={styles.eyebrow}>{props.presentation.statusLabel.toUpperCase()}</Text>
        {props.presentation.kind === 'result' ? <Text style={styles.auditDetail}>Active revision · {props.presentation.revisionStatus}</Text> : null}
        <Text style={styles.auditDetail}>Saved {new Date(props.scan.updatedAt).toLocaleString()}</Text>
      </View>
      {props.presentation.photoAvailable ? (
        <ZoomablePhoto
          uri={props.scan.imageUri}
          renderOverlay={result?.kind === 'analysis'
            ? (geometry) => <PhotoOverlay steps={result.steps} geometry={geometry} selectedStepIndex={selectedStepIndex} onSelectStep={selectStep} />
            : undefined}
        />
      ) : <MissingPhoto />}
      {content}
      {followUp ? <HistoricalFollowUp followUp={followUp} /> : null}
      {props.deleteFailure ? <Text accessibilityRole="alert" style={styles.failure}>{props.deleteFailure}</Text> : null}
      <Pressable
        ref={props.deleteTriggerRef}
        accessibilityRole="button"
        accessibilityLabel="Delete saved scan"
        accessibilityHint="Permanently removes this scan from this device."
        onPress={props.onDelete}
        style={styles.deleteAction}
      >
        <Text style={styles.deleteLabel}>Delete scan</Text>
      </Pressable>
      {props.confirmation}
    </AppScreen>
  )
}

function HistoricalFollowUp(props: { followUp: NonNullable<ReturnType<typeof historicalFollowUpPresentation>> }) {
  const { followUp } = props
  return (
    <View
      accessible
      accessibilityLabel={`Saved follow-up. Status: ${followUp.statusLabel}. Concept: ${followUp.concept}. Problem: ${followUp.problem}. Hint: ${followUp.hint}. ${followUp.readOnlyDetail}.`}
      style={styles.followUp}
    >
      <View style={styles.followUpHeader}>
        <Text style={styles.eyebrow}>{followUp.eyebrow}</Text>
        <Text style={styles.followUpStatus}>{followUp.statusLabel}</Text>
      </View>
      <Text style={styles.followUpConcept}>{followUp.concept}</Text>
      <Text style={styles.followUpProblem}>{followUp.problem}</Text>
      <Text style={styles.followUpHint}>Hint: {followUp.hint}</Text>
      <Text style={styles.readOnlyDetail}>{followUp.readOnlyDetail}</Text>
    </View>
  )
}

function AnalysisResult(props: {
  response: Extract<AnalyzeResponse, { kind: 'analysis' }>
  selectedStepIndex: number | null
  setSelectedStepIndex: (index: number) => void
  expandedStepIndexes: Set<number>
  setExpandedStepIndexes: React.Dispatch<React.SetStateAction<Set<number>>>
  showAllSteps: boolean
  setShowAllSteps: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const presentation = analysisPresentation(props.response)
  const label = props.response.misconceptionTag ? tagLabel(props.response.misconceptionTag) : null
  return (
    <>
      <View style={styles.diagnosis}>
        <Text style={styles.eyebrow}>{presentation.eyebrow}</Text>
        <Text style={styles.headline}>{presentation.headline}</Text>
        <Text style={styles.stateDetail}>{presentation.detail}</Text>
      </View>
      <StepTimeline
        steps={props.response.steps}
        errorStepIndex={props.response.errorStepIndex}
        selectedStepIndex={props.selectedStepIndex}
        showAll={props.showAllSteps}
        onSelectStep={props.setSelectedStepIndex}
        onShowAll={() => props.setShowAllSteps((visible) => !visible)}
        expandedStepIndexes={props.expandedStepIndexes}
        onToggleStepExpanded={(index) => props.setExpandedStepIndexes((indexes) => toggleExpandedStepIndexes(indexes, index))}
        misconceptionLabel={label}
        explanation={props.response.explanation}
      />
    </>
  )
}

function RecoveryResult(props: { response: Exclude<AnalyzeResponse, { kind: 'analysis' }> }) {
  const presentation = analysisRecoveryPresentation(props.response)
  return <View style={styles.diagnosis}><Text style={styles.eyebrow}>{presentation.eyebrow}</Text><Text style={styles.headline}>{presentation.title}</Text><Text style={styles.stateDetail}>{presentation.detail}</Text></View>
}

function MissingPhoto() {
  return <View accessibilityRole="alert" style={styles.missingPhoto}><AppIcon name="photo" fallback="Photo" size={22} /><Text style={styles.stateDetail}>The saved photo is no longer available on this device. The audit record is still available below.</Text></View>
}

function DetailStateScreen(props: { title: string; detail?: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <AppScreen contentStyle={styles.stateScreen}>
      <View style={styles.stateCopy}><Text style={styles.headline}>{props.title}</Text>{props.detail ? <Text style={styles.stateDetail}>{props.detail}</Text> : null}</View>
      {props.onRetry ? <AppButton label={props.retryLabel ?? 'Try again'} onPress={props.onRetry} variant="secondary" /> : null}
      <AppButton label="Back to Insights" onPress={() => router.dismissTo('/insights')} variant="tertiary" />
    </AppScreen>
  )
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xs },
  topBar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topAction: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  topTitle: { color: colors.chalk, fontSize: 15, fontWeight: '700' },
  audit: { gap: spacing.xs, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.carbon },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  auditDetail: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  diagnosis: { gap: spacing.sm, paddingVertical: spacing.md },
  followUp: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.carbon, backgroundColor: colors.graphite },
  followUpHeader: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  followUpStatus: { color: colors.chalk, fontSize: 13, fontWeight: '700' },
  followUpConcept: { color: colors.muted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.1 },
  followUpProblem: { color: colors.chalk, fontSize: 20, fontWeight: '700', lineHeight: 27 },
  followUpHint: { color: colors.chalk, fontSize: 15, lineHeight: 22, borderLeftWidth: 2, borderLeftColor: colors.chalk, paddingLeft: spacing.sm },
  readOnlyDetail: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  headline: { color: colors.chalk, fontSize: 24, fontWeight: '700', letterSpacing: -0.5, lineHeight: 30 },
  stateDetail: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  missingPhoto: { minHeight: 160, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.carbon, backgroundColor: colors.graphite },
  deleteAction: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingVertical: spacing.sm },
  deleteLabel: { color: colors.error, fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
  failure: { color: colors.error, fontSize: 15, lineHeight: 22 },
  stateScreen: { flexGrow: 1, justifyContent: 'center' },
  stateCopy: { gap: spacing.sm, marginBottom: spacing.xl },
})
