import type OpenAI from 'openai'
import {
  FollowUpSchema,
  type AlternateFollowUpContext,
  type FollowUp,
} from '@snap/shared'
import { callModelJson } from '../llm/client.js'

export type GenerateFollowUpFn = (context: AlternateFollowUpContext) => Promise<FollowUp>

const SYSTEM = `You are a calculus/algebra tutor creating a fresh practice problem after a diagnosis.

Respond with ONLY a JSON object:
{"problem": string, "concept": string, "hint": string}

Rules:
- Create one slightly easier problem that exercises the same concept.
- The new problem must differ from every previous problem supplied by the student. Do not repeat, rephrase, or make only cosmetic changes to a previous problem.
- Copy the supplied Concept label exactly, including its capitalization and spacing.
- Include one hint that makes the first productive move clearer without solving the problem.
- Write problem and hint in student-facing Unicode math with no raw LaTeX, math delimiters, or caret notation. Use polished Unicode symbols such as ∫, √, ×, ÷, −, eˣ, and x²; if Unicode is impractical, use clear prose.`

function renderContext(context: AlternateFollowUpContext): string {
  return `Concept: ${context.concept}\nDiagnosis: ${context.diagnosis}\nPrevious problems (the new problem must differ from all of these):\n${context.previousProblems.map((problem, index) => `${index + 1}. ${problem}`).join('\n')}`
}

function normalizeProblem(problem: string): string {
  return problem.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

function normalizeConceptIdentity(concept: string): string {
  return concept.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

export async function generateFollowUp(
  client: OpenAI,
  model: string,
  context: AlternateFollowUpContext,
): Promise<FollowUp> {
  const previousProblems = new Set(context.previousProblems.map(normalizeProblem))
  const schema = FollowUpSchema.superRefine((followUp, issue) => {
    if (previousProblems.has(normalizeProblem(followUp.problem)))
      issue.addIssue({ code: 'custom', path: ['problem'], message: 'problem must differ from previous problems' })
    if (normalizeConceptIdentity(followUp.concept) !== normalizeConceptIdentity(context.concept))
      issue.addIssue({ code: 'custom', path: ['concept'], message: 'concept must match the requested concept' })
  })
  const followUp = await callModelJson({
    client,
    model,
    system: SYSTEM,
    schema,
    maxTokens: 600,
    content: [{ type: 'text', text: renderContext(context) }],
  })
  return { ...followUp, concept: context.concept }
}

export function makeGenerateFollowUp(client: OpenAI, model: string): GenerateFollowUpFn {
  return (context) => generateFollowUp(client, model, context)
}
