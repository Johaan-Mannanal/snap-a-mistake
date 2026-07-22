import { StyleSheet, View } from 'react-native'
import { colors } from '../ui/theme'

export function CameraCorners() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.corner, styles.topLeft]} />
      <View style={[styles.corner, styles.topRight]} />
      <View style={[styles.corner, styles.bottomLeft]} />
      <View style={[styles.corner, styles.bottomRight]} />
    </View>
  )
}

const base = { position: 'absolute' as const, width: 26, height: 26, borderColor: colors.chalk, opacity: 0.72 }
const styles = StyleSheet.create({
  corner: base,
  topLeft: { left: 42, top: 104, borderLeftWidth: 1.5, borderTopWidth: 1.5 },
  topRight: { right: 42, top: 104, borderRightWidth: 1.5, borderTopWidth: 1.5 },
  bottomLeft: { left: 42, bottom: 126, borderLeftWidth: 1.5, borderBottomWidth: 1.5 },
  bottomRight: { right: 42, bottom: 126, borderRightWidth: 1.5, borderBottomWidth: 1.5 },
})
