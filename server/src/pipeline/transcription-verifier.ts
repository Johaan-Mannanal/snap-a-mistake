import type OpenAI from 'openai'
import type { TranscribedStep } from '@snap/shared'
import { z } from 'zod'
import { callModelJson } from '../llm/client.js'

const TranscriptionVerificationSchema = z.object({
  faithful: z.boolean(),
  legible: z.boolean(),
  note: z.string(),
})

export type TranscriptionVerification = z.infer<typeof TranscriptionVerificationSchema>

const SYSTEM = `You independently audit a proposed transcription of photographed handwritten math.

Respond with ONLY a JSON object:
{"faithful": boolean, "legible": boolean, "note": string}

Compare every proposed line and symbol against marks that are actually visible in the image.
- "faithful" is true only when the transcript preserves the student's visible work exactly, including mistakes, omissions, crossed-out work, signs, factors, and operators.
- "legible" is true only when every important line and symbol needed to judge the solution can be read confidently.
- Do not repair, complete, simplify, or infer a mathematically expected line.
- A plausible or mathematically correct transcript is not evidence that it matches the photograph.
- If the photo is blurred, faint, cropped, obstructed, or a symbol is ambiguous, set legible to false.
- If any proposed text appears reconstructed, corrected, or unsupported by visible ink, set faithful to false.
- When uncertain, set the relevant boolean to false.
- Keep "note" short and identify the first uncertainty or mismatch.`

export async function verifyTranscription(
  client: OpenAI,
  model: string,
  image: { base64: string; mediaType: 'image/jpeg' },
  steps: TranscribedStep[],
): Promise<TranscriptionVerification> {
  return callModelJson({
    client,
    model,
    system: SYSTEM,
    schema: TranscriptionVerificationSchema,
    maxTokens: 700,
    content: [
      { type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.base64}` } },
      {
        type: 'text',
        text: `Audit this proposed transcript against the photograph:\n${JSON.stringify(steps)}`,
      },
    ],
  })
}
