import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import { colors, spacing } from '../ui/theme'
import { containedPhotoRect, type ContainedPhotoRect } from '../lib/overlay'
import { clampPhotoScale, clampPhotoTranslation, normalizeLoadedImageSize, photoTransform } from './zoomMath'

const MIN_SCALE = 1
const MAX_SCALE = 4

export function ZoomablePhoto(props: {
  uri: string
  renderOverlay?: (geometry: ContainedPhotoRect | null, zoomScale: SharedValue<number>) => ReactNode
}) {
  const scale = useSharedValue(MIN_SCALE)
  const scaleAtGestureStart = useSharedValue(MIN_SCALE)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const frameWidth = useSharedValue(0)
  const frameHeight = useSharedValue(0)
  const imageWidth = useSharedValue(0)
  const imageHeight = useSharedValue(0)
  const [zoomLevel, setZoomLevel] = useState(MIN_SCALE)
  const [reduceMotion, setReduceMotion] = useState(false)
  const reduceMotionRef = useRef(false)
  const [frame, setFrame] = useState({ width: 0, height: 0 })
  const [loadedImage, setLoadedImage] = useState({ uri: props.uri, width: 0, height: 0 })
  const imageSize = loadedImage.uri === props.uri
    ? loadedImage
    : { width: 0, height: 0 }

  useEffect(() => {
    const updateReduceMotion = (enabled: boolean) => {
      reduceMotionRef.current = enabled
      setReduceMotion(enabled)
    }
    void AccessibilityInfo.isReduceMotionEnabled().then(updateReduceMotion)
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', updateReduceMotion)
    return () => subscription.remove()
  }, [])

  const applyImageSize = useCallback((source: { uri: string; width: number; height: number }) => {
    const next = normalizeLoadedImageSize(props.uri, source)
    if (next === null) return
    imageWidth.value = next.width
    imageHeight.value = next.height
    setLoadedImage({ uri: props.uri, ...next })
    const translation = clampPhotoTranslation({
      x: translateX.value, y: translateY.value,
      frameWidth: frameWidth.value, frameHeight: frameHeight.value,
      imageWidth: next.width, imageHeight: next.height, scale: scale.value,
    })
    translateX.value = withTiming(translation.x, { duration: reduceMotionRef.current ? 0 : 160 })
    translateY.value = withTiming(translation.y, { duration: reduceMotionRef.current ? 0 : 160 })
  }, [frameHeight, frameWidth, imageHeight, imageWidth, props.uri, scale, translateX, translateY])

  useEffect(() => {
    let active = true
    imageWidth.value = 0
    imageHeight.value = 0
    Image.getSize(props.uri, (width, height) => {
      if (!active) return
      applyImageSize({ uri: props.uri, width, height })
    }, () => {})
    return () => { active = false }
  }, [applyImageSize, imageHeight, imageWidth, props.uri])

  const setScale = (nextScale: number) => {
    const clamped = clampPhotoScale(nextScale)
    scale.value = withTiming(clamped, { duration: reduceMotion ? 0 : 160 })
    const translation = clampPhotoTranslation({
      x: translateX.value, y: translateY.value,
      frameWidth: frameWidth.value, frameHeight: frameHeight.value,
      imageWidth: imageWidth.value, imageHeight: imageHeight.value, scale: clamped,
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
      const nextScale = clampPhotoScale(scaleAtGestureStart.value * event.scale)
      scale.value = nextScale
      const translation = clampPhotoTranslation({
        x: translateX.value, y: translateY.value,
        frameWidth: frameWidth.value, frameHeight: frameHeight.value,
        imageWidth: imageWidth.value, imageHeight: imageHeight.value, scale: nextScale,
      })
      translateX.value = translation.x
      translateY.value = translation.y
    })
    .onEnd(() => {
      const nextScale = clampPhotoScale(scale.value)
      scale.value = withTiming(nextScale, { duration: reduceMotion ? 0 : 160 })
      const translation = clampPhotoTranslation({
        x: translateX.value, y: translateY.value,
        frameWidth: frameWidth.value, frameHeight: frameHeight.value,
        imageWidth: imageWidth.value, imageHeight: imageHeight.value, scale: nextScale,
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
        frameWidth: frameWidth.value,
        frameHeight: frameHeight.value,
        imageWidth: imageWidth.value,
        imageHeight: imageHeight.value,
        scale: scale.value,
      })
      translateX.value = translation.x
      translateY.value = translation.y
    }
  })

  const animatedPhotoStyle = useAnimatedStyle(() => ({
    transform: photoTransform({ x: translateX.value, y: translateY.value, scale: scale.value }),
  }))

  const geometry = containedPhotoRect({
    frameWidth: frame.width,
    frameHeight: frame.height,
    imageWidth: imageSize.width,
    imageHeight: imageSize.height,
  })

  return (
    <View>
      <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
        <View
          onLayout={(event) => {
            frameWidth.value = event.nativeEvent.layout.width
            frameHeight.value = event.nativeEvent.layout.height
            setFrame({ width: frameWidth.value, height: frameHeight.value })
            const translation = clampPhotoTranslation({
              x: translateX.value, y: translateY.value,
              frameWidth: frameWidth.value, frameHeight: frameHeight.value,
              imageWidth: imageWidth.value, imageHeight: imageHeight.value, scale: scale.value,
            })
            translateX.value = withTiming(translation.x, { duration: reduceMotion ? 0 : 160 })
            translateY.value = withTiming(translation.y, { duration: reduceMotion ? 0 : 160 })
          }}
          style={styles.frame}
        >
          <Animated.View style={[styles.photoWrap, animatedPhotoStyle]}>
            <Image
              accessible
              accessibilityLabel={`Selected photo. Zoom ${Math.round(zoomLevel * 100)} percent.`}
              onLoad={(event) => {
                applyImageSize(event.nativeEvent.source)
              }}
              source={{ uri: props.uri }}
              resizeMode="contain"
              style={styles.photo}
            />
            {props.renderOverlay?.(geometry, scale)}
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
  photoWrap: { width: '100%', height: '100%', position: 'relative', alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: '100%' },
  zoomControls: { minHeight: 44, marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  zoomButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.carbon },
  zoomDisabled: { opacity: 0.4 },
  zoomLabel: { color: colors.chalk, fontSize: 22, lineHeight: 24 },
  zoomValue: { minWidth: 50, color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  resetButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  resetLabel: { color: colors.chalk, fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
})
