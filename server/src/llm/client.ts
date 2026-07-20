import type OpenAI from 'openai'
import { z, type ZodType } from 'zod'

export class ModelJsonError extends Error {}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

export async function callModelJson<T>(opts: {
  client: OpenAI
  model: string
  system: string
  content: ContentPart[]
  schema: ZodType<T>
  maxTokens?: number
}): Promise<T> {
  const ask = async (correction?: string): Promise<T> => {
    const content = correction
      ? [...opts.content, { type: 'text' as const, text: correction }]
      : opts.content
    const res = await opts.client.chat.completions.create({
      model: opts.model,
      max_completion_tokens: opts.maxTokens ?? 2000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content },
      ],
    })
    const text = res.choices[0]?.message?.content ?? ''
    return opts.schema.parse(JSON.parse(stripFences(text)))
  }
  try {
    return await ask()
  } catch (first) {
    if (!(first instanceof z.ZodError || first instanceof SyntaxError)) throw first
    const detail = first instanceof Error ? first.message.slice(0, 500) : String(first)
    try {
      return await ask(
        `Your previous reply was not valid for the required JSON schema (${detail}). Reply with ONLY the corrected JSON object — no prose, no code fences.`,
      )
    } catch (second) {
      throw new ModelJsonError(`invalid model output after retry: ${second}`)
    }
  }
}
