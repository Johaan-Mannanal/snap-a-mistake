import { useCallback, useEffect, useState } from 'react'
import { router, Stack, useRootNavigationState } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { getLocalScanRepository, initLocalScanStorage } from '../src/lib/history'
import { flushCleanupQueue } from '../src/lib/scanFiles'
import { hydrateSession, takeHydratedRouteIntent } from '../src/lib/session'
import { bootstrapLocalStorage, type LocalStorageBootstrapState } from '../src/lib/startup'
import { colors } from '../src/ui/theme'
import { statefulRouteScreenOptions } from '../src/lib/routeNavigation'

export default function RootLayout() {
  const [startup, setStartup] = useState<LocalStorageBootstrapState | null>(null)
  const navigationState = useRootNavigationState()
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

  useEffect(() => {
    if (startup?.kind !== 'ready' || !navigationState?.key) return
    const intent = takeHydratedRouteIntent()
    const destination = intent === 'review' ? '/review'
      : intent === 'result' ? '/analyze'
        : intent === 'follow-up' ? '/followup'
          : null
    if (destination !== null) router.replace(destination)
  }, [navigationState?.key, startup])

  const content = (() => {
    if (startup === null) return <View style={styles.launch} />

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
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink } }}>
          <Stack.Screen name="review" options={statefulRouteScreenOptions('review')} />
          <Stack.Screen name="analyze" options={statefulRouteScreenOptions('analyze')} />
          <Stack.Screen name="followup" options={statefulRouteScreenOptions('followup')} />
        </Stack>
      </>
    )
  })()

  return (
    <GestureHandlerRootView style={styles.root}>
      {content}
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  launch: { flex: 1, backgroundColor: colors.ink },
  error: { flex: 1, backgroundColor: colors.ink, justifyContent: 'center', padding: 24, gap: 14 },
  errorTitle: { color: colors.chalk, fontSize: 24, fontWeight: '700', lineHeight: 30 },
  errorDetail: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  retry: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: colors.chalk },
  retryLabel: { color: colors.chalk, fontSize: 16, fontWeight: '700' },
})
