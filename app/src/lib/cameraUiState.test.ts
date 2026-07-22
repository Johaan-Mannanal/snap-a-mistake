import { describe, expect, it } from 'vitest'
import { CAMERA_MOUNT_ERROR, cameraUiReducer, initialCameraUiState } from './cameraUiState'

describe('cameraUiReducer', () => {
  it('recovers from a mount error by resetting readiness and advancing the camera mount key', () => {
    const ready = cameraUiReducer(initialCameraUiState, { type: 'cameraReady' })
    const failed = cameraUiReducer(ready, { type: 'cameraMountFailed' })
    const retrying = cameraUiReducer(failed, { type: 'retryCameraMount' })

    expect(failed).toMatchObject({ cameraReady: false, cameraMountKey: 0 })
    expect(failed.cameraError).toEqual({ kind: 'mount', message: CAMERA_MOUNT_ERROR })
    expect(retrying).toEqual({
      cameraMountKey: 1,
      cameraReady: false,
      isCapturing: false,
      cameraError: null,
    })
  })

  it('does not remount the camera while a capture is pending', () => {
    const capturing = cameraUiReducer(initialCameraUiState, { type: 'captureBusyChanged', busy: true })

    expect(cameraUiReducer(capturing, { type: 'retryCameraMount' })).toBe(capturing)
  })

  it('re-enables controls when capture settles', () => {
    const capturing = cameraUiReducer(initialCameraUiState, { type: 'captureBusyChanged', busy: true })
    const settled = cameraUiReducer(capturing, { type: 'captureBusyChanged', busy: false })

    expect(capturing.isCapturing).toBe(true)
    expect(settled.isCapturing).toBe(false)
  })

  it('shows capture rejection copy when no mount failure supersedes it', () => {
    const message = 'Could not take the photo. Try again or choose from your library.'
    const failed = cameraUiReducer(initialCameraUiState, { type: 'captureFailed', message })

    expect(failed.cameraError).toEqual({ kind: 'capture', message })
  })

  it('keeps a retryable mount failure visible when the pending capture rejects and settles', () => {
    const ready = cameraUiReducer(initialCameraUiState, { type: 'cameraReady' })
    const capturing = cameraUiReducer(ready, { type: 'captureBusyChanged', busy: true })
    const mountFailed = cameraUiReducer(capturing, { type: 'cameraMountFailed' })
    const captureFailed = cameraUiReducer(mountFailed, {
      type: 'captureFailed',
      message: 'Could not take the photo. Try again or choose from your library.',
    })
    const settled = cameraUiReducer(captureFailed, { type: 'captureBusyChanged', busy: false })

    expect(settled).toMatchObject({
      cameraReady: false,
      isCapturing: false,
      cameraError: { kind: 'mount', message: CAMERA_MOUNT_ERROR },
    })
  })
})
