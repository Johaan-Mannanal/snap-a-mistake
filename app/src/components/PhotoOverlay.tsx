import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Step } from '@snap/shared'
import { bandStyle, hasPhotoBand, type ContainedPhotoRect } from '../lib/overlay'
import { colors } from '../ui/theme'

export function PhotoOverlay(props: {
  steps: Step[]
  geometry: ContainedPhotoRect | null
  selectedStepIndex: number | null
  onSelectStep: (index: number) => void
}) {
  if (!props.geometry) return null
  const geometry = props.geometry
  const located = props.steps.filter((step) => (
    hasPhotoBand(step)
    && (step.verdict === 'wrong' || step.verdict === 'suspect' || step.index === props.selectedStepIndex)
  ))
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {located.map((step) => {
          const band = bandStyle(step, geometry.height)
          const selected = step.index === props.selectedStepIndex
          const wrong = step.verdict === 'wrong'
          const color = wrong ? colors.error : colors.chalk
          return (
            <Pressable
              key={step.index}
              accessibilityRole="button"
              accessibilityLabel={`Focus step ${step.index + 1} in the timeline`}
              accessibilityHint="Selects and expands this step."
              accessibilityState={{ selected }}
              hitSlop={10}
              onPress={() => props.onSelectStep(step.index)}
              style={{
                position: 'absolute', left: geometry.left, width: geometry.width,
                top: geometry.top + band.top, height: band.height,
                borderTopWidth: selected ? 2 : 1.5, borderBottomWidth: selected ? 2 : 1.5, borderColor: color,
                backgroundColor: wrong ? 'rgba(255,92,103,0.10)' : 'rgba(245,245,243,0.07)',
              }}
            >
              <Text numberOfLines={1} style={[styles.label, { color, backgroundColor: colors.ink }]}>STEP {step.index + 1}</Text>
            </Pressable>
          )
        })}
    </View>
  )
}

const styles = StyleSheet.create({
  label: { alignSelf: 'flex-end', marginRight: 4, paddingHorizontal: 4, fontSize: 11, fontWeight: '700', lineHeight: 16 },
})
