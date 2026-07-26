import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, findNodeHandle, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import type { AnalyzeResponse } from '@snap/shared'
import type { ApiFailure } from '../lib/api'
import { correctionFailurePresentation, correctionStepOptions } from '../ui/diagnosisFeedback'
import { colors, radii, spacing } from '../ui/theme'
import { AppButton } from './AppButton'

type AnalysisResponse = Extract<AnalyzeResponse, { kind: 'analysis' }>

export function DiagnosisFeedback(props: {
  response: AnalysisResponse
  busy: boolean
  failure: ApiFailure | null
  onAccept: () => void
  onCorrectStep: (index: number) => void
  onAllCorrect: () => void
  onNotCaptured: () => void
  onRetry: () => void
  onCancelRequest: () => void
  reduceMotion: boolean
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<View | null>(null)
  const titleRef = useRef<View | null>(null)
  const dismiss = () => {
    setOpen(false)
    requestAnimationFrame(() => {
      const node = findNodeHandle(triggerRef.current)
      if (node !== null) AccessibilityInfo.setAccessibilityFocus(node)
    })
  }

  useEffect(() => {
    if (!open) return
    const title = 'Choose the step that needs a second look'
    AccessibilityInfo.announceForAccessibility(title)
    requestAnimationFrame(() => {
      const node = findNodeHandle(titleRef.current)
      if (node !== null) AccessibilityInfo.setAccessibilityFocus(node)
    })
  }, [open])

  return (
    <View style={styles.root}>
      <Text style={styles.question}>Does this diagnosis match your work?</Text>
      <View style={styles.actions}>
        <AppButton label="Yes, that’s right" onPress={props.onAccept} disabled={props.busy} />
        <Pressable
          ref={triggerRef}
          accessibilityRole="button"
          accessibilityLabel="Not quite"
          accessibilityHint="Choose the step that needs a second look."
          accessibilityState={{ disabled: props.busy, expanded: open }}
          disabled={props.busy}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.notQuite, pressed && styles.pressed]}
        >
          <Text style={styles.notQuiteText}>Not quite</Text>
        </Pressable>
      </View>
      {props.busy ? <AppButton label="Cancel correction" onPress={props.onCancelRequest} variant="tertiary" /> : null}
      {props.failure ? <FeedbackFailure failure={props.failure} onRetry={props.onRetry} onCancel={props.onCancelRequest} /> : null}
      <Modal visible={open} transparent animationType={props.reduceMotion ? 'none' : 'slide'} onRequestClose={dismiss}>
        <View style={styles.backdrop}>
          <View accessibilityViewIsModal style={styles.sheet}>
            <View ref={titleRef} accessible accessibilityRole="header">
              <Text style={styles.eyebrow}>SECOND LOOK</Text>
              <Text style={styles.title}>Choose the step that needs a second look</Text>
            </View>
            <View accessibilityRole="list" style={styles.list}>
              {correctionStepOptions(props.response).map((step) => (
                <Pressable
                  key={step.index}
                  accessibilityRole="button"
                  accessibilityLabel={step.label}
                  disabled={props.busy}
                  onPress={() => { dismiss(); props.onCorrectStep(step.index) }}
                  style={({ pressed }) => [styles.step, pressed && styles.pressed]}
                >
                  <Text style={styles.stepText}>{step.label}</Text>
                </Pressable>
              ))}
            </View>
            <AppButton label="All steps are correct" onPress={() => { dismiss(); props.onAllCorrect() }} disabled={props.busy} variant="secondary" />
            <AppButton label="The relevant step wasn’t captured" onPress={() => { dismiss(); props.onNotCaptured() }} disabled={props.busy} variant="tertiary" />
            <AppButton label="Cancel" onPress={dismiss} disabled={props.busy} variant="tertiary" />
          </View>
        </View>
      </Modal>
    </View>
  )
}

function FeedbackFailure({ failure, onRetry, onCancel }: { failure: ApiFailure; onRetry: () => void; onCancel: () => void }) {
  const presentation = correctionFailurePresentation(failure)
  return (
    <View style={styles.failure} accessibilityRole="alert">
      <Text style={styles.failureTitle}>{presentation.title}</Text>
      <Text style={styles.failureDetail}>{presentation.detail}</Text>
      <AppButton label={presentation.retryLabel} onPress={onRetry} variant="secondary" />
      <AppButton label={presentation.cancelLabel} onPress={onCancel} variant="tertiary" />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm, paddingVertical: spacing.md, borderTopWidth: 1, borderColor: colors.carbon },
  question: { color: colors.chalk, fontSize: 17, fontWeight: '700', lineHeight: 24 },
  actions: { gap: spacing.sm },
  notQuite: { minHeight: 52, borderWidth: 1, borderRadius: radii.md, borderColor: colors.carbon, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  notQuiteText: { color: colors.chalk, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.72)' },
  sheet: { gap: spacing.md, backgroundColor: colors.graphite, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.xl },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  title: { color: colors.chalk, fontSize: 24, fontWeight: '700', lineHeight: 30, marginTop: spacing.xs },
  list: { gap: spacing.xs },
  step: { minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.carbon, borderRadius: radii.sm },
  stepText: { color: colors.chalk, fontSize: 16, lineHeight: 23 },
  failure: { gap: spacing.sm, paddingTop: spacing.sm },
  failureTitle: { color: colors.error, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  failureDetail: { color: colors.muted, fontSize: 15, lineHeight: 22 },
})
