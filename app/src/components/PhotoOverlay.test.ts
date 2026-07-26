import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const overlaySource = readFileSync(resolve(__dirname, 'PhotoOverlay.tsx'), 'utf8')
const zoomSource = readFileSync(resolve(__dirname, 'ZoomablePhoto.tsx'), 'utf8')

describe('zoomed photo overlay production wiring', () => {
  it('shares the photo transform while counter-scaling animated border and label decoration', () => {
    expect(zoomSource).toContain('{props.renderOverlay?.(geometry, scale)}')
    expect(overlaySource).toContain('overlayDecorationMetrics(props.zoomScale.value, props.selected)')
    expect(overlaySource).toContain('<Animated.View')
    expect(overlaySource).toContain('<Animated.Text')
  })
})
