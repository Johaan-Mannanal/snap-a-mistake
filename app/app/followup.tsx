import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useNavigation, type NativeStackNavigationProp } from 'expo-router'
import { AppButton } from '../src/components/AppButton'
import { AppScreen } from '../src/components/AppScreen'
import { ApiError, requestAlternateFollowUp } from '../src/lib/api'
import {
  buildAlternateFollowUpContext,
  beginFollowUpRouteActivation,
  canStartAlternateFollowUp,
  createFollowUpPracticeState,
  createFollowUpHandoffCoordinator,
  createFollowUpLeaveLock,
  createFollowUpRouteGate,
  revealFollowUpHint,
  replaceFollowUpProblem,
  type FollowUpPressCancellationScheduler,
  type FollowUpPracticeState,
} from '../src/lib/followUp'
import { getLocalScanRepository } from '../src/lib/history'
import { getFollowUpPractice, getSession, returnFromFollowUp, startFollowUp } from '../src/lib/session'
import { colors, spacing, typeScale } from '../src/ui/theme'
import { useSystemBackTransition } from '../src/lib/useSystemBackTransition'

type AlternateFailure = 'duplicate' | 'link' | 'network' | 'storage'

const scheduleWebPressCancellation: FollowUpPressCancellationScheduler = (cancel) => {
  setTimeout(cancel, 0)
}

function currentParentId(): string | null {
  const session = getSession()
  return session.pendingScanId ?? session.parentScanId
}

function diagnosisForParent(): Promise<string> {
  const parentId = currentParentId()
  if (parentId === null) return Promise.resolve('Practice this concept again.')
  return getLocalScanRepository().get(parentId).then((parent) => (
    parent?.activeRevision?.response.kind === 'analysis'
      ? parent.activeRevision.response.explanation ?? 'Practice this concept again.'
      : 'Practice this concept again.'
  ))
}

