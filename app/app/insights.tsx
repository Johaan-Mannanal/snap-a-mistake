import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppButton } from '../src/components/AppButton'
import { AppIcon } from '../src/components/AppIcon'
import { InsightsSwitcher, type InsightsSection } from '../src/components/InsightsSwitcher'
import { ScanHistoryRow } from '../src/components/ScanHistoryRow'
import { ConfirmAction } from '../src/components/ConfirmAction'
import { getLocalScanRepository } from '../src/lib/history'
import { flushCommittedCleanup } from '../src/lib/scanFiles'
import { clearSessionAfterAtomicDiscard } from '../src/lib/session'
import { summarize } from '../src/lib/trends'
import { insightsPresentation, type InsightsDataState } from '../src/ui/insightsPresentation'
import { CLEAR_ALL_CONFIRMATION, DATA_PRIVACY_COPY } from '../src/ui/scanDetail'
import { colors, spacing, typeScale } from '../src/ui/theme'

export default function Insights() {
  const [section, setSection] = useState<InsightsSection>('patterns')
  const [state, setState] = useState<InsightsDataState>({ kind: 'loading' })
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [clearFailure, setClearFailure] = useState<string | null>(null)
  const requestId = useRef(0)
  const clearInFlight = useRef(false)
  const clearTriggerRef = useRef<View | null>(null)

  const loadHistory = useCallback(() => {
    const currentRequest = ++requestId.current
    setState({ kind: 'loading' })
    void (async () => {
      try {
        const repository = getLocalScanRepository()
        const [scans, trendSources] = await Promise.all([repository.list(), repository.loadTrendSources()])
        if (requestId.current === currentRequest)
          setState({ kind: 'ready', scans, patterns: summarize(trendSources, new Date()) })
      } catch {
        if (requestId.current === currentRequest) setState({ kind: 'error' })
      }
    })()
  }, [])

  useEffect(() => {
    loadHistory()
    return () => { requestId.current += 1 }
  }, [loadHistory])

  const presentation = insightsPresentation(state)
  const header = <InsightsHeader section={section} onSectionChange={setSection} />
  const retryCleanup = () => {
    void settleClearCleanup(getLocalScanRepository())
  }

  const settleClearCleanup = async (repository: ReturnType<typeof getLocalScanRepository>) => {
    const { pending } = await flushCommittedCleanup(repository)
    setClearFailure(pending ? 'History is cleared, but one or more saved photos still need cleanup. Try again.' : null)
    if (!pending) router.dismissTo('/')
  }

  const clearAll = async () => {
    if (clearInFlight.current) return
    clearInFlight.current = true
    setClearFailure(null)
    let repository: ReturnType<typeof getLocalScanRepository>
    try {
      repository = getLocalScanRepository()
      await repository.clearAll()
    } catch {
      setConfirmingClear(false)
      setClearFailure('We couldn’t clear local history. Your saved scans are still available. Try again.')
      clearInFlight.current = false
      return
    }
    clearSessionAfterAtomicDiscard()
    setConfirmingClear(false)
    setState({ kind: 'ready', scans: [], patterns: [] })
    clearInFlight.current = false
    void settleClearCleanup(repository)
  }
  const privacy = <DataPrivacy clearTriggerRef={clearTriggerRef} clearFailure={clearFailure} onClear={() => setConfirmingClear(true)} onRetryCleanup={retryCleanup} />
  const confirmation = (
    <ConfirmAction
      visible={confirmingClear}
      title="Clear all history?"
      copy={CLEAR_ALL_CONFIRMATION}
      confirmLabel="Clear all history"
      restoreFocusRef={clearTriggerRef}
      onCancel={() => setConfirmingClear(false)}
      onConfirm={clearAll}
    />
  )

  if (section === 'scans') {
    const scans = presentation.kind === 'ready' && presentation.scans.kind === 'list' ? presentation.scans.items : []
    return (
      <SafeAreaView style={styles.safe}>
        <FlatList
          contentContainerStyle={styles.listContent}
          data={scans}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          ListEmptyComponent={<HistoryState presentation={presentation} onRetry={loadHistory} />}
          ListFooterComponent={privacy}
          renderItem={({ item }) => (
            <ScanHistoryRow item={item} onPress={() => router.push(`/scan/${encodeURIComponent(item.id)}`)} />
          )}
        />
        {confirmation}
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {header}
        <PatternState presentation={presentation} onRetry={loadHistory} />
        {privacy}
        {confirmation}
      </ScrollView>
    </SafeAreaView>
  )

  return null
}

function InsightsHeader(props: { section: InsightsSection; onSectionChange: (section: InsightsSection) => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the camera."
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, { opacity: pressed ? 0.5 : 1 }]}
        >
          <AppIcon name="chevron.left" fallback="‹" size={22} />
        </Pressable>
      </View>
      <Text style={styles.title}>Insights</Text>
      <Text style={styles.intro}>Private learning history, stored on this device.</Text>
      <InsightsSwitcher section={props.section} onChange={props.onSectionChange} />
    </View>
  )
}

