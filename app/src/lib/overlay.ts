export function bandStyle(
  step: { yBandTopPct: number; yBandBottomPct: number },
  displayedHeight: number,
): { top: number; height: number } {
  const rawTop = (step.yBandTopPct / 100) * displayedHeight
  const rawHeight = ((step.yBandBottomPct - step.yBandTopPct) / 100) * displayedHeight
  const height = Math.min(Math.max(rawHeight, 24), displayedHeight)
  const top = Math.min(Math.max(rawTop, 0), displayedHeight - height)
  return { top, height }
}
