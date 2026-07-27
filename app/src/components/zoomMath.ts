export function clampPhotoScale(value: number): number {
  'worklet'
  return Math.min(4, Math.max(1, value))
}

export function normalizeImageSize(width: number, height: number): { width: number; height: number } | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  return { width, height }
}

export function normalizeLoadedImageSize(
  expectedUri: string,
  source: { uri: string; width: number; height: number },
): { width: number; height: number } | null {
  if (source.uri !== expectedUri) return null
  return normalizeImageSize(source.width, source.height)
}

export function photoTransform(input: { x: number; y: number; scale: number }) {
  'worklet'
  return [
    { translateX: input.x },
    { translateY: input.y },
    { scale: input.scale },
  ]
}

export function clampPhotoTranslation(input: {
  x: number
  y: number
  frameWidth: number
  frameHeight: number
  imageWidth: number
  imageHeight: number
  scale: number
}) {
  'worklet'
  if (input.frameWidth <= 0 || input.frameHeight <= 0 || input.imageWidth <= 0 || input.imageHeight <= 0 || input.scale <= 1)
    return { x: 0, y: 0 }
  const containedScale = Math.min(input.frameWidth / input.imageWidth, input.frameHeight / input.imageHeight)
  const renderedWidth = input.imageWidth * containedScale
  const renderedHeight = input.imageHeight * containedScale
  const maxX = Math.max(0, (renderedWidth * input.scale - input.frameWidth) / 2)
  const maxY = Math.max(0, (renderedHeight * input.scale - input.frameHeight) / 2)
  return {
    x: maxX === 0 ? 0 : Math.min(maxX, Math.max(-maxX, input.x)),
    y: maxY === 0 ? 0 : Math.min(maxY, Math.max(-maxY, input.y)),
  }
}
