import { useState } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native'
import type { FollowUp } from '@snap/shared'
import { currentProblemCardPresentation } from '../ui/presentation'
import { colors, spacing, typeScale } from '../ui/theme'

export function CurrentProblemCard({ followUp, hintVisible }: { followUp: FollowUp; hintVisible: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const presentation = currentProblemCardPresentation(followUp, hintVisible, expanded)

  const toggle = () => {
    const next = !expanded
    setExpanded(next)
    const announcement = currentProblemCardPresentation(followUp, hintVisible, next).announcement
    if (announcement !== null) AccessibilityInfo.announceForAccessibility(announcement)
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Current problem"
        accessibilityHint={presentation.accessibilityHint}
        accessibilityState={{ expanded }}
        onPress={toggle}
        style={styles.trigger}
      >
        <Text style={styles.label}>CURRENT PROBLEM</Text>
        <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
      </Pressable>
      {expanded ? (
        <View style={styles.detail}>
          <Text style={styles.concept}>{presentation.concept.toUpperCase()}</Text>
          <Text style={styles.problem}>{presentation.problem}</Text>
          {presentation.hint === null ? null : <Text style={styles.hint}>Hint: {presentation.hint}</Text>}
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
  concept: { color: colors.muted, fontSize: typeScale.caption, fontWeight: '700', letterSpacing: 1.2 },
  problem: { color: colors.chalk, fontSize: typeScale.body, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: typeScale.caption },
})
