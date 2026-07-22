export type CaptureLock = { current: boolean }

export function runIfCaptureIdle(lock: CaptureLock, action: () => void) {
  if (lock.current) return false
  action()
  return true
}

type CameraCapture = {
  takePictureAsync(options: { quality: number }): Promise<{ uri?: string } | undefined>
}

type CapturePhotoOptions = {
  camera: CameraCapture | null
  ready: boolean
  lock: CaptureLock
  onPhoto: (uri: string) => void
  onError: (message: string) => void
  onBusyChange?: (busy: boolean) => void
}

export async function capturePhoto(options: CapturePhotoOptions) {
  if (!options.camera || !options.ready || options.lock.current) return

  options.lock.current = true
  options.onBusyChange?.(true)
  try {
    const photo = await options.camera.takePictureAsync({ quality: 0.7 })
    if (!photo?.uri) {
      options.onError('Could not take the photo. Try again or choose from your library.')
      return
    }
    options.onPhoto(photo.uri)
  } catch {
    options.onError('Could not take the photo. Try again or choose from your library.')
  } finally {
    options.lock.current = false
    options.onBusyChange?.(false)
  }
}
