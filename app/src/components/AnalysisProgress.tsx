import { useEffect, useMemo, useRef } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { announce } from '../lib/feedback.native'
import { colors, spacing } from '../ui/theme'
import { analysisProgressPresentation } from '../ui/presentation'

export function AnalysisProgress(props: { uri: string; elapsedSeconds: number; descriptionIndex: number; onCancel: () => void }) {
  const presentation = analysisProgressPresentation(props.elapsedSeconds, props.descriptionIndex)
  const announced = useRef(new Set<string>())
  const insets = useSafeAreaInsets()
  const panelStyle = useMemo(() => ({ bottom: Math.max(24, insets.bottom + 24) }), [insets.bottom])

  useEffect(() => {
    if (props.elapsedSeconds < 20 || announced.current.has('long-wait')) return
    announced.current.add('long-wait')
    announce(presentation.elapsedCopy)
  }, [presentation.elapsedCopy, props.elapsedSeconds])

  return (
    <View style={styles.root}>
      <Image accessible={false} source={{ uri: props.uri }} resizeMode="cover" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />
      <View style={[styles.panel, panelStyle]}>
        <Text style={styles.eyebrow}>ANALYZING</Text>
        <Text style={styles.description}>{presentation.description}</Text>
        <Text accessibilityLiveRegion="polite" style={styles.elapsedCopy}>{presentation.elapsedCopy}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel analysis and return to review"
          onPress={props.onCancel}
          style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
        >
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  scrim: { backgroundColor: 'rgba(0,0,0,0.62)' },
  panel: { position: 'absolute', left: spacing.xl, right: spacing.xl, gap: spacing.md },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.6, marginBottom: spacing.sm },
  description: { color: colors.chalk, fontSize: 22, fontWeight: '700' },
  elapsedCopy: { color: colors.muted, fontSize: 15 },
  cancel: { alignSelf: 'flex-start', minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, marginTop: spacing.xs },
  cancelLabel: { color: colors.chalk, fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
  pressed: { opacity: 0.5 },
})
