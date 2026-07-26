import { useEffect, useRef, useState, type RefObject } from 'react'
import { AccessibilityInfo, findNodeHandle, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, radii, spacing } from '../ui/theme'
import { AppButton } from './AppButton'

export function ConfirmAction(props: {
  visible: boolean
  title: string
  copy: string
  confirmLabel: string
  busy?: boolean
  restoreFocusRef?: RefObject<View | null>
  onConfirm: () => Promise<void> | void
  onCancel: () => void
}) {
  const titleRef = useRef<View | null>(null)
  const confirming = useRef(false)
  const [localBusy, setLocalBusy] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const busy = props.busy || localBusy

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    if (!props.visible) return
    AccessibilityInfo.announceForAccessibility(props.title)
    requestAnimationFrame(() => {
      const node = findNodeHandle(titleRef.current)
      if (node !== null) AccessibilityInfo.setAccessibilityFocus(node)
    })
  }, [props.title, props.visible])

  const cancel = () => {
    if (busy) return
    props.onCancel()
    requestAnimationFrame(() => {
      const node = findNodeHandle(props.restoreFocusRef?.current ?? null)
      if (node !== null) AccessibilityInfo.setAccessibilityFocus(node)
    })
  }

  const confirm = () => {
    if (confirming.current || busy) return
    confirming.current = true
    setLocalBusy(true)
    void Promise.resolve(props.onConfirm()).finally(() => {
      confirming.current = false
      setLocalBusy(false)
    })
  }

  return (
    <Modal visible={props.visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={cancel}>
      <SafeAreaView edges={['bottom']} style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
            <View ref={titleRef} accessible accessibilityRole="header">
              <Text style={styles.eyebrow}>PERMANENT ACTION</Text>
              <Text style={styles.title}>{props.title}</Text>
            </View>
            <Text style={styles.copy}>{props.copy}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={props.confirmLabel}
              accessibilityHint="This action cannot be undone."
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={confirm}
              style={({ pressed }) => [styles.destructive, (pressed || busy) && styles.dimmed]}
            >
              <Text style={styles.destructiveLabel}>{busy ? 'Working…' : props.confirmLabel}</Text>
            </Pressable>
            <AppButton label="Cancel" disabled={busy} onPress={cancel} variant="secondary" />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.72)' },
  sheet: { maxHeight: '92%', backgroundColor: colors.graphite, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  content: { gap: spacing.md, padding: spacing.xl, paddingBottom: spacing.xxl },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  title: { color: colors.chalk, fontSize: 24, fontWeight: '700', lineHeight: 30, marginTop: spacing.xs },
  copy: { color: colors.chalk, fontSize: 16, lineHeight: 24 },
  destructive: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, backgroundColor: colors.error, paddingHorizontal: 18 },
  destructiveLabel: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  dimmed: { opacity: 0.68 },
})
