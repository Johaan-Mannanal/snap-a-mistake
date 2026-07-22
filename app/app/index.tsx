import { useReducer, useRef } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppButton } from '../src/components/AppButton'
import { CameraCorners } from '../src/components/CameraCorners'
import { AppIcon } from '../src/components/AppIcon'
import { capturePhoto, runIfCaptureIdle, type CaptureLock } from '../src/lib/cameraCapture'
import { cameraUiReducer, initialCameraUiState } from '../src/lib/cameraUiState'
import { getSession, setPhoto } from '../src/lib/session'
import { cameraPermissionPresentation, cameraPresentation } from '../src/ui/presentation'
import { colors, spacing, typeScale } from '../src/ui/theme'

export default function Home() {
  const camera = useRef<CameraView>(null)
  const captureLock = useRef<CaptureLock>({ current: false })
  const [permission, requestPermission] = useCameraPermissions()
  const [{ cameraMountKey, cameraReady, isCapturing, cameraError }, dispatchCamera] = useReducer(cameraUiReducer, initialCameraUiState)
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
      onError: (message) => dispatchCamera({ type: 'captureFailed', message }),
      onBusyChange: (busy) => dispatchCamera({ type: 'captureBusyChanged', busy }),
    })
  }

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })
    const uri = res.assets?.[0]?.uri
    if (uri) usePhoto(uri)
  }

  const pick = () => {
    runIfCaptureIdle(captureLock.current, () => { void pickPhoto() })
  }

  const openInsights = () => {
    runIfCaptureIdle(captureLock.current, () => router.push('/insights'))
  }

  const retryCamera = () => {
    runIfCaptureIdle(captureLock.current, () => dispatchCamera({ type: 'retryCameraMount' }))
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
        key={cameraMountKey}
        ref={camera}
        onCameraReady={() => {
          dispatchCamera({ type: 'cameraReady' })
        }}
        onMountError={() => {
          dispatchCamera({ type: 'cameraMountFailed' })
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
            accessibilityState={{ disabled: isCapturing }}
            disabled={isCapturing}
            hitSlop={8}
            onPress={openInsights}
            style={[styles.topInsight, isCapturing && styles.controlDisabled]}
          >
            <AppIcon name="chart.line.uptrend.xyaxis" fallback="↗" />
          </Pressable>
        </View>
      </SafeAreaView>

      <View pointerEvents="box-none" style={styles.instructionWrap}>
        <Text style={styles.instruction}>{presentation.instruction}</Text>
        {cameraError ? (
          <View style={styles.captureErrorPanel}>
            <Text accessibilityRole="alert" style={styles.captureError}>{cameraError.message}</Text>
            {cameraError.kind === 'mount' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isCapturing }}
                disabled={isCapturing}
                onPress={retryCamera}
                style={styles.retryCamera}
              >
                <Text style={styles.retryCameraLabel}>Retry camera</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <SafeAreaView style={styles.bottomSafe} pointerEvents="box-none">
        <View style={styles.captureRow}>
          <Pressable
            accessibilityLabel="Choose from library"
            accessibilityRole="button"
            accessibilityState={{ disabled: isCapturing }}
            disabled={isCapturing}
            onPress={pick}
            style={[styles.iconButton, isCapturing && styles.controlDisabled]}
          >
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
            accessibilityState={{ disabled: isCapturing }}
            disabled={isCapturing}
            onPress={openInsights}
            style={[styles.iconButton, isCapturing && styles.controlDisabled]}
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
  captureErrorPanel: { alignItems: 'center', gap: spacing.sm, backgroundColor: colors.graphite, borderColor: colors.error, borderLeftWidth: 2, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  captureError: { color: colors.chalk, fontSize: typeScale.caption, lineHeight: 17, textAlign: 'center' },
  retryCamera: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  retryCameraLabel: { color: colors.chalk, fontSize: typeScale.caption, fontWeight: '700', textDecorationLine: 'underline' },
  bottomSafe: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  captureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  controlDisabled: { opacity: 0.48 },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: colors.chalk, alignItems: 'center', justifyContent: 'center', padding: 5 },
  shutterDisabled: { opacity: 0.48 },
  shutterInner: { flex: 1, alignSelf: 'stretch', borderRadius: 33, backgroundColor: colors.chalk },
})
