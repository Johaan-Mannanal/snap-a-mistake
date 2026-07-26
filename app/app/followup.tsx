import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { AppButton } from '../src/components/AppButton'
import { AppScreen } from '../src/components/AppScreen'
import { ApiError, requestAlternateFollowUp } from '../src/lib/api'
import {
  buildAlternateFollowUpContext,
  createFollowUpPracticeState,
  createFollowUpCheckFence,
  createFollowUpLeaveLock,
  revealFollowUpHint,
  replaceFollowUpProblem,
  type FollowUpPracticeState,
} from '../src/lib/followUp'
import { getLocalScanRepository } from '../src/lib/history'
import { getSession, startFollowUp } from '../src/lib/session'
import { colors, spacing, typeScale } from '../src/ui/theme'

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
    initialFollowUp ? createFollowUpPracticeState(initialFollowUp) : null
  ))
  const [alternateFailure, setAlternateFailure] = useState<string | null>(null)
  const [requestingAlternate, setRequestingAlternate] = useState(false)
  const [checkingWork, setCheckingWork] = useState(false)
  const [checkFailure, setCheckFailure] = useState<string | null>(null)
  const [isLeaving, setIsLeaving] = useState(false)
  const [leaveFailure, setLeaveFailure] = useState<string | null>(null)
  const alternateRequest = useRef<AbortController | null>(null)
  const checkLock = useRef(false)
  const checkFence = useRef(createFollowUpCheckFence())
  const leaveLock = useRef(createFollowUpLeaveLock())
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const fence = checkFence.current
    return () => {
      mounted.current = false
      alternateRequest.current?.abort()
      void fence.invalidate().catch(() => {})
    }
  }, [])

  const leave = () => {
    alternateRequest.current?.abort()
    const operation = leaveLock.current.run(async () => {
      await checkFence.current.invalidate()
      if (mounted.current) router.back()
    })
    if (!operation.started) return
    setIsLeaving(true)
    setLeaveFailure(null)
    void operation.promise.then(
      () => { if (mounted.current) setIsLeaving(false) },
      () => {
        if (mounted.current) {
          setIsLeaving(false)
          setLeaveFailure('We couldn’t safely leave this practice attempt. Try Back again.')
        }
      },
    )
  }

  const requestAnother = () => {
    if (practice === null || alternateRequest.current !== null) return
    const controller = new AbortController()
    alternateRequest.current = controller
    setRequestingAlternate(true)
    setAlternateFailure(null)
    void (async () => {
      try {
        const diagnosis = await diagnosisForParent()
        const alternate = await requestAlternateFollowUp(buildAlternateFollowUpContext(practice, diagnosis), { signal: controller.signal })
        if (alternateRequest.current !== controller) return
        const replacement = replaceFollowUpProblem(practice, alternate)
        if (replacement === null) {
          setAlternateFailure('That problem was too similar. Try another similar problem.')
          return
        }
        setPractice(replacement)
      } catch (error) {
        if (alternateRequest.current !== controller || (error instanceof ApiError && error.failure.kind === 'cancelled')) return
        setAlternateFailure('We couldn’t get another problem. Your current problem is still here.')
      } finally {
        if (alternateRequest.current === controller) {
          alternateRequest.current = null
          setRequestingAlternate(false)
        }
      }
    })()
  }

  const checkWork = () => {
    if (practice === null || checkLock.current) return
    const parentScanId = currentParentId()
    if (parentScanId === null) {
      setAlternateFailure('This practice problem is no longer linked to its analysis. Go back and choose it again.')
      return
    }
    checkLock.current = true
    alternateRequest.current?.abort()
    setCheckingWork(true)
    setCheckFailure(null)
    setAlternateFailure(null)
    const run = checkFence.current.begin()
    const owns = () => mounted.current && checkFence.current.owns(run)
    const task = (async () => {
      try {
        if (!owns()) return
        const persisted = await startFollowUp(parentScanId, practice.followUp, { isCurrent: owns })
        if (!persisted || !owns()) return
        router.dismissTo('/')
      } catch (error) {
        if (owns()) setCheckFailure('We couldn’t prepare your follow-up attempt. Your problem is still here; try again.')
        throw error
      } finally {
        if (checkFence.current.owns(run)) {
          checkLock.current = false
          setCheckingWork(false)
        }
      }
    })()
    checkFence.current.track(run, task)
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
        {!practice.hintVisible ? <AppButton label="Show a hint" onPress={() => setPractice(revealFollowUpHint(practice))} variant="secondary" /> : null}
        <AppButton label={requestingAlternate ? 'Finding another problem…' : 'Try another similar problem'} onPress={requestAnother} disabled={requestingAlternate} variant="secondary" />
        {alternateFailure ? (
          <View style={styles.failure}>
            <Text accessibilityRole="alert" style={styles.failureCopy}>{alternateFailure}</Text>
            {!checkingWork ? <AppButton label="Retry another problem" onPress={requestAnother} disabled={requestingAlternate} variant="tertiary" /> : null}
          </View>
        ) : null}
        {checkFailure ? (
          <View style={styles.failure}>
            <Text accessibilityRole="alert" style={styles.failureCopy}>{checkFailure}</Text>
            <AppButton label="Try checking my work again" onPress={checkWork} disabled={checkingWork} variant="tertiary" />
          </View>
        ) : null}
        <AppButton label={checkingWork ? 'Preparing camera…' : 'Check my work'} onPress={checkWork} disabled={checkingWork} />
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
