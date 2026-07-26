import { Pressable, StyleSheet, View } from 'react-native'
import type { Step } from '@snap/shared'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import {
  bandHitTargetStyle,
  hasPhotoBand,
  overlayDecorationMetrics,
  photoOverlayStepPresentation,
  type ContainedPhotoRect,
  type PhotoBand,
} from '../lib/overlay'
import { colors } from '../ui/theme'

export function PhotoOverlay(props: {
  steps: Step[]
  geometry: ContainedPhotoRect | null
  zoomScale: SharedValue<number>
  selectedStepIndex: number | null
  onSelectStep: (index: number) => void
}) {
  if (!props.geometry) return null
  const geometry = props.geometry
  const located = props.steps
    .filter(hasPhotoBand)
    .filter((step) => (
      step.verdict === 'wrong' || step.verdict === 'suspect' || step.index === props.selectedStepIndex
    ))
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {located.map((step) => (
        <OverlayBand
          key={step.index}
          step={step}
          steps={props.steps}
          geometry={geometry}
          zoomScale={props.zoomScale}
          selected={step.index === props.selectedStepIndex}
          onSelectStep={props.onSelectStep}
        />
      ))}
    </View>
  )
}

function OverlayBand(props: {
  step: Step & PhotoBand
  steps: Step[]
  geometry: ContainedPhotoRect
  zoomScale: SharedValue<number>
  selected: boolean
  onSelectStep: (index: number) => void
}) {
  const target = bandHitTargetStyle(props.step, props.geometry.height)
  const wrong = props.step.verdict === 'wrong'
  const color = wrong ? colors.error : colors.chalk
  const presentation = photoOverlayStepPresentation(props.steps, props.step.index)
  const bandDecorationStyle = useAnimatedStyle(() => {
    const metrics = overlayDecorationMetrics(props.zoomScale.value, props.selected)
    return {
      borderTopWidth: metrics.borderWidth,
      borderBottomWidth: metrics.borderWidth,
    }
  }, [props.selected])
  const labelDecorationStyle = useAnimatedStyle(() => {
    const metrics = overlayDecorationMetrics(props.zoomScale.value, props.selected)
    return {
      marginRight: metrics.marginRight,
      paddingHorizontal: metrics.paddingHorizontal,
      fontSize: metrics.fontSize,
      lineHeight: metrics.lineHeight,
    }
  }, [props.selected])

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={presentation.accessibilityLabel}
      accessibilityHint="Selects and expands this step."
      accessibilityState={{ selected: props.selected }}
      onPress={() => props.onSelectStep(props.step.index)}
      style={{
        position: 'absolute', left: props.geometry.left, width: props.geometry.width,
        top: props.geometry.top + target.top, height: target.height,
      }}
    >
      <Animated.View pointerEvents="none" style={[
        styles.visualBand,
        bandDecorationStyle,
        {
          top: target.visualTop,
          height: target.visualHeight,
          borderColor: color,
          backgroundColor: wrong ? 'rgba(255,92,103,0.10)' : 'rgba(245,245,243,0.07)',
        },
      ]}>
        <Animated.Text
          numberOfLines={1}
          style={[styles.label, labelDecorationStyle, { color, backgroundColor: colors.ink }]}
        >
          {presentation.label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  visualBand: { position: 'absolute', left: 0, right: 0 },
  label: { alignSelf: 'flex-end', fontWeight: '700' },
})
