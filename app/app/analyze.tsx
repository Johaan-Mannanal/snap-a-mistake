import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import type { AnalyzeResponse } from '@snap/shared'
import { ApiError, analyzePhoto } from '../src/lib/api'
import { getSession, setAnalysis, startFollowUp, resetSession } from '../src/lib/session'
import { recordAnalysis } from '../src/lib/history'
import { tagLabel } from '../src/lib/labels'
import { Screen } from '../src/components/Screen'
import { StepCard } from '../src/components/StepCard'
import { PhotoOverlay } from '../src/components/PhotoOverlay'

const STAGES = ['Reading your handwriting…', 'Checking each step…', 'Verifying the diagnosis…']

function Button(props: { label: string; onPress?: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={{
        backgroundColor: props.disabled ? '#334155' : props.primary ? '#6366f1' : '#1e293b',
        borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: props.disabled ? 0.6 : 1,
      }}
    >
      <Text style={{ color: props.disabled ? '#94a3b8' : 'white', fontWeight: '700', fontSize: 15 }}>{props.label}</Text>
    </Pressable>
  )
}

export default function Analyze() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [failed, setFailed] = useState(false)
  const [stage, setStage] = useState(0)
  const uri = getSession().photoUri

  const run = useCallback(() => {
    if (!uri) { router.replace('/'); return }
    setFailed(false)
    setResult(null)
    setStage(0)
    analyzePhoto(uri)
      .then((r) => {
        setAnalysis(r)
        setResult(r)
        if (r.kind === 'analysis') {
          void recordAnalysis({ tag: r.misconceptionTag, correct: r.errorStepIndex === null })
        }
      })
      .catch((e: unknown) => {
        void e
        setFailed(true)
      })
  }, [uri])

  useEffect(run, [run])
  useEffect(() => {
    if (result || failed) return
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 3000)
    return () => clearInterval(t)
  }, [result, failed])

  const snapAnother = () => { resetSession(); router.replace('/') }

  if (failed) {
    return (
      <Screen>
        <Text style={{ color: '#e2e8f0', fontSize: 20, fontWeight: '700' }}>Couldn't reach the tutor 😕</Text>
        <Text style={{ color: '#94a3b8' }}>Your photo is saved — check your connection and try again.</Text>
        <Button label="Try again" onPress={run} primary />
        <Button label="Snap another" onPress={snapAnother} />
      </Screen>
    )
  }

  if (!result) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', marginTop: 120, gap: 20 }}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={{ color: '#e2e8f0', fontSize: 17 }}>{STAGES[stage]}</Text>
        </View>
      </Screen>
    )
  }

  if (result.kind === 'not-math') {
    return (
      <Screen>
        <Text style={{ color: '#e2e8f0', fontSize: 20, fontWeight: '700' }}>I only speak math for now 📐</Text>
        <Text style={{ color: '#94a3b8' }}>Snap a photo of handwritten algebra or calculus work.</Text>
        <Button label="Retake" onPress={snapAnother} primary />
      </Screen>
    )
  }

  if (result.kind === 'unreadable') {
    return (
      <Screen>
        <Text style={{ color: '#e2e8f0', fontSize: 20, fontWeight: '700' }}>I couldn't read that clearly</Text>
        {result.tips.map((tip) => (
          <Text key={tip} style={{ color: '#94a3b8', fontSize: 15 }}>• {tip}</Text>
        ))}
        <Button label="Retake" onPress={snapAnother} primary />
      </Screen>
    )
  }

  const correct = result.errorStepIndex === null
  const suspect = !correct && !result.verifierAgreed
  const label = result.misconceptionTag ? tagLabel(result.misconceptionTag) : null

  return (
    <Screen>
      {correct ? (
        <View style={{ backgroundColor: '#14532d', borderRadius: 12, padding: 16 }}>
          <Text style={{ color: '#86efac', fontSize: 20, fontWeight: '800' }}>All steps check out ✓</Text>
          <Text style={{ color: '#bbf7d0', marginTop: 4 }}>Every step follows from the last — clean work.</Text>
        </View>
      ) : suspect ? (
        <View style={{ backgroundColor: '#451a03', borderRadius: 12, padding: 16 }}>
          <Text style={{ color: '#fbbf24', fontSize: 17, fontWeight: '700' }}>
            I'm not fully sure about step {result.errorStepIndex} — want to walk through it?
          </Text>
        </View>
      ) : null}
      {uri && <PhotoOverlay uri={uri} steps={result.steps} />}
      {result.steps.map((s) => (
        <StepCard
          key={s.index}
          step={s}
          misconceptionLabel={s.index === result.errorStepIndex ? label : null}
          explanation={s.index === result.errorStepIndex ? result.explanation : null}
        />
      ))}
      {result.followUp && !correct && (
        <Button label="Try a follow-up" onPress={() => router.push('/followup')} primary />
      )}
      <Button label="🎬 Video lesson — coming soon" disabled />
      <Button label="Snap another" onPress={snapAnother} />
    </Screen>
  )
}
