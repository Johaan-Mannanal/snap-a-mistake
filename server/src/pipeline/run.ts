import type OpenAI from 'openai'
import type { AnalyzeResponse, Step, TranscribedStep } from '@snap/shared'
import { ModelJsonError } from '../llm/client.js'
import type { Config } from '../config.js'
import type { RunAnalysisFn } from '../app.js'
import { transcribe } from './stage1.js'
import { verifyTranscription } from './transcription-verifier.js'
import { analyzeSteps } from './stage2.js'
import { verifyDiagnosis } from './verifier.js'

export const RETAKE_TIPS = [
  'Get more light on the page',
  'Flatten the page and shoot from directly above',
  'Fit just one problem in the frame',
]

type Deps = {
  transcribe: typeof transcribe
  verifyTranscription: typeof verifyTranscription
  analyzeSteps: typeof analyzeSteps
  verifyDiagnosis: typeof verifyDiagnosis
}

export type StageTiming = {
  stage: 'transcription' | 'transcription-verification' | 'analysis' | 'verification'
  status: 'completed' | 'failed'
  durationMs: number
}

async function timeStage<T>(
  stage: StageTiming['stage'],
  work: () => Promise<T>,
  onTiming: (timing: StageTiming) => void,
): Promise<T> {
  const startedAt = Date.now()
  try {
    const result = await work()
    onTiming({ stage, status: 'completed', durationMs: Date.now() - startedAt })
    return result
  } catch (error) {
    onTiming({ stage, status: 'failed', durationMs: Date.now() - startedAt })
    throw error
  }
}

export function withVerdicts(steps: TranscribedStep[], errorIndex: number | null, verifierAgreed: boolean): Step[] {
  const errorPosition = errorIndex === null
    ? null
    : steps.findIndex((step) => step.index === errorIndex)
  return steps.map((s, position) => ({
    ...s,
    verdict:
      errorPosition === null ? 'ok'
      : position < errorPosition ? 'ok'
      : position === errorPosition ? (verifierAgreed ? 'wrong' : 'suspect')
      : 'downstream',
  }))
}

export function makeRunAnalysis(
  client: OpenAI,
  config: Config,
  deps: Deps = { transcribe, verifyTranscription, analyzeSteps, verifyDiagnosis },
  onStageTiming: (timing: StageTiming) => void = () => {},
): RunAnalysisFn {
  return async (image, options = {}) => {
    const s1 = await timeStage(
      'transcription',
      () => deps.transcribe(client, config.models.vision, image),
      onStageTiming,
    )
    if (!s1.isMath) return { kind: 'not-math' }
    if (s1.steps.length === 0)
      return { kind: 'unreadable', tips: RETAKE_TIPS }

    const transcriptionCheck = await timeStage(
      'transcription-verification',
      () => deps.verifyTranscription(client, config.models.vision, image, s1.steps),
      onStageTiming,
    )
    if (
      !options.allowUncertainTranscript
      && (!transcriptionCheck.faithful || !transcriptionCheck.legible)
    )
      return { kind: 'unreadable', tips: RETAKE_TIPS }

    const s2 = await timeStage(
      'analysis',
      () => deps.analyzeSteps(client, config.models.analysis, s1.steps),
      onStageTiming,
    )

    const errorStepIndex = s2.errorStepIndex
    if (errorStepIndex === null) {
      return {
        kind: 'analysis', steps: withVerdicts(s1.steps, null, true),
        errorStepIndex: null, misconceptionTag: null, explanation: null,
        followUp: null, verifierAgreed: true,
      } satisfies AnalyzeResponse
    }

    if (!s1.steps.some((s) => s.index === errorStepIndex))
      throw new ModelJsonError(`stage 2 flagged nonexistent step ${errorStepIndex}`)

    const v = await timeStage(
      'verification',
      () => deps.verifyDiagnosis(client, config.models.verifier, s1.steps, {
        errorStepIndex,
        explanation: s2.explanation ?? '',
      }),
      onStageTiming,
    )

    return {
      kind: 'analysis', steps: withVerdicts(s1.steps, errorStepIndex, v.agrees),
      errorStepIndex, misconceptionTag: s2.misconceptionTag,
      explanation: s2.explanation, followUp: s2.followUp, verifierAgreed: v.agrees,
    } satisfies AnalyzeResponse
  }
}
