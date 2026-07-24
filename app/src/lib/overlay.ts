const MAX_LINE_HEIGHT_RATIO = 0.04

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
