import { Text } from 'react-native'
import { SymbolView, type SFSymbol } from 'expo-symbols'
import { colors } from '../ui/theme'

export function AppIcon(props: { name: SFSymbol; size?: number; color?: string; fallback: string }) {
  const size = props.size ?? 20
  return (
    <SymbolView
      name={props.name}
      size={size}
      tintColor={props.color ?? colors.chalk}
      type="monochrome"
      fallback={<Text style={{ color: props.color ?? colors.chalk, fontSize: size }}>{props.fallback}</Text>}
    />
  )
}
