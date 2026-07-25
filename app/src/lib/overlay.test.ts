import { describe, expect, it } from 'vitest'
import { bandHitTargetStyle, bandStyle, containedPhotoRect, hasPhotoBand } from './overlay'

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

  it('positions bands inside the actual contained landscape photo', () => {
    expect(containedPhotoRect({ frameWidth: 320, frameHeight: 480, imageWidth: 1600, imageHeight: 800 }))
      .toEqual({ left: 0, top: 160, width: 320, height: 160 })
  })

  it('positions bands inside the actual contained portrait photo', () => {
    expect(containedPhotoRect({ frameWidth: 480, frameHeight: 320, imageWidth: 800, imageHeight: 1600 }))
      .toEqual({ left: 160, top: 0, width: 160, height: 320 })
  })

  it('rejects steps without a usable location instead of placing a fake band', () => {
    expect(hasPhotoBand({ yBandTopPct: Number.NaN, yBandBottomPct: 20 })).toBe(false)
    expect(hasPhotoBand({ yBandTopPct: 80, yBandBottomPct: 20 })).toBe(false)
    expect(hasPhotoBand({ yBandTopPct: 20, yBandBottomPct: 20 })).toBe(true)
  })

  it('keeps the top-edge press target fully inside the photo at 44 points', () => {
    expect(bandHitTargetStyle({ yBandTopPct: 0, yBandBottomPct: 1 }, 400))
      .toEqual({ top: 0, height: 44, visualTop: 0, visualHeight: 24 })
  })

  it('shifts the bottom-edge press target upward while keeping its visual line precise', () => {
    expect(bandHitTargetStyle({ yBandTopPct: 98, yBandBottomPct: 100 }, 400))
      .toEqual({ top: 356, height: 44, visualTop: 20, visualHeight: 24 })
  })
})
