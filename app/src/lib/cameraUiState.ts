export const CAMERA_MOUNT_ERROR = 'Camera could not start. Tap Retry camera or choose from your library.'

type CameraUiError =
  | { kind: 'mount'; message: string }
  | { kind: 'capture'; message: string }

export type CameraUiState = {
  cameraMountKey: number
  cameraReady: boolean
  isCapturing: boolean
  cameraError: CameraUiError | null
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
  cameraError: null,
}

export function cameraUiReducer(state: CameraUiState, event: CameraUiEvent): CameraUiState {
  switch (event.type) {
    case 'cameraReady':
      return { ...state, cameraReady: true, cameraError: null }
    case 'cameraMountFailed':
      return {
        ...state,
        cameraReady: false,
        cameraError: { kind: 'mount', message: CAMERA_MOUNT_ERROR },
      }
    case 'retryCameraMount':
      if (state.isCapturing) return state
      return {
        cameraMountKey: state.cameraMountKey + 1,
        cameraReady: false,
        isCapturing: false,
        cameraError: null,
      }
    case 'captureBusyChanged':
      return {
        ...state,
        isCapturing: event.busy,
        cameraError: event.busy && state.cameraError?.kind === 'capture' ? null : state.cameraError,
      }
    case 'captureFailed':
      if (state.cameraError?.kind === 'mount') return state
      return { ...state, cameraError: { kind: 'capture', message: event.message } }
  }
}
