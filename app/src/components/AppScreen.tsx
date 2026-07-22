import type { PropsWithChildren } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, spacing } from '../ui/theme'

export function AppScreen(props: PropsWithChildren<{ scroll?: boolean; contentStyle?: StyleProp<ViewStyle> }>) {
  const content = props.scroll === false ? (
    <View style={[styles.fixed, props.contentStyle]}>{props.children}</View>
  ) : (
    <ScrollView contentContainerStyle={[styles.content, props.contentStyle]}>{props.children}</ScrollView>
  )
  return <SafeAreaView style={styles.safe}>{content}</SafeAreaView>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  fixed: { flex: 1, paddingHorizontal: 20 },
  content: { paddingHorizontal: 20, paddingBottom: spacing.xxl, gap: spacing.lg },
})
