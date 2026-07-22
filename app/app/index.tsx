import { useRef, useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppButton } from '../src/components/AppButton'
import { CameraCorners } from '../src/components/CameraCorners'
import { AppIcon } from '../src/components/AppIcon'
import { capturePhoto, type CaptureLock } from '../src/lib/cameraCapture'
import { getSession, setPhoto } from '../src/lib/session'
import { cameraPermissionPresentation, cameraPresentation } from '../src/ui/presentation'
import { colors, spacing, typeScale } from '../src/ui/theme'

export default function Home() {
  const camera = useRef<CameraView>(null)
  const captureLock = useRef<CaptureLock>({ current: false })
  const [permission, requestPermission] = useCameraPermissions()
  const [cameraReady, setCameraReady] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const isRetry = getSession().isRetry
  const presentation = cameraPresentation(isRetry)

  const usePhoto = (uri: string) => {
    setPhoto(uri)
    router.push('/analyze')
  }

  const snap = () => {
    void capturePhoto({
      camera: camera.current,
      ready: cameraReady,
      lock: captureLock.current,
      onPhoto: usePhoto,
      onError: setCaptureError,
      onBusyChange: (busy) => {
        setIsCapturing(busy)
        if (busy) setCaptureError(null)
      },
    })
  }

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })
    const uri = res.assets?.[0]?.uri
    if (uri) usePhoto(uri)
  }

  if (!permission?.granted) {
    const permissionPresentation = cameraPermissionPresentation(permission)
    const primaryAction = permissionPresentation.state === 'blocked' ? Linking.openSettings : requestPermission
    return (
      <SafeAreaView style={styles.permission}>
        <View style={styles.permissionContent}>
          <Text style={styles.permissionTitle}>{permissionPresentation.title}</Text>
          <Text style={styles.permissionCopy}>{permissionPresentation.detail}</Text>
        </View>
        <View style={styles.permissionActions}>
          {permissionPresentation.primaryLabel ? (
            <AppButton label={permissionPresentation.primaryLabel} onPress={() => { void primaryAction() }} />
          ) : null}
          <AppButton label="Choose from library" onPress={pick} variant="tertiary" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <View style={styles.camera}>
      <CameraView
        ref={camera}
        onCameraReady={() => {
          setCameraReady(true)
          setCaptureError(null)
        }}
        onMountError={() => {
          setCameraReady(false)
          setCaptureError('Camera could not start. Choose from your library or try again.')
        }}
        style={StyleSheet.absoluteFill}
      />
      <CameraCorners />
      <SafeAreaView style={styles.topSafe} pointerEvents="box-none">
        <View style={styles.topRow}>
          <Text style={styles.eyebrow}>{presentation.eyebrow}</Text>
          <Pressable
            accessibilityLabel="Open Insights"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.push('/insights')}
            style={styles.topInsight}
          >
            <AppIcon name="chart.line.uptrend.xyaxis" fallback="↗" />
          </Pressable>
        </View>
      </SafeAreaView>

      <View pointerEvents="none" style={styles.instructionWrap}>
        <Text style={styles.instruction}>{presentation.instruction}</Text>
        {captureError ? <Text accessibilityRole="alert" style={styles.captureError}>{captureError}</Text> : null}
      </View>

      <SafeAreaView style={styles.bottomSafe} pointerEvents="box-none">
        <View style={styles.captureRow}>
          <Pressable accessibilityLabel="Choose from library" accessibilityRole="button" onPress={pick} style={styles.iconButton}>
            <AppIcon name="photo" fallback="▧" />
          </Pressable>
          <Pressable
            accessibilityLabel={isCapturing ? 'Taking photo' : cameraReady ? 'Take photo' : 'Camera loading'}
            accessibilityRole="button"
            accessibilityState={{ disabled: !cameraReady || isCapturing }}
            disabled={!cameraReady || isCapturing}
            onPress={snap}
            style={[styles.shutter, (!cameraReady || isCapturing) && styles.shutterDisabled]}
          ><View style={styles.shutterInner} /></Pressable>
          <Pressable
            accessibilityLabel="Open Insights"
            accessibilityRole="button"
            onPress={() => router.push('/insights')}
            style={styles.iconButton}
          >
            <AppIcon name="chart.line.uptrend.xyaxis" fallback="↗" />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  camera: { flex: 1, backgroundColor: colors.ink },
  permission: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: spacing.xl, justifyContent: 'center', gap: spacing.xxl },
  permissionContent: { gap: spacing.sm },
  permissionTitle: { color: colors.chalk, fontSize: typeScale.display, fontWeight: '700', letterSpacing: -0.5 },
  permissionCopy: { color: colors.muted, fontSize: typeScale.body, lineHeight: 22 },
  permissionActions: { gap: spacing.sm },
  topSafe: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  eyebrow: { color: colors.chalk, fontSize: typeScale.caption, fontWeight: '700', letterSpacing: 1.4 },
  topInsight: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  instructionWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 56, gap: spacing.md },
  instruction: { color: colors.chalk, fontSize: typeScale.body, fontWeight: '600', textAlign: 'center', textShadowColor: colors.ink, textShadowRadius: 8 },
  captureError: { color: colors.chalk, backgroundColor: colors.graphite, borderColor: colors.error, borderLeftWidth: 2, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typeScale.caption, lineHeight: 17, textAlign: 'center' },
  bottomSafe: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  captureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: colors.chalk, alignItems: 'center', justifyContent: 'center', padding: 5 },
  shutterDisabled: { opacity: 0.48 },
  shutterInner: { flex: 1, alignSelf: 'stretch', borderRadius: 33, backgroundColor: colors.chalk },
})
