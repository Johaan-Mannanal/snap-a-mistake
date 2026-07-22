import { describe, expect, it } from 'vitest'
import { cameraUiReducer, initialCameraUiState } from './cameraUiState'

describe('cameraUiReducer', () => {
  it('recovers from a mount error by resetting readiness and advancing the camera mount key', () => {
    const ready = cameraUiReducer(initialCameraUiState, { type: 'cameraReady' })
    const failed = cameraUiReducer(ready, { type: 'cameraMountFailed' })
    const retrying = cameraUiReducer(failed, { type: 'retryCameraMount' })

    expect(failed).toMatchObject({ cameraReady: false, cameraMountKey: 0 })
    expect(failed.captureError).toContain('Retry camera')
    expect(retrying).toEqual({
      cameraMountKey: 1,
      cameraReady: false,
      isCapturing: false,
      captureError: null,
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
})
