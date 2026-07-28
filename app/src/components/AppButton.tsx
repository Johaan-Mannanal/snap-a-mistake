import type { ComponentProps, ComponentType } from 'react'
import { Platform, Pressable, StyleSheet, Text, type GestureResponderEvent } from 'react-native'
import { buttonPalette, colors, radii, type ButtonVariant } from '../ui/theme'

type KeyAwarePressableProps = ComponentProps<typeof Pressable> & {
  onKeyUp?: (event: { nativeEvent: { key: string } }) => void
}

const KeyAwarePressable = Pressable as ComponentType<KeyAwarePressableProps>

type AppButtonProps = {
  label: string
  onPress?: () => void
  onPressIn?: () => void
  onNonPointerPress?: () => void
  disabled?: boolean
  variant?: ButtonVariant
}

export function AppButton(props: AppButtonProps) {
  const variant = props.variant ?? 'primary'
  const palette = buttonPalette(variant, props.disabled ?? false)
  const activateWithoutPointer = () => {
    if (!props.disabled) props.onNonPointerPress?.()
  }
  const handleKeyUp = (event: { nativeEvent: { key: string } }) => {
    if (
      Platform.OS !== 'web'
      && (event.nativeEvent.key === 'Enter' || event.nativeEvent.key === ' ')
    ) activateWithoutPointer()
  }
  const handlePress = (event: GestureResponderEvent) => {
    const detail = (event.nativeEvent as GestureResponderEvent['nativeEvent'] & { detail?: number }).detail
    if (Platform.OS === 'web' && detail === 0 && props.onNonPointerPress) {
      activateWithoutPointer()
    } else {
      props.onPress?.()
    }
  }
  return (
    <KeyAwarePressable
      accessibilityActions={props.onNonPointerPress ? [{ name: 'activate' }] : undefined}
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      onAccessibilityAction={props.onNonPointerPress ? (event) => {
        if (event.nativeEvent.actionName === 'activate') activateWithoutPointer()
      } : undefined}
      onAccessibilityTap={props.onNonPointerPress ? activateWithoutPointer : undefined}
      onKeyUp={props.onNonPointerPress ? handleKeyUp : undefined}
      onPress={handlePress}
      onPressIn={props.onPressIn}
      style={({ pressed }) => [styles.base, { backgroundColor: palette.background, borderColor: palette.border, opacity: pressed ? 0.72 : 1 }]}
    >
      <Text style={[styles.label, { color: palette.foreground }]}>{props.label}</Text>
    </KeyAwarePressable>
  )
}

const styles = StyleSheet.create({
  base: { minHeight: 52, borderWidth: 1, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  label: { color: colors.chalk, fontSize: 15, fontWeight: '700', letterSpacing: -0.1, textAlign: 'center' },
})
