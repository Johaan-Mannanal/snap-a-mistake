export const CAMERA_MOUNT_ERROR = 'Camera could not start. Tap Retry camera or choose from your library.'

export type CameraUiState = {
  cameraMountKey: number
  cameraReady: boolean
  isCapturing: boolean
  captureError: string | null
}

export type CameraUiEvent =
  | { type: 'cameraReady' }
  | { type: 'cameraMountFailed' }
  | { type: 'retryCameraMount' }
  | { type: 'captureBusyChanged'; busy: boolean }
  | { type: 'captureFailed'; message: string }

export const initialCameraUiState: CameraUiState = {
  cameraMountKey: 0,
  cameraReady: false,
  isCapturing: false,
  captureError: null,
}

export function cameraUiReducer(state: CameraUiState, event: CameraUiEvent): CameraUiState {
  switch (event.type) {
    case 'cameraReady':
      return { ...state, cameraReady: true, captureError: null }
    case 'cameraMountFailed':
      return { ...state, cameraReady: false, captureError: CAMERA_MOUNT_ERROR }
    case 'retryCameraMount':
      if (state.isCapturing) return state
      return {
        cameraMountKey: state.cameraMountKey + 1,
        cameraReady: false,
        isCapturing: false,
        captureError: null,
      }
    case 'captureBusyChanged':
      return { ...state, isCapturing: event.busy, captureError: event.busy ? null : state.captureError }
    case 'captureFailed':
      return { ...state, captureError: event.message }
  }
}
