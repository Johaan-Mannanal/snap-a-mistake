import type OpenAI from 'openai'
import { Stage1Schema, type Stage1Result } from '@snap/shared'
import { callModelJson } from '../llm/client.js'

const SYSTEM = `You transcribe photographed handwritten math work (algebra/calculus) into discrete solution steps.

Respond with ONLY a JSON object:
{"isMath": boolean, "legibility": number, "steps": [{"index": number, "latex": string, "plain": string, "yBandTopPct": number, "yBandBottomPct": number}]}

Rules:
- One step per written line/equation, index 0 at the top, increasing downward.
- "latex": the line as LaTeX. "plain": the same line in plain English words.
- yBandTopPct/yBandBottomPct: vertical position of that line as percentages of full image height (0 = top edge, 100 = bottom edge). Bands may not overlap.
- "legibility": 0..1 — your confidence you read every symbol correctly. Be honest; below 0.4 means unusable.
- "isMath": false if the image is not primarily handwritten or typed mathematics (essay, doodle, blank page, photo of a cat).
- Transcribe faithfully, INCLUDING any mistakes the student made. Never correct their work.`

export async function transcribe(
  client: OpenAI,
  model: string,
  image: { base64: string; mediaType: 'image/jpeg' },
): Promise<Stage1Result> {
  return callModelJson({
    client, model, system: SYSTEM, schema: Stage1Schema, maxTokens: 3000,
    content: [
      { type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.base64}` } },
      { type: 'text', text: 'Transcribe this handwritten math work.' },
    ],
  })
}
