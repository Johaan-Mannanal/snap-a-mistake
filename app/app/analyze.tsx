import { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import type { AnalyzeResponse } from '@snap/shared'
import { analyzePhoto } from '../src/lib/api'
import { getSession, setAnalysis, resetSession } from '../src/lib/session'
import { recordAnalysis } from '../src/lib/history'
import { tagLabel } from '../src/lib/labels'
import { AppButton } from '../src/components/AppButton'
import { AppIcon } from '../src/components/AppIcon'
import { AppScreen } from '../src/components/AppScreen'
import { AnalysisProgress } from '../src/components/AnalysisProgress'
import { StepCard } from '../src/components/StepCard'
import { PhotoOverlay } from '../src/components/PhotoOverlay'
import { analysisPresentation } from '../src/ui/presentation'
import { colors, spacing } from '../src/ui/theme'

const STAGES = ['Reading your handwriting…', 'Checking each step…', 'Verifying the diagnosis…']

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
          recordAnalysis({ tag: r.misconceptionTag, correct: r.errorStepIndex === null }).catch(() => {})
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

  const snapAnother = () => { resetSession(); router.dismissTo('/') }

  if (failed) {
    return (
      <AppScreen contentStyle={styles.stateContent}>
        <View style={styles.stateCopy}>
          <Text style={styles.stateEyebrow}>ANALYSIS PAUSED</Text>
          <Text style={styles.stateTitle}>We couldn't reach the tutor.</Text>
          <Text style={styles.stateDetail}>Your photo is saved. Check your connection and try again.</Text>
        </View>
        <AppButton label="Try again" onPress={run} />
        <AppButton label="Use another photo" onPress={snapAnother} variant="secondary" />
      </AppScreen>
    )
  }

  if (!result) {
    return uri ? <AnalysisProgress uri={uri} stage={stage} stages={STAGES} /> : null
  }

  if (result.kind === 'not-math') {
    return (
      <AppScreen contentStyle={styles.stateContent}>
        <View style={styles.stateCopy}>
          <Text style={styles.stateEyebrow}>NOT MATH</Text>
          <Text style={styles.stateTitle}>This photo doesn't look like math.</Text>
          <Text style={styles.stateDetail}>Snap a photo of handwritten algebra or calculus work.</Text>
        </View>
        <AppButton label="Retake" onPress={snapAnother} />
      </AppScreen>
    )
  }

  if (result.kind === 'unreadable') {
    return (
      <AppScreen contentStyle={styles.stateContent}>
        <View style={styles.stateCopy}>
          <Text style={styles.stateEyebrow}>UNREADABLE</Text>
          <Text style={styles.stateTitle}>This photo is too hard to read.</Text>
          <View style={styles.tips}>
            {result.tips.map((tip) => <Text key={tip} style={styles.tip}>— {tip}</Text>)}
          </View>
        </View>
        <AppButton label="Retake" onPress={snapAnother} />
      </AppScreen>
    )
  }

  const correct = result.errorStepIndex === null
  const label = result.misconceptionTag ? tagLabel(result.misconceptionTag) : null
  const presentation = analysisPresentation(result)

  return (
    <AppScreen contentStyle={styles.resultContent}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Return to camera"
          hitSlop={8}
          onPress={snapAnother}
          style={({ pressed }) => [styles.topAction, { opacity: pressed ? 0.5 : 1 }]}
        >
          <AppIcon name="camera" fallback="Camera" size={18} />
        </Pressable>
        <Text style={styles.topTitle}>Analysis</Text>
        <View style={styles.topAction} />
      </View>
      {uri && <PhotoOverlay uri={uri} steps={result.steps} />}
      <View style={styles.diagnosis}>
        {presentation.tone === 'success' ? (
          <View style={styles.verifiedLine}>
            <Text style={styles.verifiedMark}>✓</Text>
            <Text style={styles.headline}>{presentation.headline}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.diagnosisEyebrow}>{presentation.eyebrow}</Text>
            <Text style={styles.headline}>{presentation.headline}</Text>
          </>
        )}
        <Text style={styles.diagnosisDetail}>{presentation.detail}</Text>
      </View>
      <View style={styles.timeline}>
        {result.steps.map((s) => (
          <StepCard
            key={s.index}
            step={s}
            misconceptionLabel={s.index === result.errorStepIndex ? label : null}
            explanation={s.index === result.errorStepIndex ? result.explanation : null}
          />
        ))}
      </View>
      <View style={styles.actions}>
        {result.followUp && !correct ? <AppButton label="Try a simpler problem" onPress={() => router.push('/followup')} /> : null}
        <AppButton label="Video lesson — coming soon" disabled variant="secondary" />
        <AppButton label="Snap another" onPress={snapAnother} variant="tertiary" />
      </View>
    </AppScreen>
  )
}

const styles = StyleSheet.create({
  stateContent: { flexGrow: 1, justifyContent: 'center' },
  stateCopy: { gap: spacing.md, marginBottom: spacing.lg },
  stateEyebrow: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  stateTitle: { color: colors.chalk, fontSize: 28, fontWeight: '700', letterSpacing: -0.7, lineHeight: 34 },
  stateDetail: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  tips: { gap: spacing.sm, marginTop: spacing.xs },
  tip: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  resultContent: { paddingTop: spacing.xs },
  topBar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topAction: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  topTitle: { color: colors.chalk, fontSize: 15, fontWeight: '700' },
  diagnosis: { gap: spacing.sm, paddingVertical: spacing.md },
  diagnosisEyebrow: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  verifiedLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  verifiedMark: { color: colors.success, fontSize: 15, fontWeight: '800' },
  headline: { flexShrink: 1, color: colors.chalk, fontSize: 24, fontWeight: '700', letterSpacing: -0.5, lineHeight: 30 },
  diagnosisDetail: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  timeline: { marginTop: spacing.xs },
  actions: { gap: spacing.md, marginTop: spacing.sm },
})
