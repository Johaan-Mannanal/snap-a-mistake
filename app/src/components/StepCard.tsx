import { Text, View } from 'react-native'
import type { Step } from '@snap/shared'

const VERDICT = {
  ok: { icon: '✓', color: '#22c55e' },
  wrong: { icon: '✗', color: '#ef4444' },
  suspect: { icon: '⚠️', color: '#f59e0b' },
  downstream: { icon: '↓', color: '#94a3b8' },
} as const

export function StepCard(props: { step: Step; misconceptionLabel: string | null; explanation: string | null }) {
  const v = VERDICT[props.step.verdict]
  const expanded = props.step.verdict === 'wrong' || props.step.verdict === 'suspect'
  return (
    <View style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: v.color }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Text style={{ color: v.color, fontSize: 18, width: 24 }}>{v.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#e2e8f0', fontSize: 15 }}>{props.step.plain}</Text>
          <Text style={{ color: '#64748b', fontFamily: 'Courier', fontSize: 12, marginTop: 2 }}>{props.step.latex}</Text>
        </View>
      </View>
      {expanded && (
        <View style={{ marginTop: 10, gap: 4 }}>
          {props.misconceptionLabel && (
            <Text style={{ color: v.color, fontWeight: '700', fontSize: 13 }}>{props.misconceptionLabel}</Text>
          )}
          {props.explanation && <Text style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 20 }}>{props.explanation}</Text>}
        </View>
      )}
    </View>
  )
}
