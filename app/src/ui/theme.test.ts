import { describe, expect, it } from 'vitest'
import { buttonPalette, colors } from './theme'

describe('Night Gallery theme', () => {
  it('uses the approved palette without the old navy or indigo', () => {
    expect(colors).toMatchObject({
      ink: '#050505', graphite: '#121212', carbon: '#242424', chalk: '#F5F5F3',
      muted: '#98989D', blue: '#1473E6', error: '#FF5C67', success: '#36D17C',
    })
    expect(Object.values(colors)).not.toContain('#0f172a')
    expect(Object.values(colors)).not.toContain('#6366f1')
  })

  it('keeps the primary action monochrome and disabled actions quiet', () => {
    expect(buttonPalette('primary', false)).toEqual({ background: colors.chalk, foreground: colors.ink, border: colors.chalk })
    expect(buttonPalette('secondary', false)).toEqual({ background: colors.ink, foreground: colors.chalk, border: colors.carbon })
    expect(buttonPalette('primary', true)).toEqual({ background: colors.carbon, foreground: colors.muted, border: colors.carbon })
  })
})
