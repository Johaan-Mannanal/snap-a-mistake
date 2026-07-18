import type Anthropic from '@anthropic-ai/sdk'
import { VerifierSchema, type TranscribedStep, type VerifierResult } from '@snap/shared'
import { callClaudeJson } from '../claude/client.js'

const SYSTEM = `You audit another tutor's diagnosis of a student's math work. You are the last line of defense against FALSELY accusing correct work.

Independently check ONE thing: is the flagged step actually mathematically invalid given the steps before it?

Respond with ONLY: {"agrees": boolean, "note": string}
- agrees=false if the flagged step is actually valid, or the real first error is a different step.
- note: one sentence of reasoning.`

export async function verifyDiagnosis(
  client: Anthropic,
  model: string,
  steps: TranscribedStep[],
  diagnosis: { errorStepIndex: number; explanation: string },
): Promise<VerifierResult> {
  const rendered = steps.map((s) => `Step ${s.index}: ${s.latex}`).join('\n')
  return callClaudeJson({
    client, model, system: SYSTEM, schema: VerifierSchema, maxTokens: 400,
    content: [{
      type: 'text',
      text: `Work:\n${rendered}\n\nClaimed first error: step ${diagnosis.errorStepIndex} — "${diagnosis.explanation}"`,
    }],
  })
}
