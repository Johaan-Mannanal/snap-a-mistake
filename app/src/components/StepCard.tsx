import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Step } from '@snap/shared'
import { colors, spacing } from '../ui/theme'
import { readableStepMath, stepAccessibilityLabel } from '../ui/presentation'

export function StepCard(props: {
  step: Step
  misconceptionLabel: string | null
  explanation: string | null
  expanded: boolean
  selected: boolean
  onPress: () => void
}) {
  const mark = props.step.verdict === 'ok' ? '✓' : props.step.verdict === 'wrong' ? '×' : props.step.verdict === 'suspect' ? '?' : '↓'
  const color = props.step.verdict === 'ok' ? colors.success : props.step.verdict === 'wrong' ? colors.error : colors.muted
  const math = readableStepMath(props.step.latex, props.step.plain)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={stepAccessibilityLabel(props.step, props.misconceptionLabel, props.explanation)}
      accessibilityHint={props.expanded ? 'Double tap to keep this step selected.' : 'Double tap to select and expand this step.'}
      accessibilityState={{ expanded: props.expanded, selected: props.selected }}
      onPress={props.onPress}
      style={({ pressed }) => [styles.row, props.selected && styles.selected, pressed && styles.pressed]}
    >
      <Text style={styles.index}>{String(props.step.index + 1).padStart(2, '0')}</Text>
      <Text style={[styles.mark, { color }]}>{mark}</Text>
      <View style={styles.copy}>
        <Text style={styles.plain}>{props.step.plain}</Text>
        {math ? <Text style={styles.math}>{math}</Text> : null}
        {props.expanded && props.misconceptionLabel ? <Text style={[styles.tag, { color }]}>{props.misconceptionLabel.toUpperCase()}</Text> : null}
        {props.expanded && props.explanation ? <Text style={styles.explanation}>{props.explanation}</Text> : null}
      </View>
    </Pressable>
  )
}

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
  index: { width: 24, color: colors.muted, fontFamily: 'Courier', fontSize: 12, lineHeight: 20 },
  mark: { width: 14, fontSize: 15, fontWeight: '700', lineHeight: 20, textAlign: 'center' },
  copy: { flex: 1, gap: spacing.xs },
  plain: { color: colors.chalk, fontSize: 15, lineHeight: 21 },
  math: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  tag: { marginTop: spacing.sm, fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  explanation: { color: colors.chalk, fontSize: 14, lineHeight: 21 },
})