export default function FollowUp() {
  const initialFollowUp = getSession().followUp
  const [practice, setPractice] = useState<FollowUpPracticeState | null>(() => (
    getFollowUpPractice() ?? (initialFollowUp ? createFollowUpPracticeState(initialFollowUp) : null)
  ))
  const [alternateFailure, setAlternateFailure] = useState<AlternateFailure | null>(null)
  const [requestingAlternate, setRequestingAlternate] = useState(false)
  const [checkingWork, setCheckingWork] = useState(false)
  const [checkFailure, setCheckFailure] = useState<string | null>(null)
  const [isLeaving, setIsLeaving] = useState(false)
  const [leaveFailure, setLeaveFailure] = useState<string | null>(null)
  const handoff = useRef(createFollowUpHandoffCoordinator())
  const leaveLock = useRef(createFollowUpLeaveLock())
  const routeGate = useRef(createFollowUpRouteGate(
    Platform.OS === 'web' ? scheduleWebPressCancellation : undefined,
  ))
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>()
  const mounted = useRef(true)
  const practiceRouteCurrent = useRef(true)
  const parentScanId = useRef(currentParentId()).current

  useEffect(() => {
    mounted.current = true
    const coordinator = handoff.current
    return () => {
      mounted.current = false
      practiceRouteCurrent.current = false
      void coordinator.invalidate().catch(() => {})
    }
  }, [])
  useFocusEffect(useCallback(() => (
    beginFollowUpRouteActivation(
      routeGate.current,
      (listener) => navigation.addListener('transitionEnd', listener),
      { armOnFocus: Platform.OS === 'web' },
    )
  ), [navigation]))
  const leave = () => {
    practiceRouteCurrent.current = false
    const operation = leaveLock.current.run(async () => {
      await handoff.current.invalidate()
      if (parentScanId !== null) {
        const restored = await returnFromFollowUp(parentScanId, { isCurrent: () => mounted.current })
        if (!restored) throw new Error('practice route changed')
      }
      if (mounted.current) router.replace('/analyze')
    })
    if (!operation.started) return
    setIsLeaving(true)
    setLeaveFailure(null)
    void operation.promise.then(
      () => { if (mounted.current) setIsLeaving(false) },
      () => {
        if (mounted.current) {
          practiceRouteCurrent.current = true
          setIsLeaving(false)
          setLeaveFailure('We couldn’t safely leave this practice attempt. Try Back again.')
        }
      },
    )
  }
  useSystemBackTransition(leave)

  const requestAnother = () => {
    if (!canStartAlternateFollowUp({
      hasPractice: practice !== null,
      hasParent: parentScanId !== null,
      requestingAlternate: requestingAlternate || handoff.current.alternateBusy,
      checkingWork,
      isLeaving,
      routeCurrent: practiceRouteCurrent.current,
      checkOwned: handoff.current.checkBusy,
      leaveOwned: leaveLock.current.busy,
    }) || practice === null || parentScanId === null) return
    const operation = handoff.current.startAlternate(practice, {
      request: async (signal) => {
        const diagnosis = await diagnosisForParent()
        const alternate = await requestAlternateFollowUp(
          buildAlternateFollowUpContext(practice, diagnosis),
          { signal },
        )
        return replaceFollowUpProblem(practice, alternate)
      },
      persist: (replacement, isCurrent) => startFollowUp(parentScanId, replacement.followUp, {
        hintVisible: replacement.hintVisible,
        previousProblems: replacement.previousProblems,
        isCurrent: () => mounted.current && practiceRouteCurrent.current && isCurrent(),
      }),
      isRouteCurrent: () => mounted.current && practiceRouteCurrent.current,
    })
    if (!operation.started) return
    setRequestingAlternate(true)
    setAlternateFailure(null)
    void operation.promise.then(
      (result) => {
        if (!mounted.current) return
        if (result.kind === 'duplicate') {
          setAlternateFailure('duplicate')
        }
        if (result.kind === 'storage-failed') setAlternateFailure('storage')
        if (result.kind === 'updated') setPractice(result.practice)
      },
      (error) => {
        if (!mounted.current || (error instanceof ApiError && error.failure.kind === 'cancelled')) return
        setAlternateFailure('network')
      },
    ).finally(() => {
      if (mounted.current) setRequestingAlternate(false)
    })
  }

  const checkWork = () => {
    if (
      practice === null
      || checkingWork
      || isLeaving
      || handoff.current.checkBusy
      || leaveLock.current.busy
      || !practiceRouteCurrent.current
    ) return
    if (parentScanId === null) {
      setAlternateFailure('link')
      return
    }
    const operation = handoff.current.startCheck(practice, {
      persist: (snapshot, isCurrent) => startFollowUp(parentScanId, snapshot.followUp, {
        hintVisible: snapshot.hintVisible,
        previousProblems: snapshot.previousProblems,
        isCurrent: () => mounted.current && practiceRouteCurrent.current && isCurrent(),
      }),
      isRouteCurrent: () => mounted.current && practiceRouteCurrent.current,
    })
    if (!operation.started) return
    setRequestingAlternate(false)
    setCheckingWork(true)
    setCheckFailure(null)
    setAlternateFailure(null)
    void operation.promise.then(
      (ownsHandoff) => {
        if (ownsHandoff && mounted.current) router.dismissTo('/')
      },
      () => {
        if (mounted.current) setCheckFailure('We couldn’t prepare your follow-up attempt. Your problem is still here; try again.')
      },
    ).finally(() => {
      if (mounted.current) setCheckingWork(false)
    })
  }

  const revealHint = () => {
    if (
      practice === null
      || parentScanId === null
      || checkingWork
      || isLeaving
      || handoff.current.checkBusy
      || leaveLock.current.busy
      || !practiceRouteCurrent.current
    ) return
    const revealed = revealFollowUpHint(practice)
    void startFollowUp(parentScanId, revealed.followUp, {
      hintVisible: true,
      previousProblems: revealed.previousProblems,
      isCurrent: () => mounted.current && practiceRouteCurrent.current,
    }).then((persisted) => {
      if (persisted && mounted.current) setPractice(revealed)
      else if (mounted.current) setCheckFailure('We couldn’t save the hint. Try showing it again.')
    }).catch(() => {
      if (mounted.current) setCheckFailure('We couldn’t save the hint. Try showing it again.')
    })
  }

  if (practice === null) {
    return (
      <AppScreen contentStyle={styles.emptyContent}>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>FOLLOW-UP</Text>
          <Text style={styles.title}>No follow-up yet</Text>
          <Text style={styles.detail}>Analyze some work to get a tailored practice problem.</Text>
        </View>
        <AppButton label="Back to camera" onPress={() => router.dismissTo('/')} variant="secondary" />
      </AppScreen>
    )
  }

  return (
    <AppScreen contentStyle={styles.content}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isLeaving ? 'Leaving practice' : 'Back'}
          accessibilityHint="Returns to the completed analysis."
          accessibilityState={{ disabled: isLeaving, busy: isLeaving }}
          disabled={isLeaving}
          onPress={leave}
          style={[styles.back, isLeaving && styles.disabled]}
        >
          <Text style={styles.backLabel}>{isLeaving ? 'Leaving…' : '‹ Back'}</Text>
        </Pressable>
        {leaveFailure ? (
          <View style={styles.failure}>
            <Text accessibilityRole="alert" style={styles.failureCopy}>{leaveFailure}</Text>
            <AppButton label="Try Back again" onPress={leave} disabled={isLeaving} variant="tertiary" />
          </View>
        ) : null}
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>{practice.followUp.concept.toUpperCase()}</Text>
          <Text style={styles.problem}>{practice.followUp.problem}</Text>
          <Text style={styles.detail}>Work it out on paper, then snap your solution.</Text>
          {practice.hintVisible ? <Text style={styles.hint}>Hint: {practice.followUp.hint}</Text> : null}
        </View>
      </View>
      <View style={styles.actions}>
        {!practice.hintVisible ? <AppButton label="Show a hint" onPress={revealHint} disabled={checkingWork || isLeaving} variant="secondary" /> : null}
        <AppButton
          label={requestingAlternate ? 'Finding another problem…' : 'Try another similar problem'}
          onPress={requestAnother}
          disabled={requestingAlternate || checkingWork || isLeaving}
          variant="secondary"
        />
        {alternateFailure ? (
          <View style={styles.failure}>
            <Text accessibilityRole="alert" style={styles.failureCopy}>
              {alternateFailure === 'storage'
                ? 'Your new problem is ready, but we couldn’t save it on this device.'
                : alternateFailure === 'link'
                  ? 'This practice problem is no longer linked to its analysis. Go back and choose it again.'
                : alternateFailure === 'duplicate'
                  ? 'That problem was too similar. Try another similar problem.'
                  : 'We couldn’t get another problem. Your current problem is still here.'}
            </Text>
            {!checkingWork && alternateFailure !== 'link' ? (
              <AppButton
                label={alternateFailure === 'storage' ? 'Retry saving problem' : 'Retry another problem'}
                onPress={requestAnother}
                disabled={requestingAlternate || isLeaving}
                variant="tertiary"
              />
            ) : null}
          </View>
        ) : null}
        {checkFailure ? (
          <View style={styles.failure}>
            <Text accessibilityRole="alert" style={styles.failureCopy}>{checkFailure}</Text>
            <AppButton
              label="Try checking my work again"
              onPressIn={() => routeGate.current.beginPress()}
              onPressOut={() => routeGate.current.cancelPress()}
              onPress={() => {
                if (routeGate.current.consumePress()) checkWork()
              }}
              onNonPointerPress={() => {
                if (routeGate.current.consumeNonPointerActivation()) checkWork()
              }}
              disabled={checkingWork || isLeaving}
              variant="tertiary"
            />
          </View>
        ) : null}
        <AppButton
          label={checkingWork ? 'Preparing camera…' : 'Check my work'}
          onPressIn={() => routeGate.current.beginPress()}
          onPressOut={() => routeGate.current.cancelPress()}
          onPress={() => {
            if (routeGate.current.consumePress()) checkWork()
          }}
          onNonPointerPress={() => {
            if (routeGate.current.consumeNonPointerActivation()) checkWork()
          }}
          disabled={checkingWork || isLeaving}
        />
      </View>
    </AppScreen>
  )
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'space-between', paddingVertical: spacing.md },
  emptyContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xxl },
  top: { gap: spacing.lg },
  back: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingRight: spacing.md },
  backLabel: { color: colors.chalk, fontSize: typeScale.body, fontWeight: '700' },
  disabled: { opacity: 0.48 },
  copy: { gap: spacing.md },
  eyebrow: { color: colors.muted, fontSize: typeScale.caption, fontWeight: '700', letterSpacing: 1.6 },
  title: { color: colors.chalk, fontSize: typeScale.display, fontWeight: '700', letterSpacing: -0.8 },
  problem: { color: colors.chalk, fontSize: typeScale.display, fontWeight: '700', letterSpacing: -0.8 },
  detail: { color: colors.muted, fontSize: typeScale.body },
  hint: { color: colors.chalk, fontSize: typeScale.body, borderLeftColor: colors.chalk, borderLeftWidth: 2, paddingLeft: spacing.sm },
  actions: { gap: spacing.sm },
  failure: { gap: spacing.xs, borderLeftColor: colors.error, borderLeftWidth: 2, paddingLeft: spacing.sm },
  failureCopy: { color: colors.chalk, fontSize: typeScale.caption },
})
