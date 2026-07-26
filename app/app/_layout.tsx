import { useCallback, useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { getLocalScanRepository, initLocalScanStorage } from '../src/lib/history'
import { flushCleanupQueue } from '../src/lib/scanFiles'
import { hydrateSession } from '../src/lib/session'
import { bootstrapLocalStorage, type LocalStorageBootstrapState } from '../src/lib/startup'
import { colors } from '../src/ui/theme'

export default function RootLayout() {
  const [startup, setStartup] = useState<LocalStorageBootstrapState | null>(null)
  const initialize = useCallback(() => {
    setStartup(null)
    void bootstrapLocalStorage(async () => {
      await initLocalScanStorage()
      const repository = getLocalScanRepository()
      await flushCleanupQueue(repository)
      await hydrateSession(repository)
    }).then(setStartup)
  }, [])

  useEffect(() => {
    queueMicrotask(initialize)
  }, [initialize])

  if (startup === null) {
    return <View style={styles.launch} />
  }

  if (startup.kind === 'error') {
    return (
      <View style={styles.error}>
        <Text style={styles.errorTitle}>Your local data couldn’t be opened.</Text>
        <Text style={styles.errorDetail}>Your photos and history are still on this device. Try again to continue.</Text>
        <Pressable accessibilityRole="button" onPress={initialize} style={styles.retry}>
          <Text style={styles.retryLabel}>Try again</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink } }} />
    </>
  )
}

const styles = StyleSheet.create({
  launch: { flex: 1, backgroundColor: colors.ink },
  error: { flex: 1, backgroundColor: colors.ink, justifyContent: 'center', padding: 24, gap: 14 },
  errorTitle: { color: colors.chalk, fontSize: 24, fontWeight: '700', lineHeight: 30 },
  errorDetail: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  retry: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: colors.chalk },
  retryLabel: { color: colors.chalk, fontSize: 16, fontWeight: '700' },
})
