import { useMemo } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../ui/theme'

const MIN_MARGIN = 24
const DEFAULT_TOP_CONTROLS = 56
const DEFAULT_BOTTOM_CONTROLS = 92

export function CameraCorners(props: { topControlsHeight?: number; bottomControlsHeight?: number }) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const frame = useMemo(() => {
    const side = Math.max(MIN_MARGIN, Math.min(42, width * 0.1))
    const top = Math.max(MIN_MARGIN, insets.top + (props.topControlsHeight ?? DEFAULT_TOP_CONTROLS) + MIN_MARGIN)
    const bottom = Math.max(MIN_MARGIN, insets.bottom + (props.bottomControlsHeight ?? DEFAULT_BOTTOM_CONTROLS) + MIN_MARGIN)
    const frameBottom = Math.max(top, height - bottom)
    return { left: side, right: side, top, bottom: Math.max(0, height - frameBottom) }
  }, [height, insets.bottom, insets.top, props.bottomControlsHeight, props.topControlsHeight, width])

  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.corner, { left: frame.left, top: frame.top }, styles.topLeft]} />
      <View style={[styles.corner, { right: frame.right, top: frame.top }, styles.topRight]} />
      <View style={[styles.corner, { left: frame.left, bottom: frame.bottom }, styles.bottomLeft]} />
      <View style={[styles.corner, { right: frame.right, bottom: frame.bottom }, styles.bottomRight]} />
    </View>
  )
}

const base = { position: 'absolute' as const, width: 26, height: 26, borderColor: colors.chalk, opacity: 0.72 }
const styles = StyleSheet.create({
  corner: base,
  topLeft: { borderLeftWidth: 1.5, borderTopWidth: 1.5 },
  topRight: { borderRightWidth: 1.5, borderTopWidth: 1.5 },
  bottomLeft: { borderLeftWidth: 1.5, borderBottomWidth: 1.5 },
  bottomRight: { borderRightWidth: 1.5, borderBottomWidth: 1.5 },
})
