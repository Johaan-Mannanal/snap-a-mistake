import { Pressable, StyleSheet, Text } from 'react-native'
import { buttonPalette, colors, radii, type ButtonVariant } from '../ui/theme'

type AppButtonProps = {
  label: string
  onPress?: () => void
  onPressIn?: () => void
  disabled?: boolean
  variant?: ButtonVariant
}

export function AppButton(props: AppButtonProps) {
  const variant = props.variant ?? 'primary'
  const palette = buttonPalette(variant, props.disabled ?? false)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      onPressIn={props.onPressIn}
      style={({ pressed }) => [styles.base, { backgroundColor: palette.background, borderColor: palette.border, opacity: pressed ? 0.72 : 1 }]}
    >
      <Text style={[styles.label, { color: palette.foreground }]}>{props.label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: { minHeight: 52, borderWidth: 1, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  label: { color: colors.chalk, fontSize: 15, fontWeight: '700', letterSpacing: -0.1, textAlign: 'center' },
})
