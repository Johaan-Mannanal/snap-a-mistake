const MAX_LINE_HEIGHT_RATIO = 0.04
const OVERLAY_FONT_SIZE = 11
const OVERLAY_LINE_HEIGHT = 16
const OVERLAY_LABEL_INSET = 4
const OVERLAY_SELECTED_BORDER_WIDTH = 2
const OVERLAY_BORDER_WIDTH = 1.5

export type ContainedPhotoRect = { left: number; top: number; width: number; height: number }
export type PhotoBand = { yBandTopPct: number; yBandBottomPct: number }

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

export function hasPhotoBand<T extends { yBandTopPct?: number; yBandBottomPct?: number }>(
  step: T,
): step is T & PhotoBand {
  return Number.isFinite(step.yBandTopPct)
    && Number.isFinite(step.yBandBottomPct)
    && step.yBandTopPct! >= 0
    && step.yBandBottomPct! <= 100
    && step.yBandTopPct! < step.yBandBottomPct!
}

export function photoOverlayStepPresentation(
  steps: readonly { index: number }[],
  stepIndex: number,
): { label: string; accessibilityLabel: string } {
  const position = steps.findIndex((step) => step.index === stepIndex)
  const ordinal = position + 1
  return {
    label: `STEP ${ordinal}`,
    accessibilityLabel: `Focus step ${ordinal} in the timeline`,
  }
}

export function overlayDecorationMetrics(zoomScale: number, selected: boolean) {
  'worklet'
  const safeScale = Number.isFinite(zoomScale) && zoomScale > 0 ? zoomScale : 1
  return {
    borderWidth: (selected ? OVERLAY_SELECTED_BORDER_WIDTH : OVERLAY_BORDER_WIDTH) / safeScale,
    fontSize: OVERLAY_FONT_SIZE / safeScale,
    lineHeight: OVERLAY_LINE_HEIGHT / safeScale,
    paddingHorizontal: OVERLAY_LABEL_INSET / safeScale,
    marginRight: OVERLAY_LABEL_INSET / safeScale,
  }
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

export function bandHitTargetStyle(
  step: { yBandTopPct: number; yBandBottomPct: number },
  displayedHeight: number,
): { top: number; height: number; visualTop: number; visualHeight: number } {
  const visual = bandStyle(step, displayedHeight)
  const height = Math.min(44, displayedHeight)
  const top = Math.min(Math.max(visual.top - (height - visual.height) / 2, 0), displayedHeight - height)
  return { top, height, visualTop: visual.top - top, visualHeight: visual.height }
}
