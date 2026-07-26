import { forwardRef } from 'react'
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import type { Step } from '@snap/shared'
import { colors, spacing } from '../ui/theme'
import { stepCardPresentation } from '../ui/presentation'

export const StepCard = forwardRef<View, {
  step: Step
  ordinal: number
  misconceptionLabel: string | null
  explanation: string | null
  expanded: boolean
  selected: boolean
  onPress: () => void
  onLayout?: (event: LayoutChangeEvent) => void
}>(function StepCard(props, ref) {
  const mark = props.step.verdict === 'ok' ? '✓' : props.step.verdict === 'wrong' ? '×' : props.step.verdict === 'suspect' ? '?' : '↓'
  const color = props.step.verdict === 'ok' ? colors.success : props.step.verdict === 'wrong' ? colors.error : colors.muted
  const presentation = stepCardPresentation(props.step, props)
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={presentation.accessibilityLabel}
      accessibilityHint={presentation.accessibilityHint ?? undefined}
      accessibilityState={presentation.accessibilityState}
      accessibilityActions={presentation.accessibilityAction ? [presentation.accessibilityAction] : undefined}
      onAccessibilityAction={props.onPress}
      onLayout={props.onLayout}
      onPress={props.onPress}
      style={({ pressed }) => [styles.row, props.selected && styles.selected, pressed && styles.pressed]}
    >
      <Text style={styles.index}>{String(props.ordinal).padStart(2, '0')}</Text>
      <Text style={[styles.mark, { color }]}>{mark}</Text>
      <View style={styles.copy}>
        <Text style={styles.plain}>{props.step.plain}</Text>
        {presentation.math ? <Text style={styles.math}>{presentation.math}</Text> : null}
        {presentation.misconceptionLabel ? <Text style={[styles.tag, { color }]}>{presentation.misconceptionLabel.toUpperCase()}</Text> : null}
        {presentation.explanation ? <Text style={styles.explanation}>{presentation.explanation}</Text> : null}
      </View>
    </Pressable>
  )
})

const styles = StyleSheet.create({
  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.carbon,
  },
  selected: { backgroundColor: colors.graphite },
  pressed: { opacity: 0.68 },
  index: { width: 24, color: colors.muted, fontFamily: 'Courier', fontSize: 12 },
  mark: { width: 14, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  copy: { flex: 1, gap: spacing.xs },
  plain: { color: colors.chalk, fontSize: 15 },
  math: { color: colors.muted, fontSize: 13 },
  tag: { marginTop: spacing.sm, fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  explanation: { color: colors.chalk, fontSize: 14 },
})
