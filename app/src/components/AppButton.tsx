import { useRef } from 'react'
import { Platform, Pressable, StyleSheet, Text, type GestureResponderEvent } from 'react-native'
import { classifyAppButtonPress } from '../lib/appButtonPress'
import { buttonPalette, colors, radii, type ButtonVariant } from '../ui/theme'

type AppButtonProps = {
  label: string
  onPress?: () => void
  onPressIn?: () => void
  onPressOut?: () => void
  onNonPointerPress?: () => void
  disabled?: boolean
  variant?: ButtonVariant
}

export function AppButton(props: AppButtonProps) {
  const variant = props.variant ?? 'primary'
  const palette = buttonPalette(variant, props.disabled ?? false)
  const focused = useRef(false)
  const activateWithoutPointer = () => {
    if (!props.disabled) props.onNonPointerPress?.()
  }
  const handlePress = (event: GestureResponderEvent) => {
    if (
      classifyAppButtonPress(Platform.OS, event.nativeEvent, focused.current) === 'non-pointer'
      && props.onNonPointerPress
    ) {
      activateWithoutPointer()
    } else {
      props.onPress?.()
    }
  }
  return (
    <Pressable
      accessibilityActions={props.onNonPointerPress ? [{ name: 'activate' }] : undefined}
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      onAccessibilityAction={props.onNonPointerPress ? (event) => {
        if (event.nativeEvent.actionName === 'activate') activateWithoutPointer()
      } : undefined}
      onAccessibilityTap={props.onNonPointerPress ? activateWithoutPointer : undefined}
      onBlur={() => { focused.current = false }}
      onFocus={() => { focused.current = true }}
      onPress={handlePress}
      onPressIn={props.onPressIn}
      onPressOut={props.onPressOut}
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
