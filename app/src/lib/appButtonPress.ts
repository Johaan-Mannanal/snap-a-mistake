export type AppButtonPressKind = 'pointer' | 'non-pointer'

const RESPONDER_EVENT_MARKERS = [
  'changedTouches',
  'touches',
  'identifier',
  'locationX',
  'locationY',
  'pageX',
  'pageY',
  'pointerType',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function classifyAppButtonPress(
  platform: string,
  nativeEvent: unknown,
  focused: boolean,
): AppButtonPressKind {
  const event = isRecord(nativeEvent) ? nativeEvent : {}
  if (platform === 'web') return event.detail === 0 ? 'non-pointer' : 'pointer'

  const hasResponderMarker = RESPONDER_EVENT_MARKERS.some((marker) => (
    Object.prototype.hasOwnProperty.call(event, marker)
  ))
  return focused && !hasResponderMarker ? 'non-pointer' : 'pointer'
}
