import { describe, expect, it } from 'vitest'
import { clampPhotoTranslation } from './zoomMath'

describe('clampPhotoTranslation', () => {
  it('keeps panning at zero when the contained photo is at 1x', () => {
    expect(clampPhotoTranslation({ x: 80, y: -60, width: 320, height: 240, scale: 1 })).toEqual({ x: 0, y: 0 })
  })

  it('clamps pan offsets to the visible edge of a scaled photo', () => {
    expect(clampPhotoTranslation({ x: 500, y: -500, width: 320, height: 240, scale: 2 })).toEqual({ x: 160, y: -120 })
  })

  it('preserves offsets inside the scaled frame limits', () => {
    expect(clampPhotoTranslation({ x: -54, y: 31, width: 320, height: 240, scale: 1.5 })).toEqual({ x: -54, y: 31 })
  })
})
