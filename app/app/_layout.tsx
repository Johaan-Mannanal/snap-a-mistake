import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { initLocalScanStorage } from '../src/lib/history'
import { colors } from '../src/ui/theme'

export default function RootLayout() {
  useEffect(() => { initLocalScanStorage().catch(() => {}) }, [])
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink } }} />
    </>
  )
}
