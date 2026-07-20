import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { loadHistory } from '../src/lib/history'
import { summarize, type TagSummary } from '../src/lib/trends'
import { tagLabel } from '../src/lib/labels'
import { Screen } from '../src/components/Screen'

const TREND = {
  fewer: { text: 'improving ↗', color: '#22c55e' },
  more: { text: '↘ watch this', color: '#ef4444' },
  same: { text: '→ steady', color: '#94a3b8' },
} as const

export default function Insights() {
  const [rows, setRows] = useState<TagSummary[] | null>(null)

  useEffect(() => {
    loadHistory().then((records) => setRows(summarize(records, new Date()))).catch(() => setRows([]))
  }, [])

  return (
    <Screen>
      <Pressable onPress={() => router.back()}><Text style={{ color: '#6366f1', fontWeight: '700' }}>‹ Back</Text></Pressable>
      <Text style={{ color: '#e2e8f0', fontSize: 24, fontWeight: '800' }}>Your patterns</Text>
      {rows === null ? (
        <Text style={{ color: '#94a3b8' }}>Loading…</Text>
      ) : rows.length === 0 ? (
        <Text style={{ color: '#94a3b8' }}>No misconceptions tracked yet — snap some work and I'll start spotting patterns.</Text>
      ) : (
        rows.map((r) => (
          <View key={r.tag} style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: '#e2e8f0', fontSize: 16, fontWeight: '600' }}>{tagLabel(r.tag)}</Text>
              <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>
                {r.thisWeek} this week
              </Text>
            </View>
            <Text style={{ color: TREND[r.trend].color, fontWeight: '700' }}>{TREND[r.trend].text}</Text>
          </View>
        ))
      )}
    </Screen>
  )
}
