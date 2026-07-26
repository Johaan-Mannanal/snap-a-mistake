import { describe, expect, it } from 'vitest'
import { clampPhotoTranslation, photoTransform } from './zoomMath'

describe('clampPhotoTranslation', () => {
  it('keeps panning at zero when the contained photo is at 1x', () => {
    expect(clampPhotoTranslation({ x: 80, y: -60, frameWidth: 320, frameHeight: 240, imageWidth: 1200, imageHeight: 800, scale: 1 })).toEqual({ x: 0, y: 0 })
  })

  it('uses a landscape image’s contained height, keeping y fixed until it overflows', () => {
    expect(clampPhotoTranslation({ x: 500, y: -500, frameWidth: 320, frameHeight: 480, imageWidth: 1600, imageHeight: 800, scale: 2 })).toEqual({ x: 160, y: 0 })
    expect(clampPhotoTranslation({ x: 500, y: -500, frameWidth: 320, frameHeight: 480, imageWidth: 1600, imageHeight: 800, scale: 4 })).toEqual({ x: 480, y: -80 })
  })

  it('uses a portrait image’s contained width, keeping x fixed until it overflows', () => {
    expect(clampPhotoTranslation({ x: 500, y: -500, frameWidth: 480, frameHeight: 320, imageWidth: 800, imageHeight: 1600, scale: 2 })).toEqual({ x: 0, y: -160 })
    expect(clampPhotoTranslation({ x: 500, y: -500, frameWidth: 480, frameHeight: 320, imageWidth: 800, imageHeight: 1600, scale: 4 })).toEqual({ x: 80, y: -480 })
  })

  it('clamps square images from measured frame dimensions for gesture and VoiceOver zoom levels', () => {
    expect(clampPhotoTranslation({ x: -54, y: 31, frameWidth: 320, frameHeight: 240, imageWidth: 1000, imageHeight: 1000, scale: 2 })).toEqual({ x: -54, y: 31 })
    expect(clampPhotoTranslation({ x: 500, y: -500, frameWidth: 320, frameHeight: 240, imageWidth: 1000, imageHeight: 1000, scale: 4 })).toEqual({ x: 320, y: -360 })
  })
})

describe('photoTransform', () => {
  it('applies the same pan and zoom transform to photo content and band geometry', () => {
    expect(photoTransform({ x: 24, y: -18, scale: 3 })).toEqual([
      { translateX: 24 },
      { translateY: -18 },
      { scale: 3 },
    ])
  })
})
