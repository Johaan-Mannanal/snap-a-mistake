export const colors = {
  ink: '#050505', graphite: '#121212', carbon: '#242424', chalk: '#F5F5F3',
  muted: '#98989D', blue: '#1473E6', error: '#FF5C67', success: '#36D17C',
} as const

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const
export const radii = { sm: 8, md: 12, lg: 18, round: 999 } as const
export const typeScale = { caption: 12, body: 15, title: 24, display: 32 } as const

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary'

export function buttonPalette(variant: ButtonVariant, disabled: boolean) {
  if (disabled) return { background: colors.carbon, foreground: colors.muted, border: colors.carbon }
  if (variant === 'primary') return { background: colors.chalk, foreground: colors.ink, border: colors.chalk }
  if (variant === 'secondary') return { background: colors.ink, foreground: colors.chalk, border: colors.carbon }
  return { background: 'transparent', foreground: colors.muted, border: 'transparent' }
}
