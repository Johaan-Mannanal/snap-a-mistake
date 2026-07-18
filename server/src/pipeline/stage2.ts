import type Anthropic from '@anthropic-ai/sdk'
import { MISCONCEPTION_TAGS, Stage2Schema, type Stage2Result, type TranscribedStep } from '@snap/shared'
import { callClaudeJson } from '../claude/client.js'

const SYSTEM = `You are a calculus/algebra tutor diagnosing a student's transcribed work, step by step.

Re-derive the solution yourself. Find the FIRST step that is mathematically incorrect given the steps before it.

Respond with ONLY a JSON object:
{"errorStepIndex": number|null, "misconceptionTag": string|null, "explanation": string|null, "followUp": {"problem": string, "concept": string}|null}

Rules:
- If every step is correct: all four fields null. NEVER invent an error to seem useful.
- "misconceptionTag" MUST be one of: ${MISCONCEPTION_TAGS.join(', ')}. Use "other" only when nothing else fits.
- "explanation": 2-3 sentences, spoken directly to the student. Name what they believed ("you treated d/dx as applying to each factor separately") and why it breaks. No scolding.
- "followUp": ONE slightly easier problem exercising the same concept, plus a 2-4 word concept label.
- Notation quirks, skipped-but-valid shortcuts, and unsimplified answers are NOT errors.`

export async function analyzeSteps(
  client: Anthropic,
  model: string,
  steps: TranscribedStep[],
): Promise<Stage2Result> {
  const rendered = steps
    .map((s) => `Step ${s.index}: ${s.latex}   (${s.plain})`)
    .join('\n')
  return callClaudeJson({
    client, model, system: SYSTEM, schema: Stage2Schema, maxTokens: 1500,
    content: [{ type: 'text', text: `Student's work:\n${rendered}` }],
  })
}
