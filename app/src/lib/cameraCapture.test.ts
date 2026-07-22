import { describe, expect, it, vi } from 'vitest'
import { capturePhoto, runIfCaptureIdle, type CaptureLock } from './cameraCapture'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('capturePhoto', () => {
  it('does not capture until the camera reports ready', async () => {
    const takePicture = vi.fn()
    const onPhoto = vi.fn()
    const lock: CaptureLock = { current: false }

    await capturePhoto({ camera: { takePictureAsync: takePicture }, ready: false, lock, onPhoto, onError: vi.fn() })

    expect(takePicture).not.toHaveBeenCalled()
    expect(onPhoto).not.toHaveBeenCalled()
  })

  it('prevents a second capture while the first is pending', async () => {
    const pending = deferred<{ uri: string }>()
    const takePicture = vi.fn(() => pending.promise)
    const onPhoto = vi.fn()
    const lock: CaptureLock = { current: false }
    const options = { camera: { takePictureAsync: takePicture }, ready: true, lock, onPhoto, onError: vi.fn() }

    const first = capturePhoto(options)
    const second = capturePhoto(options)

    expect(takePicture).toHaveBeenCalledTimes(1)
    pending.resolve({ uri: 'file:///photo.jpg' })
    await Promise.all([first, second])
    expect(onPhoto).toHaveBeenCalledWith('file:///photo.jpg')
    expect(lock.current).toBe(false)
  })

  it('turns capture rejection into a recoverable error and releases the lock', async () => {
    const error = new Error('camera unavailable')
    const onError = vi.fn()
    const lock: CaptureLock = { current: false }

    await expect(capturePhoto({
      camera: { takePictureAsync: vi.fn().mockRejectedValue(error) },
      ready: true,
      lock,
      onPhoto: vi.fn(),
      onError,
    })).resolves.toBeUndefined()

    expect(onError).toHaveBeenCalledWith('Could not take the photo. Try again or choose from your library.')
    expect(lock.current).toBe(false)
  })

  it('blocks competing actions until a pending capture resolves', async () => {
    const pending = deferred<{ uri: string }>()
    const lock: CaptureLock = { current: false }
    const competingAction = vi.fn()
    const onBusyChange = vi.fn()
    const capture = capturePhoto({
      camera: { takePictureAsync: vi.fn(() => pending.promise) },
      ready: true,
      lock,
      onPhoto: vi.fn(),
      onError: vi.fn(),
      onBusyChange,
    })

    expect(runIfCaptureIdle(lock, competingAction)).toBe(false)
    expect(competingAction).not.toHaveBeenCalled()

    pending.resolve({ uri: 'file:///photo.jpg' })
    await capture

    expect(runIfCaptureIdle(lock, competingAction)).toBe(true)
    expect(competingAction).toHaveBeenCalledTimes(1)
    expect(onBusyChange.mock.calls).toEqual([[true], [false]])
  })

  it('re-enables competing actions after a capture rejects', async () => {
    const pending = deferred<{ uri: string }>()
    const lock: CaptureLock = { current: false }
    const competingAction = vi.fn()
    const onBusyChange = vi.fn()
    const capture = capturePhoto({
      camera: { takePictureAsync: vi.fn(() => pending.promise) },
      ready: true,
      lock,
      onPhoto: vi.fn(),
      onError: vi.fn(),
      onBusyChange,
    })

    expect(runIfCaptureIdle(lock, competingAction)).toBe(false)
    pending.reject(new Error('camera unavailable'))
    await capture

    expect(runIfCaptureIdle(lock, competingAction)).toBe(true)
    expect(competingAction).toHaveBeenCalledTimes(1)
    expect(onBusyChange.mock.calls).toEqual([[true], [false]])
  })
})
