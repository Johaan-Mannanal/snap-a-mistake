import { describe, expect, it } from 'vitest'
import { bandStyle } from './overlay'

describe('bandStyle', () => {
  it('keeps an overly broad model band to one displayed line', () => {
    expect(bandStyle({ yBandTopPct: 10, yBandBottomPct: 30 }, 500)).toEqual({ top: 50, height: 24 })
  })
  it('preserves an ordinary narrow band', () => {
    expect(bandStyle({ yBandTopPct: 10, yBandBottomPct: 13 }, 1000)).toEqual({ top: 100, height: 30 })
  })
  it('enforces a 24px minimum band height', () => {
    expect(bandStyle({ yBandTopPct: 50, yBandBottomPct: 51 }, 400).height).toBe(24)
  })
  it('clamps within the image bounds', () => {
    const b = bandStyle({ yBandTopPct: 98, yBandBottomPct: 100 }, 400)
    expect(b.top + b.height).toBeLessThanOrEqual(400)
    expect(b.top).toBeGreaterThanOrEqual(0)
  })
})
