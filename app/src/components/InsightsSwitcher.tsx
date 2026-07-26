import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing, typeScale } from '../ui/theme'

export type InsightsSection = 'patterns' | 'scans'

export function InsightsSwitcher(props: { section: InsightsSection; onChange: (section: InsightsSection) => void }) {
  return (
    <View accessibilityRole="tablist" style={styles.switcher}>
      <SectionButton label="Patterns" targetSection="patterns" {...props} />
      <SectionButton label="Previous scans" targetSection="scans" {...props} />
    </View>
  )
}

function SectionButton(props: { label: string; targetSection: InsightsSection; section: InsightsSection; onChange: (section: InsightsSection) => void }) {
  const selected = props.targetSection === props.section
  return (
    <Pressable
      accessibilityLabel={props.label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => props.onChange(props.targetSection)}
      style={({ pressed }) => [styles.button, selected && styles.selected, { opacity: pressed ? 0.72 : 1 }]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{props.label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  switcher: { flexDirection: 'row', gap: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.carbon, paddingBottom: spacing.sm },
  button: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm, paddingHorizontal: spacing.sm },
  selected: { backgroundColor: colors.chalk },
  label: { color: colors.muted, fontSize: typeScale.body, fontWeight: '700' },
  selectedLabel: { color: colors.ink },
})
