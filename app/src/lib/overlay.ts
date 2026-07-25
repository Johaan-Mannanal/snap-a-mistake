const MAX_LINE_HEIGHT_RATIO = 0.04

export type ContainedPhotoRect = { left: number; top: number; width: number; height: number }

export function containedPhotoRect(input: {
  frameWidth: number
  frameHeight: number
  imageWidth: number
  imageHeight: number
}): ContainedPhotoRect | null {
  if (input.frameWidth <= 0 || input.frameHeight <= 0 || input.imageWidth <= 0 || input.imageHeight <= 0)
    return null

  const scale = Math.min(input.frameWidth / input.imageWidth, input.frameHeight / input.imageHeight)
  const width = input.imageWidth * scale
  const height = input.imageHeight * scale
  return {
    left: (input.frameWidth - width) / 2,
    top: (input.frameHeight - height) / 2,
    width,
    height,
  }
}

export function hasPhotoBand(step: { yBandTopPct?: number; yBandBottomPct?: number }): boolean {
  return Number.isFinite(step.yBandTopPct)
    && Number.isFinite(step.yBandBottomPct)
    && step.yBandTopPct! >= 0
    && step.yBandBottomPct! <= 100
    && step.yBandTopPct! <= step.yBandBottomPct!
}

export function bandStyle(
  step: { yBandTopPct: number; yBandBottomPct: number },
  displayedHeight: number,
): { top: number; height: number } {
  const rawTop = (step.yBandTopPct / 100) * displayedHeight
  const rawHeight = ((step.yBandBottomPct - step.yBandTopPct) / 100) * displayedHeight
  const oneLineHeight = Math.max(24, displayedHeight * MAX_LINE_HEIGHT_RATIO)
  const height = Math.min(Math.max(rawHeight, 24), oneLineHeight, displayedHeight)
  const top = Math.min(Math.max(rawTop, 0), displayedHeight - height)
  return { top, height }
}
