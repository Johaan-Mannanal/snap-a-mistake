import type Anthropic from '@anthropic-ai/sdk'
import { z, type ZodType } from 'zod'

export class ClaudeJsonError extends Error {}

type ContentBlockParam = Anthropic.Messages.TextBlockParam | Anthropic.Messages.ImageBlockParam | Anthropic.Messages.ToolUseBlockParam | Anthropic.Messages.ToolResultBlockParam

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

export async function callClaudeJson<T>(opts: {
  client: Anthropic
  model: string
  system: string
  content: ContentBlockParam[]
  schema: ZodType<T>
  maxTokens?: number
}): Promise<T> {
  const ask = async (correction?: string): Promise<T> => {
    const content = correction
      ? [...opts.content, { type: 'text' as const, text: correction }]
      : opts.content
    const res = await opts.client.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 2000,
      system: opts.system,
      messages: [{ role: 'user', content }],
    })
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
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
      throw new ClaudeJsonError(`invalid model output after retry: ${second}`)
    }
  }
}
