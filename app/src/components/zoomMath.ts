export function clampPhotoTranslation(input: { x: number; y: number; width: number; height: number; scale: number }) {
  'worklet'
  if (input.width <= 0 || input.height <= 0 || input.scale <= 1) return { x: 0, y: 0 }
  const maxX = (input.width * (input.scale - 1)) / 2
  const maxY = (input.height * (input.scale - 1)) / 2
  return {
    x: Math.min(maxX, Math.max(-maxX, input.x)),
    y: Math.min(maxY, Math.max(-maxY, input.y)),
  }
}
