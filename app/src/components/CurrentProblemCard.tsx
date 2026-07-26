import { useState } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native'
import type { FollowUp } from '@snap/shared'
import { colors, spacing, typeScale } from '../ui/theme'

export function CurrentProblemCard({ followUp }: { followUp: FollowUp }) {
  const [expanded, setExpanded] = useState(false)

  const toggle = () => {
    const next = !expanded
    setExpanded(next)
    if (next) AccessibilityInfo.announceForAccessibility(`Current problem. ${followUp.problem}. Hint: ${followUp.hint}`)
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Current problem"
        accessibilityHint={expanded ? 'Hides the current practice problem.' : 'Shows the current practice problem and hint.'}
        accessibilityState={{ expanded }}
        onPress={toggle}
        style={styles.trigger}
      >
        <Text style={styles.label}>CURRENT PROBLEM</Text>
        <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
      </Pressable>
      {expanded ? (
        <View style={styles.detail}>
          <Text style={styles.problem}>{followUp.problem}</Text>
          <Text style={styles.hint}>Hint: {followUp.hint}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.chalk },
  trigger: { minHeight: 44, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.chalk, fontSize: typeScale.caption, fontWeight: '700', letterSpacing: 1.3 },
  chevron: { color: colors.chalk, fontSize: typeScale.body, fontWeight: '700' },
  detail: { borderTopWidth: 1, borderTopColor: colors.graphite, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  problem: { color: colors.chalk, fontSize: typeScale.body, fontWeight: '700', lineHeight: 22 },
  hint: { color: colors.muted, fontSize: typeScale.caption, lineHeight: 18 },
})
