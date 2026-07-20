import type OpenAI from 'openai'
import {
  MISCONCEPTION_TAGS,
  Stage2Schema,
  type MisconceptionTag,
  type Stage2Result,
  type TranscribedStep,
} from '@snap/shared'
import { callModelJson } from '../llm/client.js'

const TAG_DEFINITIONS: Record<MisconceptionTag, string> = {
  'sign-error': 'a positive or negative sign changes incorrectly while carrying or evaluating a term',
  'dropped-term': 'a nonzero term or factor from the prior work is omitted',
  'distribution-error': 'multiplication is distributed incorrectly across a sum or difference',
  'chain-rule-missed': 'a composite derivative omits or misuses the inner derivative',
  'product-rule-misapplied': 'the derivative rule for a product is set up or applied incorrectly',
  'integration-by-parts-error': 'integration by parts uses or recombines u, dv, du, or v incorrectly',
  'u-sub-bounds-error': 'definite-integral bounds are not converted or used correctly after substitution',
  'algebraic-slip': 'a routine arithmetic or algebraic manipulation goes wrong after the method or formula was chosen correctly',
  'exponent-rule-error': 'an exponent or power law is applied incorrectly',
  'equals-abuse': 'an equals sign claims equality between expressions that are not equal',
  'notation-error': 'written symbols change mathematical meaning, such as 6x becoming 6^x or 2x^2 becoming 2x',
  'formula-misapplied': 'a known formula is selected, oriented, or substituted into incorrectly; not a routine algebraic-slip after choosing the formula correctly',
  other: 'a substantive mathematical error that does not fit any definition above',
}

const TAG_GUIDE = MISCONCEPTION_TAGS
  .map((tag) => `  - ${tag}: ${TAG_DEFINITIONS[tag]}`)
  .join('\n')

const SYSTEM = `You are a calculus/algebra tutor diagnosing a student's transcribed work, step by step.

Re-derive the solution yourself. Find the FIRST step that is mathematically incorrect given the steps before it.

Respond with ONLY a JSON object:
{"errorStepIndex": number|null, "misconceptionTag": string|null, "explanation": string|null, "followUp": {"problem": string, "concept": string}|null}

Rules:
- If every step is correct: all four fields null. NEVER invent an error to seem useful.
- "misconceptionTag" MUST use this controlled vocabulary and its boundaries:
${TAG_GUIDE}
- Use "other" only when no more specific definition fits.
- "explanation": 2-3 sentences, spoken directly to the student. Name what they believed ("you treated d/dx as applying to each factor separately") and why it breaks. No scolding.
- "followUp": ONE slightly easier problem exercising the same concept, plus a 2-4 word concept label.
- Harmless notation quirks, skipped-but-valid shortcuts, equivalent forms, and unsimplified answers are not errors. Use notation-error only when the written notation changes mathematical meaning.`

export async function analyzeSteps(
  client: OpenAI,
  model: string,
  steps: TranscribedStep[],
): Promise<Stage2Result> {
  const rendered = steps
    .map((s) => `Step ${s.index}: ${s.latex}   (${s.plain})`)
    .join('\n')
  return callModelJson({
    client, model, system: SYSTEM, schema: Stage2Schema, maxTokens: 1500,
    content: [{ type: 'text', text: `Student's work:\n${rendered}` }],
  })
}
