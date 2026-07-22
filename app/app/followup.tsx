import { StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { AppButton } from '../src/components/AppButton'
import { AppScreen } from '../src/components/AppScreen'
import { getSession, startFollowUp } from '../src/lib/session'
import { colors, spacing, typeScale } from '../src/ui/theme'

export default function FollowUp() {
  const followUp = getSession().followUp

  if (!followUp) {
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
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{followUp.concept.toUpperCase()}</Text>
        <Text style={styles.problem}>{followUp.problem}</Text>
        <Text style={styles.detail}>Work it out on paper, then snap your solution.</Text>
      </View>
      <AppButton
        label="Check my work"
        onPress={() => { startFollowUp(); router.dismissTo('/') }}
      />
    </AppScreen>
  )
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'space-between', paddingVertical: spacing.xxl },
  emptyContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xxl },
  copy: { gap: spacing.md },
  eyebrow: { color: colors.muted, fontSize: typeScale.caption, fontWeight: '700', letterSpacing: 1.6 },
  title: { color: colors.chalk, fontSize: typeScale.display, fontWeight: '700', letterSpacing: -0.8, lineHeight: 38 },
  problem: { color: colors.chalk, fontSize: typeScale.display, fontWeight: '700', letterSpacing: -0.8, lineHeight: 40 },
  detail: { color: colors.muted, fontSize: typeScale.body, lineHeight: 22 },
})
