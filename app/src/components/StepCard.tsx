import { StyleSheet, Text, View } from 'react-native'
import type { Step } from '@snap/shared'
import { colors, spacing } from '../ui/theme'
import { stepAccessibilityLabel } from '../ui/presentation'

export function StepCard(props: { step: Step; misconceptionLabel: string | null; explanation: string | null }) {
  const expanded = props.step.verdict === 'wrong' || props.step.verdict === 'suspect'
  const mark = props.step.verdict === 'ok' ? '✓' : props.step.verdict === 'wrong' ? '×' : props.step.verdict === 'suspect' ? '?' : '↓'
  const color = props.step.verdict === 'ok' ? colors.success : props.step.verdict === 'wrong' ? colors.error : colors.muted
  return (
    <View style={styles.row} accessible accessibilityLabel={stepAccessibilityLabel(props.step, props.misconceptionLabel, props.explanation)}>
      <Text style={styles.index}>{String(props.step.index + 1).padStart(2, '0')}</Text>
      <Text style={[styles.mark, { color }]}>{mark}</Text>
      <View style={styles.copy}>
        <Text style={styles.plain}>{props.step.plain}</Text>
        <Text style={styles.latex}>{props.step.latex}</Text>
        {expanded && props.misconceptionLabel ? <Text style={[styles.tag, { color }]}>{props.misconceptionLabel.toUpperCase()}</Text> : null}
        {expanded && props.explanation ? <Text style={styles.explanation}>{props.explanation}</Text> : null}
      </View>
    </View>
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
  index: { width: 24, color: colors.muted, fontFamily: 'Courier', fontSize: 12, lineHeight: 20 },
  mark: { width: 14, fontSize: 15, fontWeight: '700', lineHeight: 20, textAlign: 'center' },
  copy: { flex: 1, gap: spacing.xs },
  plain: { color: colors.chalk, fontSize: 15, lineHeight: 21 },
  latex: { color: colors.muted, fontFamily: 'Courier', fontSize: 12, lineHeight: 18 },
  tag: { marginTop: spacing.sm, fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  explanation: { color: colors.chalk, fontSize: 14, lineHeight: 21 },
})