function PatternState(props: { presentation: ReturnType<typeof insightsPresentation>; onRetry: () => void }) {
  if (props.presentation.kind === 'loading') return <Text style={styles.loading}>{props.presentation.title}</Text>
  if (props.presentation.kind === 'error') return <ErrorState presentation={props.presentation} onRetry={props.onRetry} />
  if (props.presentation.patterns.kind === 'empty') return <EmptyState presentation={props.presentation.patterns} />
  return (
    <View style={styles.patternList}>
      {props.presentation.patterns.items.map((item) => (
        <View key={item.title} style={styles.patternRow}>
          <Text style={styles.patternTitle}>{item.title}</Text>
          <Text style={styles.patternDetail}>{item.direction}</Text>
          {item.resolution ? <Text style={styles.resolution}>{item.resolution}</Text> : null}
        </View>
      ))}
    </View>
  )
}

function HistoryState(props: { presentation: ReturnType<typeof insightsPresentation>; onRetry: () => void }) {
  if (props.presentation.kind === 'loading') return <Text style={styles.loading}>{props.presentation.title}</Text>
  if (props.presentation.kind === 'error') return <ErrorState presentation={props.presentation} onRetry={props.onRetry} />
  if (props.presentation.scans.kind === 'empty') return <EmptyState presentation={props.presentation.scans} />
  return null
}

function ErrorState(props: { presentation: Extract<ReturnType<typeof insightsPresentation>, { kind: 'error' }>; onRetry: () => void }) {
  return (
    <View accessibilityRole="alert" style={styles.state}>
      <View style={styles.stateCopy}>
        <Text style={styles.stateTitle}>{props.presentation.title}</Text>
        <Text style={styles.stateDetail}>{props.presentation.detail}</Text>
      </View>
      <AppButton label={props.presentation.actionLabel} onPress={props.onRetry} variant="secondary" />
    </View>
  )
}

function EmptyState(props: { presentation: Extract<ReturnType<typeof insightsPresentation>, { kind: 'ready' }>['patterns'] | Extract<ReturnType<typeof insightsPresentation>, { kind: 'ready' }>['scans'] }) {
  if (props.presentation.kind !== 'empty') return null
  return (
    <View style={styles.state}>
      <View style={styles.stateCopy}>
        <Text style={styles.stateTitle}>{props.presentation.title}</Text>
        <Text style={styles.stateDetail}>{props.presentation.detail}</Text>
      </View>
      <AppButton label={props.presentation.actionLabel} onPress={() => router.dismissTo('/')} variant="secondary" />
    </View>
  )
}

function DataPrivacy(props: {
  clearTriggerRef: RefObject<View | null>
  clearFailure: string | null
  onClear: () => void
  onRetryCleanup: () => void
}) {
  return (
    <>
      <View style={styles.privacy}>
        <Text style={styles.privacyTitle}>Data and privacy</Text>
        <Text style={styles.privacyCopy}>{DATA_PRIVACY_COPY}</Text>
      </View>
      {props.clearFailure ? (
        <View accessibilityRole="alert" style={styles.clearFailure}>
          <Text style={styles.clearFailureCopy}>{props.clearFailure}</Text>
          <AppButton label="Retry photo cleanup" onPress={props.onRetryCleanup} variant="secondary" />
        </View>
      ) : null}
      <Pressable
        ref={props.clearTriggerRef}
        accessibilityRole="button"
        accessibilityLabel="Clear all local history"
        accessibilityHint="Permanently removes all saved scans from this device."
        onPress={props.onClear}
        style={styles.clearAction}
      >
        <Text style={styles.clearActionLabel}>Clear all history</Text>
      </Pressable>
    </>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: spacing.xxl, gap: spacing.lg },
  listContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: spacing.xxl },
  header: { gap: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.lg },
  topBar: { minHeight: 44, justifyContent: 'center' },
  back: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  title: { color: colors.chalk, fontSize: typeScale.display, fontWeight: '700', letterSpacing: -0.8 },
  intro: { color: colors.muted, fontSize: typeScale.body },
  loading: { color: colors.muted, fontSize: typeScale.body, paddingTop: spacing.sm },
  state: { flexGrow: 1, justifyContent: 'space-between', gap: spacing.xl, paddingVertical: spacing.xxl },
  stateCopy: { gap: spacing.sm },
  stateTitle: { color: colors.chalk, fontSize: typeScale.title, fontWeight: '700', letterSpacing: -0.5 },
  stateDetail: { color: colors.muted, fontSize: typeScale.body },
  patternList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.carbon },
  patternRow: { gap: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.carbon, paddingVertical: spacing.lg },
  patternTitle: { color: colors.chalk, fontSize: typeScale.body, fontWeight: '700' },
  patternDetail: { color: colors.muted, fontSize: typeScale.caption },
  resolution: { color: colors.success, fontSize: typeScale.caption, fontWeight: '700' },
  privacy: { gap: spacing.sm, marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.carbon },
  privacyTitle: { color: colors.chalk, fontSize: typeScale.body, fontWeight: '700' },
  privacyCopy: { color: colors.muted, fontSize: typeScale.caption },
  clearFailure: { gap: spacing.sm, marginTop: spacing.md },
  clearFailureCopy: { color: colors.error, fontSize: typeScale.body },
  clearAction: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', marginTop: spacing.md, paddingVertical: spacing.sm },
  clearActionLabel: { color: colors.error, fontSize: typeScale.body, fontWeight: '700', textDecorationLine: 'underline' },
})
