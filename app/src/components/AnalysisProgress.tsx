import { Image, StyleSheet, Text, View } from 'react-native'
import { colors, spacing } from '../ui/theme'
import { analysisStagePresentation } from '../ui/presentation'

export function AnalysisProgress(props: { uri: string; stage: number; stages: readonly string[] }) {
  return (
    <View style={styles.root}>
      <Image source={{ uri: props.uri }} resizeMode="cover" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>ANALYZING</Text>
        {props.stages.map((label, index) => {
          const presentation = analysisStagePresentation(label, index, props.stage)
          const markColor = presentation.status === 'completed' ? colors.success : presentation.status === 'current' ? colors.chalk : colors.carbon
          return (
            <View key={label} style={styles.row} accessible accessibilityLabel={presentation.accessibilityLabel}>
              <Text style={[styles.mark, { color: markColor }]}>{presentation.mark}</Text>
              <Text style={[styles.label, { color: presentation.status === 'current' ? colors.chalk : colors.muted }]}>{label}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  scrim: { backgroundColor: 'rgba(0,0,0,0.62)' },
  panel: { position: 'absolute', left: spacing.xl, right: spacing.xl, bottom: 54, gap: spacing.md },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.6, marginBottom: spacing.sm },
  row: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mark: { width: 20, fontSize: 16, textAlign: 'center' },
  label: { fontSize: 16, fontWeight: '600' },
})
