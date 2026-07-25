import { useEffect, useState } from 'react'
import { AccessibilityInfo, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { colors, spacing } from '../ui/theme'
import { clampPhotoTranslation } from './zoomMath'

const MIN_SCALE = 1
const MAX_SCALE = 4

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

export function ZoomablePhoto({ uri }: { uri: string }) {
  const scale = useSharedValue(MIN_SCALE)
  const scaleAtGestureStart = useSharedValue(MIN_SCALE)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const frameWidth = useSharedValue(0)
  const frameHeight = useSharedValue(0)
  const [zoomLevel, setZoomLevel] = useState(MIN_SCALE)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => subscription.remove()
  }, [])

  const setScale = (nextScale: number) => {
    const clamped = clampScale(nextScale)
    scale.value = withTiming(clamped, { duration: reduceMotion ? 0 : 160 })
    const translation = clampPhotoTranslation({
      x: translateX.value, y: translateY.value, width: frameWidth.value, height: frameHeight.value, scale: clamped,
    })
    translateX.value = withTiming(translation.x, { duration: reduceMotion ? 0 : 160 })
    translateY.value = withTiming(translation.y, { duration: reduceMotion ? 0 : 160 })
    setZoomLevel(clamped)
  }

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      scaleAtGestureStart.value = scale.value
    })
    .onUpdate((event) => {
      const nextScale = clampScale(scaleAtGestureStart.value * event.scale)
      scale.value = nextScale
      const translation = clampPhotoTranslation({
        x: translateX.value, y: translateY.value, width: frameWidth.value, height: frameHeight.value, scale: nextScale,
      })
      translateX.value = translation.x
      translateY.value = translation.y
    })
    .onEnd(() => {
      const nextScale = clampScale(scale.value)
      scale.value = withTiming(nextScale, { duration: reduceMotion ? 0 : 160 })
      const translation = clampPhotoTranslation({
        x: translateX.value, y: translateY.value, width: frameWidth.value, height: frameHeight.value, scale: nextScale,
      })
      translateX.value = withTiming(translation.x, { duration: reduceMotion ? 0 : 160 })
      translateY.value = withTiming(translation.y, { duration: reduceMotion ? 0 : 160 })
      runOnJS(setZoomLevel)(nextScale)
    })

  const pan = Gesture.Pan().onChange((event) => {
    if (scale.value > MIN_SCALE) {
      const translation = clampPhotoTranslation({
        x: translateX.value + event.changeX,
        y: translateY.value + event.changeY,
        width: frameWidth.value,
        height: frameHeight.value,
        scale: scale.value,
      })
      translateX.value = translation.x
      translateY.value = translation.y
    }
  })

  const animatedPhotoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  return (
    <View>
      <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
        <View
          accessible
          accessibilityLabel={`Selected photo. Zoom ${Math.round(zoomLevel * 100)} percent.`}
          onLayout={(event) => {
            frameWidth.value = event.nativeEvent.layout.width
            frameHeight.value = event.nativeEvent.layout.height
          }}
          style={styles.frame}
        >
          <Animated.View style={[styles.photoWrap, animatedPhotoStyle]}>
            <Image source={{ uri }} resizeMode="contain" style={styles.photo} />
          </Animated.View>
        </View>
      </GestureDetector>
      <View accessibilityRole="toolbar" accessibilityLabel="Photo zoom controls" style={styles.zoomControls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Zoom out photo" disabled={zoomLevel <= MIN_SCALE} onPress={() => setScale(zoomLevel - 1)} style={[styles.zoomButton, zoomLevel <= MIN_SCALE && styles.zoomDisabled]}>
          <Text style={styles.zoomLabel}>−</Text>
        </Pressable>
        <Text accessibilityLiveRegion="polite" style={styles.zoomValue}>{Math.round(zoomLevel * 100)}%</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Zoom in photo" disabled={zoomLevel >= MAX_SCALE} onPress={() => setScale(zoomLevel + 1)} style={[styles.zoomButton, zoomLevel >= MAX_SCALE && styles.zoomDisabled]}>
          <Text style={styles.zoomLabel}>+</Text>
        </Pressable>
        {zoomLevel > MIN_SCALE ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Reset photo zoom" onPress={() => setScale(MIN_SCALE)} style={styles.resetButton}>
            <Text style={styles.resetLabel}>Reset</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { height: 340, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.graphite, borderWidth: 1, borderColor: colors.carbon },
  photoWrap: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: '100%' },
  zoomControls: { minHeight: 44, marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  zoomButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.carbon },
  zoomDisabled: { opacity: 0.4 },
  zoomLabel: { color: colors.chalk, fontSize: 22, lineHeight: 24 },
  zoomValue: { minWidth: 50, color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  resetButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  resetLabel: { color: colors.chalk, fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
})
