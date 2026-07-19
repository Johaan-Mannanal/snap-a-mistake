import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { initDb } from '../src/lib/history'

export default function RootLayout() {
  useEffect(() => { initDb().catch(() => {}) }, [])
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0f172a' } }} />
  )
}
