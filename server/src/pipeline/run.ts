import type Anthropic from '@anthropic-ai/sdk'
import type { AnalyzeResponse, Step, TranscribedStep } from '@snap/shared'
import { ClaudeJsonError } from '../claude/client.js'
import type { Config } from '../config.js'
import type { RunAnalysisFn } from '../app.js'
import { transcribe } from './stage1.js'
import { analyzeSteps } from './stage2.js'
import { verifyDiagnosis } from './verifier.js'

export const RETAKE_TIPS = [
  'Get more light on the page',
  'Flatten the page and shoot from directly above',
  'Fit just one problem in the frame',
]

type Deps = {
  transcribe: typeof transcribe
  analyzeSteps: typeof analyzeSteps
  verifyDiagnosis: typeof verifyDiagnosis
}

function withVerdicts(steps: TranscribedStep[], errorIndex: number | null, verifierAgreed: boolean): Step[] {
  return steps.map((s) => ({
    ...s,
    verdict:
      errorIndex === null ? 'ok'
      : s.index < errorIndex ? 'ok'
      : s.index === errorIndex ? (verifierAgreed ? 'wrong' : 'suspect')
      : 'downstream',
  }))
}

export function makeRunAnalysis(
  client: Anthropic,
  config: Config,
  deps: Deps = { transcribe, analyzeSteps, verifyDiagnosis },
): RunAnalysisFn {
  return async (image) => {
    const s1 = await deps.transcribe(client, config.models.vision, image)
    if (!s1.isMath) return { kind: 'not-math' }
    if (s1.legibility < config.legibilityThreshold || s1.steps.length === 0)
      return { kind: 'unreadable', tips: RETAKE_TIPS }

    const s2 = await deps.analyzeSteps(client, config.models.analysis, s1.steps)

    if (s2.errorStepIndex === null) {
      return {
        kind: 'analysis', steps: withVerdicts(s1.steps, null, true),
        errorStepIndex: null, misconceptionTag: null, explanation: null,
        followUp: null, verifierAgreed: true,
      } satisfies AnalyzeResponse
    }

    if (!s1.steps.some((s) => s.index === s2.errorStepIndex))
      throw new ClaudeJsonError(`stage 2 flagged nonexistent step ${s2.errorStepIndex}`)

    const v = await deps.verifyDiagnosis(client, config.models.verifier, s1.steps, {
      errorStepIndex: s2.errorStepIndex,
      explanation: s2.explanation ?? '',
    })

    return {
      kind: 'analysis', steps: withVerdicts(s1.steps, s2.errorStepIndex, v.agrees),
      errorStepIndex: s2.errorStepIndex, misconceptionTag: s2.misconceptionTag,
      explanation: s2.explanation, followUp: s2.followUp, verifierAgreed: v.agrees,
    } satisfies AnalyzeResponse
  }
}
