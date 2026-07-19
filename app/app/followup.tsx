import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { getSession, startFollowUp } from '../src/lib/session'
import { Screen } from '../src/components/Screen'

export default function FollowUp() {
  const followUp = getSession().followUp
  if (!followUp) {
    return (
      <Screen>
        <Text style={{ color: '#94a3b8' }}>No follow-up problem yet — analyze some work first.</Text>
        <Pressable onPress={() => router.replace('/')}><Text style={{ color: '#6366f1', fontWeight: '700' }}>Back to camera</Text></Pressable>
      </Screen>
    )
  }
  return (
    <Screen>
      <View style={{ backgroundColor: '#312e81', alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
        <Text style={{ color: '#c7d2fe', fontSize: 13, fontWeight: '600' }}>{followUp.concept}</Text>
      </View>
      <Text style={{ color: '#e2e8f0', fontSize: 24, lineHeight: 34, fontWeight: '600', marginTop: 8 }}>
        {followUp.problem}
      </Text>
      <Text style={{ color: '#94a3b8', marginTop: 8 }}>Work it out on paper, then snap your solution.</Text>
      <Pressable
        onPress={() => { startFollowUp(); router.replace('/') }}
        style={{ backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 }}
      >
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>I'm done — check it</Text>
      </Pressable>
    </Screen>
  )
}
