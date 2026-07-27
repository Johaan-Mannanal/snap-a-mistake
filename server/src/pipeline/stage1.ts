import type OpenAI from 'openai'
import { Stage1Schema, type Stage1Result } from '@snap/shared'
import { callModelJson } from '../llm/client.js'

const SYSTEM = `You transcribe photographed handwritten math work (algebra/calculus) into discrete solution steps.

Respond with ONLY a JSON object:
{"isMath": boolean, "legibility": number, "steps": [{"index": number, "latex": string, "plain": string, "yBandTopPct"?: number, "yBandBottomPct"?: number}]}

Rules:
- One step per written line/equation. Array order is top to bottom.
- "index" is a unique non-negative integer identity for that step; do not use it to encode array position.
- "latex": the line as LaTeX. "plain": the same line in plain English words.
- yBandTopPct/yBandBottomPct: a tight band around only that line's visible ink, as percentages of full image height (0 = top edge, 100 = bottom edge). Exclude blank spacing and every neighboring line. Bands may not overlap.
- Include both band endpoints together. Omit both when you cannot reliably locate that line in the photo.
- "legibility": 0..1 — your confidence you read every symbol correctly. Be honest; below 0.4 means unusable.
- "isMath": false if the image is not primarily handwritten or typed mathematics (essay, doodle, blank page, photo of a cat).
- Transcribe faithfully, INCLUDING any mistakes the student made. Never correct their work.
- Do not reconstruct a familiar problem or fill in a likely correct step from context. Report only marks you can actually see.
- If a line or important symbol is blurred, faint, cut off, crossed out ambiguously, or otherwise unreadable, lower legibility below 0.4. Never replace it with the mathematically expected version.`

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
