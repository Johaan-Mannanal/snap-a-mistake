import type { AnalyzeResponse, Step } from '@snap/shared'
import { tagLabel } from '../lib/labels'
import { colors } from './theme'

const ORDINAL = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'] as const

export function cameraPresentation(isRetry: boolean) {
  return { eyebrow: isRetry ? 'FOLLOW-UP' : 'SNAP', instruction: 'Keep one problem inside the frame' } as const
}

export function cameraPermissionPresentation(permission: { granted: boolean; canAskAgain: boolean } | null) {
  if (!permission) {
    return {
      state: 'loading' as const,
      title: 'Checking camera access',
      detail: 'You can still choose a photo from your library.',
      primaryLabel: null,
    }
  }
  if (permission.canAskAgain) {
    return {
      state: 'requestable' as const,
      title: 'Camera access',
      detail: 'Use the camera to capture one problem at a time.',
      primaryLabel: 'Allow camera' as const,
    }
  }
  return {
    state: 'blocked' as const,
    title: 'Camera access is off',
    detail: 'Turn on Camera access in Settings, or choose a photo from your library.',
    primaryLabel: 'Open Settings' as const,
  }
}

export function trendPresentation(trend: 'fewer' | 'more' | 'same') {
  if (trend === 'fewer') return { label: 'Improving', color: colors.success, symbol: '↗' } as const
  if (trend === 'more') return { label: 'Needs attention', color: colors.error, symbol: '↘' } as const
  return { label: 'Steady', color: colors.muted, symbol: '→' } as const
}

export function analysisPresentation(response: Extract<AnalyzeResponse, { kind: 'analysis' }>) {
  if (response.errorStepIndex === null) {
    return { tone: 'success' as const, eyebrow: 'VERIFIED', headline: 'All steps check out', detail: 'Every step follows from the last.' }
  }
  const step = ORDINAL[response.errorStepIndex] ?? String(response.errorStepIndex + 1)
  if (!response.verifierAgreed) {
    return { tone: 'neutral' as const, eyebrow: 'SECOND LOOK', headline: `Step ${step} needs a second look.`, detail: response.explanation ?? '' }
  }
  return {
    tone: 'error' as const,
    eyebrow: response.misconceptionTag ? tagLabel(response.misconceptionTag).toUpperCase() : 'FIRST BREAK',
    headline: `The first break is in step ${step}.`,
    detail: response.explanation ?? '',
  }
}

export function analysisStagePresentation(label: string, index: number, currentStage: number) {
  const status = index < currentStage ? 'completed' : index === currentStage ? 'current' : 'upcoming'
  const mark = status === 'completed' ? '✓' : status === 'current' ? '●' : '○'
  return { status, mark, accessibilityLabel: `${label}, ${status}` }
}

const VERDICT_LABEL: Record<Step['verdict'], string> = {
  ok: 'correct',
  wrong: 'incorrect',
  suspect: 'needs a second look',
  downstream: 'downstream from the first issue',
}

function accessibilitySentence(label: string, value: string) {
  const copy = value.trim()
  return `${label}: ${copy}${/[.!?]$/.test(copy) ? '' : '.'}`
}

export function stepAccessibilityLabel(step: Step, misconceptionLabel: string | null, explanation: string | null) {
  const expanded = step.verdict === 'wrong' || step.verdict === 'suspect'
  const sentences = [
    `Step ${step.index + 1}, ${VERDICT_LABEL[step.verdict]}.`,
    accessibilitySentence('Work', step.plain),
    accessibilitySentence('LaTeX', step.latex),
  ]
  if (expanded && misconceptionLabel) sentences.push(accessibilitySentence('Misconception', misconceptionLabel))
  if (expanded && explanation) sentences.push(accessibilitySentence('Explanation', explanation))
  return sentences.join(' ')
}
