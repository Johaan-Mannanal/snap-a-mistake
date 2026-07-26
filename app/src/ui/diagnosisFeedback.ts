import type { AnalyzeResponse, Step } from '@snap/shared'
import type { ApiFailure } from '../lib/api'

type AnalysisResponse = Extract<AnalyzeResponse, { kind: 'analysis' }>
export type CorrectionFailure = ApiFailure | { kind: 'storage' }

export const DIAGNOSIS_FEEDBACK_PROMPT = 'Is this the right first break?'

export function canRequestDiagnosisFeedback(response: AnalyzeResponse): response is AnalysisResponse {
  return response.kind === 'analysis' && response.errorStepIndex !== null
}

export function isDurableFeedbackAvailable(
  response: AnalyzeResponse,
  state: { revisionId: string | null; isSaving: boolean; unsaved: boolean },
): response is AnalysisResponse {
  return canRequestDiagnosisFeedback(response) && state.revisionId !== null && !state.isSaving && !state.unsaved
}

export function correctionStepOptions(response: AnalysisResponse): { index: number; label: string }[] {
  return response.steps.map((step, position) => ({ index: step.index, label: readableStep(step, position + 1) }))
}

function readableStep(step: Step, ordinal: number): string {
  const text = step.plain.trim() || 'Recognized work'
  return `Step ${ordinal}: ${text}`
}

export function synthesizeAllCorrectResponse(response: AnalysisResponse): AnalysisResponse {
  return {
    ...response,
    steps: response.steps.map((step) => ({ ...step, verdict: 'ok' })),
    errorStepIndex: null,
    misconceptionTag: null,
    explanation: null,
    followUp: null,
    verifierAgreed: true,
  }
}

export function correctionFailurePresentation(failure: CorrectionFailure) {
  if (failure.kind === 'storage')
    return { title: 'We couldn’t save your feedback.', detail: 'Your diagnosis is unchanged. Check local storage and try again.', retryLabel: 'Retry saving', cancelLabel: 'Back to result' }
  if (failure.kind === 'cancelled')
    return { title: 'Correction cancelled.', detail: 'Your current diagnosis is unchanged.', retryLabel: 'Try again', cancelLabel: 'Back to result' }
  if (failure.kind === 'timeout')
    return { title: 'The revised diagnosis took too long.', detail: 'Your current diagnosis is unchanged.', retryLabel: 'Try again', cancelLabel: 'Cancel' }
  if (failure.kind === 'network')
    return { title: 'We couldn’t reach the tutor.', detail: 'Your current diagnosis is unchanged.', retryLabel: 'Try again', cancelLabel: 'Cancel' }
  if (failure.kind === 'server')
    return { title: 'The tutor is unavailable right now.', detail: 'Your current diagnosis is unchanged.', retryLabel: 'Try again', cancelLabel: 'Cancel' }
  return { title: 'We received an incomplete revised diagnosis.', detail: 'Your current diagnosis is unchanged.', retryLabel: 'Try again', cancelLabel: 'Cancel' }
}
