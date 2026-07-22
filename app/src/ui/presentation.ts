import type { AnalyzeResponse } from '@snap/shared'
import { tagLabel } from '../lib/labels'

const ORDINAL = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'] as const

export function cameraPresentation(isRetry: boolean) {
  return { eyebrow: isRetry ? 'FOLLOW-UP' : 'SNAP', instruction: 'Keep one problem inside the frame' } as const
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
