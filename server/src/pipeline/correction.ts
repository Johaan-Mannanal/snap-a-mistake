import type OpenAI from 'openai'
import {
  CorrectedDiagnosisSchema,
  type AnalyzeResponse,
  type CorrectionContext,
} from '@snap/shared'
import type { Config } from '../config.js'
import { ModelJsonError, callModelJson } from '../llm/client.js'
import { withVerdicts } from './run.js'
import { verifyDiagnosis } from './verifier.js'

export type RunCorrectionFn = (
  image: { base64: string; mediaType: 'image/jpeg' },
  context: CorrectionContext,
) => Promise<AnalyzeResponse>

const SYSTEM = `You are a calculus/algebra tutor revising a diagnosis after a student selects a different step.

The selected step is fixed. Treat it as the FIRST logical break and explain why it is the first break given every preceding step. Do not choose another step or claim that all work is correct.

Respond with ONLY a JSON object:
{"misconceptionTag": string, "explanation": string, "followUp": {"problem": string, "concept": string, "hint": string}}

Rules:
- Return only those three fields.
- misconceptionTag must use the supplied controlled vocabulary.
- explanation: 2-3 sentences, spoken directly to the student. Name what they believed and why it breaks. No scolding.
- followUp: one slightly easier problem on the same concept, a 2-4 word concept label, and one concise hint.
- Write explanation, followUp.problem, and followUp.hint as readable plain text with polished Unicode math symbols where useful, for example ∫, √, ×, ÷, −, eˣ, and x².
- Never use LaTeX commands, math delimiters, or caret notation such as \\frac, \\int, \\(…\\), $, e^x, or x^2 in those fields. If Unicode is impractical, use clear prose.`

function renderContext(context: CorrectionContext): string {
  const steps = context.analysis.steps
    .map((step) => `Step ID ${step.index}: ${step.latex}   (${step.plain})`)
    .join('\n')
  return `Student's work:\n${steps}\n\nSelected first logical break: step ID ${context.selectedStepIndex}\n\nControlled misconception tags: sign-error, dropped-term, distribution-error, chain-rule-missed, product-rule-misapplied, integration-by-parts-error, u-sub-bounds-error, algebraic-slip, exponent-rule-error, equals-abuse, notation-error, formula-misapplied, other.`
}

export function makeRunCorrection(client: OpenAI, config: Config): RunCorrectionFn {
  return async (image, context) => {
    const selectedStep = context.analysis.steps.find((step) => step.index === context.selectedStepIndex)
    if (!selectedStep)
      throw new ModelJsonError(`selected step ${context.selectedStepIndex} is absent from the analysis`)

    const diagnosis = await callModelJson({
      client,
      model: config.models.analysis,
      system: SYSTEM,
      schema: CorrectedDiagnosisSchema,
      maxTokens: 1500,
      content: [
        { type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.base64}` } },
        { type: 'text', text: renderContext(context) },
      ],
    })
    const verifier = await verifyDiagnosis(client, config.models.verifier, context.analysis.steps, {
      errorStepIndex: context.selectedStepIndex,
      explanation: diagnosis.explanation,
    })

    return {
      kind: 'analysis',
      steps: withVerdicts(context.analysis.steps, context.selectedStepIndex, verifier.agrees),
      errorStepIndex: context.selectedStepIndex,
      misconceptionTag: diagnosis.misconceptionTag,
      explanation: diagnosis.explanation,
      followUp: diagnosis.followUp,
      verifierAgreed: verifier.agrees,
    } satisfies AnalyzeResponse
  }
}
