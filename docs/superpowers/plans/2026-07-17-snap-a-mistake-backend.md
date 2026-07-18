# Snap-a-Mistake Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the stateless Fastify backend that turns a photo of handwritten math into a verified error diagnosis (`AnalyzeResponse`), plus the golden-set regression script that proves it works.

**Architecture:** npm-workspaces monorepo (`shared` + `server`). The server exposes `POST /analyze`: image → sharp resize → Stage 1 (Claude vision transcribes steps) → Stage 2 (Claude text finds the broken step + misconception + follow-up) → Haiku verifier audit → typed JSON. All Claude calls go through one JSON-with-zod-validation wrapper with a single retry. Every pipeline function takes the Anthropic client as a parameter so tests inject fakes — no module mocking.

**Tech Stack:** Node 20+, TypeScript (strict), Fastify 4, @fastify/multipart, @anthropic-ai/sdk, sharp, zod 3, vitest, tsx.

## Global Constraints

- Node ≥ 20; npm workspaces; TypeScript `strict: true` everywhere.
- Model IDs, exactly: Stage 1 vision `claude-sonnet-5`; Stage 2 analysis `claude-sonnet-5`; verifier `claude-haiku-4-5-20251001`.
- Misconception tag vocabulary, verbatim from spec: `sign-error`, `dropped-term`, `distribution-error`, `chain-rule-missed`, `product-rule-misapplied`, `integration-by-parts-error`, `u-sub-bounds-error`, `algebraic-slip`, `exponent-rule-error`, `equals-abuse`, `other`. Stage 2 must pick from this list — never free text.
- Server is stateless: no DB, no sessions, no accounts.
- Env vars: `ANTHROPIC_API_KEY` (required), `PORT` (default 3000). Claude client timeout: 30 000 ms.
- Legibility threshold: reject below `0.4` as `unreadable`.
- Every task: tests first, run to see them fail, implement, run green, commit.

## File Structure

```
package.json                    # workspaces root
tsconfig.base.json
.gitignore
shared/package.json
shared/tsconfig.json
shared/src/index.ts             # tag vocabulary, zod schemas, types (API contract)
shared/test/schemas.test.ts
server/package.json
server/tsconfig.json
server/.env.example
server/src/config.ts            # env + models + thresholds
server/src/claude/client.ts     # callClaudeJson wrapper
server/src/pipeline/stage1.ts   # transcribe (vision)
server/src/pipeline/stage2.ts   # analyzeSteps (text)
server/src/pipeline/verifier.ts # verifyDiagnosis (haiku)
server/src/pipeline/run.ts      # runAnalysis orchestrator + verdict derivation
server/src/app.ts               # buildApp (routes; injectable pipeline)
server/src/index.ts             # bootstrap/listen
server/test/client.test.ts
server/test/stage1.test.ts
server/test/stage2.test.ts
server/test/verifier.test.ts
server/test/run.test.ts
server/test/app.test.ts
server/scripts/golden.ts        # regression runner (real API)
server/scripts/judge.ts         # pure comparator used by golden.ts
server/test/judge.test.ts
server/golden/manifest.json
server/golden/photos/           # Johaan's handwritten photos (added manually)
```

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`, `shared/package.json`, `shared/tsconfig.json`, `shared/src/index.ts` (stub), `server/package.json`, `server/tsconfig.json`, `server/.env.example`

**Interfaces:**
- Consumes: nothing.
- Produces: workspace layout; `@snap/shared` importable from `server`; `npm run typecheck` and `npm test` work at root.

- [ ] **Step 1: Write root files**

`package.json`:
```json
{
  "name": "snap-a-mistake",
  "private": true,
  "workspaces": ["shared", "server"],
  "scripts": {
    "typecheck": "npm run typecheck --workspaces",
    "test": "npm run test --workspaces --if-present"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true
  }
}
```

`.gitignore`:
```
node_modules/
.env
dist/
server/golden/photos/
.DS_Store
```
(Golden photos stay out of git — they contain real homework.)

- [ ] **Step 2: Write shared package**

`shared/package.json`:
```json
{
  "name": "@snap/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run" },
  "dependencies": { "zod": "^3.23.8" },
  "devDependencies": { "typescript": "^5.5.4", "vitest": "^2.1.0" }
}
```

`shared/tsconfig.json`:
```json
{ "extends": "../tsconfig.base.json", "include": ["src", "test"] }
```

`shared/src/index.ts` (stub for now):
```ts
export const PLACEHOLDER = true
```

- [ ] **Step 3: Write server package**

`server/package.json`:
```json
{
  "name": "@snap/server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "dev": "tsx watch src/index.ts",
    "golden": "tsx scripts/golden.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.32.0",
    "@fastify/multipart": "^8.3.0",
    "@snap/shared": "*",
    "dotenv": "^16.4.5",
    "fastify": "^4.28.0",
    "sharp": "^0.33.4",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "form-auto-content": "^3.2.1",
    "tsx": "^4.19.0",
    "typescript": "^5.5.4",
    "vitest": "^2.1.0"
  }
}
```

`server/tsconfig.json`:
```json
{ "extends": "../tsconfig.base.json", "include": ["src", "test", "scripts"] }
```

`server/.env.example`:
```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
```

- [ ] **Step 4: Install and verify**

Run: `npm install` (repo root)
Expected: installs cleanly, links `@snap/shared` into `server/node_modules`.

Run: `npm run typecheck`
Expected: both workspaces pass (shared has only the stub; server has no src yet — add `server/src/index.ts` containing `export {}` so tsc has an input).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: monorepo scaffold (shared + server workspaces)"
```

---

### Task 2: Shared types & schemas (the API contract)

**Files:**
- Create: `shared/src/index.ts` (replace stub), `shared/test/schemas.test.ts`

**Interfaces:**
- Produces (everything downstream depends on these exact names):
  - `MISCONCEPTION_TAGS: readonly string[]`, `MisconceptionTag`
  - `TranscribedStepSchema` / `TranscribedStep` — step without verdict (Stage 1 output)
  - `StepSchema` / `Step` — step with `verdict: 'ok' | 'suspect' | 'wrong' | 'downstream'`
  - `Stage1Schema` / `Stage1Result` — `{ isMath, legibility, steps: TranscribedStep[] }`
  - `Stage2Schema` / `Stage2Result` — `{ errorStepIndex, misconceptionTag, explanation, followUp }`
  - `VerifierSchema` / `VerifierResult` — `{ agrees, note }`
  - `AnalyzeResponseSchema` / `AnalyzeResponse` — discriminated union on `kind`

- [ ] **Step 1: Write the failing tests**

`shared/test/schemas.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import {
  AnalyzeResponseSchema, MISCONCEPTION_TAGS, Stage1Schema, Stage2Schema, VerifierSchema,
} from '../src/index.js'

const step = (index: number) => ({
  index, latex: 'x^2', plain: 'x squared', yBandTopPct: 10, yBandBottomPct: 20,
})

describe('Stage1Schema', () => {
  it('accepts a valid transcription', () => {
    const r = Stage1Schema.parse({ isMath: true, legibility: 0.9, steps: [step(0)] })
    expect(r.steps).toHaveLength(1)
  })
  it('rejects legibility outside 0..1', () => {
    expect(() => Stage1Schema.parse({ isMath: true, legibility: 1.5, steps: [] })).toThrow()
  })
})

describe('Stage2Schema', () => {
  it('accepts a diagnosis with a known tag', () => {
    const r = Stage2Schema.parse({
      errorStepIndex: 2, misconceptionTag: 'sign-error',
      explanation: 'You flipped the sign.', followUp: { problem: 'd/dx(-3x)', concept: 'signs' },
    })
    expect(r.misconceptionTag).toBe('sign-error')
  })
  it('rejects tags outside the vocabulary', () => {
    expect(() => Stage2Schema.parse({
      errorStepIndex: 0, misconceptionTag: 'made-up-tag', explanation: 'x', followUp: null,
    })).toThrow()
  })
  it('accepts the all-correct shape (all nulls)', () => {
    const r = Stage2Schema.parse({ errorStepIndex: null, misconceptionTag: null, explanation: null, followUp: null })
    expect(r.errorStepIndex).toBeNull()
  })
  it('rejects an error index with a missing explanation', () => {
    expect(() => Stage2Schema.parse({ errorStepIndex: 1, misconceptionTag: 'sign-error', explanation: null, followUp: null })).toThrow()
  })
})

describe('AnalyzeResponseSchema', () => {
  it('parses each union member', () => {
    expect(AnalyzeResponseSchema.parse({ kind: 'not-math' }).kind).toBe('not-math')
    expect(AnalyzeResponseSchema.parse({ kind: 'unreadable', tips: ['more light'] }).kind).toBe('unreadable')
    const a = AnalyzeResponseSchema.parse({
      kind: 'analysis', steps: [{ ...step(0), verdict: 'ok' }], errorStepIndex: null,
      misconceptionTag: null, explanation: null, followUp: null, verifierAgreed: true,
    })
    expect(a.kind).toBe('analysis')
  })
})

it('vocabulary matches the spec', () => {
  expect(MISCONCEPTION_TAGS).toContain('equals-abuse')
  expect(MISCONCEPTION_TAGS).toHaveLength(11)
})

it('verifier schema', () => {
  expect(VerifierSchema.parse({ agrees: false, note: 'step 2 is fine' }).agrees).toBe(false)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w shared`
Expected: FAIL — imports don't exist.

- [ ] **Step 3: Implement**

`shared/src/index.ts`:
```ts
import { z } from 'zod'

export const MISCONCEPTION_TAGS = [
  'sign-error', 'dropped-term', 'distribution-error', 'chain-rule-missed',
  'product-rule-misapplied', 'integration-by-parts-error', 'u-sub-bounds-error',
  'algebraic-slip', 'exponent-rule-error', 'equals-abuse', 'other',
] as const
export type MisconceptionTag = (typeof MISCONCEPTION_TAGS)[number]

export const TranscribedStepSchema = z.object({
  index: z.number().int().min(0),
  latex: z.string(),
  plain: z.string(),
  yBandTopPct: z.number().min(0).max(100),
  yBandBottomPct: z.number().min(0).max(100),
})
export type TranscribedStep = z.infer<typeof TranscribedStepSchema>

export const StepSchema = TranscribedStepSchema.extend({
  verdict: z.enum(['ok', 'suspect', 'wrong', 'downstream']),
})
export type Step = z.infer<typeof StepSchema>

export const Stage1Schema = z.object({
  isMath: z.boolean(),
  legibility: z.number().min(0).max(1),
  steps: z.array(TranscribedStepSchema),
})
export type Stage1Result = z.infer<typeof Stage1Schema>

export const Stage2Schema = z
  .object({
    errorStepIndex: z.number().int().min(0).nullable(),
    misconceptionTag: z.enum(MISCONCEPTION_TAGS).nullable(),
    explanation: z.string().min(1).nullable(),
    followUp: z.object({ problem: z.string().min(1), concept: z.string().min(1) }).nullable(),
  })
  .superRefine((v, ctx) => {
    const hasError = v.errorStepIndex !== null
    if (hasError && (v.misconceptionTag === null || v.explanation === null || v.followUp === null))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'error diagnosis requires tag, explanation, and followUp' })
    if (!hasError && (v.misconceptionTag !== null || v.explanation !== null || v.followUp !== null))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'correct work must have all-null diagnosis fields' })
  })
export type Stage2Result = z.infer<typeof Stage2Schema>

export const VerifierSchema = z.object({ agrees: z.boolean(), note: z.string() })
export type VerifierResult = z.infer<typeof VerifierSchema>

export const AnalyzeResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('analysis'),
    steps: z.array(StepSchema),
    errorStepIndex: z.number().int().nullable(),
    misconceptionTag: z.enum(MISCONCEPTION_TAGS).nullable(),
    explanation: z.string().nullable(),
    followUp: z.object({ problem: z.string(), concept: z.string() }).nullable(),
    verifierAgreed: z.boolean(),
  }),
  z.object({ kind: z.literal('unreadable'), tips: z.array(z.string()) }),
  z.object({ kind: z.literal('not-math') }),
])
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w shared` → all PASS. Then `npm run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add shared && git commit -m "feat(shared): API contract — tags, step/stage schemas, AnalyzeResponse union"
```

---

### Task 3: Server config + app skeleton + /health

**Files:**
- Create: `server/src/config.ts`, `server/src/app.ts`, `server/src/index.ts` (replace stub), `server/test/app.test.ts`

**Interfaces:**
- Produces:
  - `loadConfig(): Config` where `Config = { port: number; anthropicApiKey: string; models: { vision: string; analysis: string; verifier: string }; legibilityThreshold: number }`
  - `buildApp(deps: { runAnalysis: RunAnalysisFn }): FastifyInstance` — `RunAnalysisFn = (image: { base64: string; mediaType: 'image/jpeg' }) => Promise<AnalyzeResponse>` (route wiring lands in Task 9; this task registers `/health` only, but fix the `buildApp` signature now)

- [ ] **Step 1: Write the failing test**

`server/test/app.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'

describe('GET /health', () => {
  it('returns ok', async () => {
    const app = buildApp({ runAnalysis: async () => ({ kind: 'not-math' }) })
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w server` → FAIL (`buildApp` not defined).

- [ ] **Step 3: Implement**

`server/src/config.ts`:
```ts
import 'dotenv/config'

export type Config = {
  port: number
  anthropicApiKey: string
  models: { vision: string; analysis: string; verifier: string }
  legibilityThreshold: number
}

export function loadConfig(): Config {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is required')
  return {
    port: Number(process.env.PORT ?? 3000),
    anthropicApiKey: key,
    models: {
      vision: 'claude-sonnet-5',
      analysis: 'claude-sonnet-5',
      verifier: 'claude-haiku-4-5-20251001',
    },
    legibilityThreshold: 0.4,
  }
}
```

`server/src/app.ts`:
```ts
import Fastify, { type FastifyInstance } from 'fastify'
import type { AnalyzeResponse } from '@snap/shared'

export type RunAnalysisFn = (image: { base64: string; mediaType: 'image/jpeg' }) => Promise<AnalyzeResponse>

export function buildApp(deps: { runAnalysis: RunAnalysisFn }): FastifyInstance {
  const app = Fastify({ logger: false })
  app.get('/health', async () => ({ ok: true }))
  void deps // /analyze route registered in a later task
  return app
}
```

`server/src/index.ts`:
```ts
import { buildApp } from './app.js'
import { loadConfig } from './config.js'

const config = loadConfig()
const app = buildApp({ runAnalysis: async () => ({ kind: 'not-math' }) }) // real pipeline wired in Task 9
app.listen({ port: config.port, host: '0.0.0.0' }).then(() => {
  console.log(`snap-a-mistake server on :${config.port}`)
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w server` → PASS. `npm run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add server && git commit -m "feat(server): config loader, app skeleton, /health"
```

---

### Task 4: Claude JSON wrapper (`callClaudeJson`)

**Files:**
- Create: `server/src/claude/client.ts`, `server/test/client.test.ts`

**Interfaces:**
- Consumes: nothing internal.
- Produces:
  - `class ClaudeJsonError extends Error`
  - `callClaudeJson<T>(opts: { client: Anthropic; model: string; system: string; content: ContentBlockParam[]; schema: ZodType<T>; maxTokens?: number }): Promise<T>` — parses/validates; on invalid output retries ONCE with the validation error appended; then throws `ClaudeJsonError`.
  - Test helper pattern used by all later tests: `fakeClient(...texts: string[])` returns an object whose `messages.create` resolves each text in order.

- [ ] **Step 1: Write the failing tests**

`server/test/client.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type Anthropic from '@anthropic-ai/sdk'
import { ClaudeJsonError, callClaudeJson } from '../src/claude/client.js'

export function fakeClient(...texts: string[]): Anthropic {
  const create = vi.fn()
  for (const t of texts) create.mockResolvedValueOnce({ content: [{ type: 'text', text: t }] })
  return { messages: { create } } as unknown as Anthropic
}

const schema = z.object({ n: z.number() })
const opts = { model: 'm', system: 's', content: [{ type: 'text' as const, text: 'hi' }], schema }

describe('callClaudeJson', () => {
  it('parses valid JSON on first try', async () => {
    const client = fakeClient('{"n": 4}')
    expect(await callClaudeJson({ client, ...opts })).toEqual({ n: 4 })
  })
  it('strips markdown code fences', async () => {
    const client = fakeClient('```json\n{"n": 7}\n```')
    expect(await callClaudeJson({ client, ...opts })).toEqual({ n: 7 })
  })
  it('retries once with the validation error, then succeeds', async () => {
    const client = fakeClient('{"n": "not a number"}', '{"n": 2}')
    expect(await callClaudeJson({ client, ...opts })).toEqual({ n: 2 })
    expect((client.messages.create as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2)
  })
  it('throws ClaudeJsonError after two failures', async () => {
    const client = fakeClient('garbage', 'more garbage')
    await expect(callClaudeJson({ client, ...opts })).rejects.toThrow(ClaudeJsonError)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w server -- client` → FAIL (module missing).

- [ ] **Step 3: Implement**

`server/src/claude/client.ts`:
```ts
import type Anthropic from '@anthropic-ai/sdk'
import type { ZodType } from 'zod'

export class ClaudeJsonError extends Error {}

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

export async function callClaudeJson<T>(opts: {
  client: Anthropic
  model: string
  system: string
  content: Anthropic.Messages.ContentBlockParam[]
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w server -- client` → 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add server && git commit -m "feat(server): callClaudeJson wrapper with zod validation and one retry"
```

---

### Task 5: Stage 1 — vision transcription

**Files:**
- Create: `server/src/pipeline/stage1.ts`, `server/test/stage1.test.ts`

**Interfaces:**
- Consumes: `callClaudeJson`, `Stage1Schema`.
- Produces: `transcribe(client: Anthropic, model: string, image: { base64: string; mediaType: 'image/jpeg' }): Promise<Stage1Result>`

- [ ] **Step 1: Write the failing tests**

`server/test/stage1.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { transcribe } from '../src/pipeline/stage1.js'
import { fakeClient } from './client.test.js'

const good = JSON.stringify({
  isMath: true, legibility: 0.85,
  steps: [{ index: 0, latex: '\\int x e^x dx', plain: 'integral of x e^x dx', yBandTopPct: 5, yBandBottomPct: 18 }],
})

describe('transcribe', () => {
  it('sends the image block and returns a parsed Stage1Result', async () => {
    const client = fakeClient(good)
    const r = await transcribe(client, 'claude-sonnet-5', { base64: 'AAAA', mediaType: 'image/jpeg' })
    expect(r.isMath).toBe(true)
    expect(r.steps[0]?.latex).toContain('int')
    const call = (client.messages.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Anthropic.Messages.MessageCreateParams
    const blocks = call.messages[0]?.content as Anthropic.Messages.ContentBlockParam[]
    expect(blocks.some((b) => b.type === 'image')).toBe(true)
    expect(call.model).toBe('claude-sonnet-5')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w server -- stage1` → FAIL.

- [ ] **Step 3: Implement**

`server/src/pipeline/stage1.ts`:
```ts
import type Anthropic from '@anthropic-ai/sdk'
import { Stage1Schema, type Stage1Result } from '@snap/shared'
import { callClaudeJson } from '../claude/client.js'

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
  client: Anthropic,
  model: string,
  image: { base64: string; mediaType: 'image/jpeg' },
): Promise<Stage1Result> {
  return callClaudeJson({
    client, model, system: SYSTEM, schema: Stage1Schema, maxTokens: 3000,
    content: [
      { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
      { type: 'text', text: 'Transcribe this handwritten math work.' },
    ],
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w server -- stage1` → PASS.

- [ ] **Step 5: Commit**

```bash
git add server && git commit -m "feat(server): stage 1 vision transcription"
```

---

### Task 6: Stage 2 — error analysis

**Files:**
- Create: `server/src/pipeline/stage2.ts`, `server/test/stage2.test.ts`

**Interfaces:**
- Consumes: `callClaudeJson`, `Stage2Schema`, `TranscribedStep`.
- Produces: `analyzeSteps(client: Anthropic, model: string, steps: TranscribedStep[]): Promise<Stage2Result>`

- [ ] **Step 1: Write the failing tests**

`server/test/stage2.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import type { TranscribedStep } from '@snap/shared'
import { analyzeSteps } from '../src/pipeline/stage2.js'
import { fakeClient } from './client.test.js'

const steps: TranscribedStep[] = [
  { index: 0, latex: '\\int x e^x dx', plain: 'integral of x e^x', yBandTopPct: 0, yBandBottomPct: 20 },
  { index: 1, latex: '= x e^x - e^x x', plain: 'x e^x minus e^x times x', yBandTopPct: 20, yBandBottomPct: 40 },
]

const diagnosis = JSON.stringify({
  errorStepIndex: 1, misconceptionTag: 'integration-by-parts-error',
  explanation: 'You differentiated both factors.', followUp: { problem: '∫x·2 dx', concept: 'parts' },
})

describe('analyzeSteps', () => {
  it('serializes steps into the prompt and parses the diagnosis', async () => {
    const client = fakeClient(diagnosis)
    const r = await analyzeSteps(client, 'claude-sonnet-5', steps)
    expect(r.errorStepIndex).toBe(1)
    expect(r.misconceptionTag).toBe('integration-by-parts-error')
    const call = (client.messages.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Anthropic.Messages.MessageCreateParams
    const text = JSON.stringify(call.messages)
    expect(text).toContain('x e^x - e^x x') // steps actually reached the prompt
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w server -- stage2` → FAIL.

- [ ] **Step 3: Implement**

`server/src/pipeline/stage2.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w server -- stage2` → PASS.

- [ ] **Step 5: Commit**

```bash
git add server && git commit -m "feat(server): stage 2 step analysis with misconception vocabulary"
```

---

### Task 7: Verifier — Haiku audit

**Files:**
- Create: `server/src/pipeline/verifier.ts`, `server/test/verifier.test.ts`

**Interfaces:**
- Consumes: `callClaudeJson`, `VerifierSchema`.
- Produces: `verifyDiagnosis(client: Anthropic, model: string, steps: TranscribedStep[], diagnosis: { errorStepIndex: number; explanation: string }): Promise<VerifierResult>`

- [ ] **Step 1: Write the failing tests**

`server/test/verifier.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { TranscribedStep } from '@snap/shared'
import { verifyDiagnosis } from '../src/pipeline/verifier.js'
import { fakeClient } from './client.test.js'

const steps: TranscribedStep[] = [
  { index: 0, latex: '2x = 6', plain: 'two x equals six', yBandTopPct: 0, yBandBottomPct: 50 },
  { index: 1, latex: 'x = 3', plain: 'x equals three', yBandTopPct: 50, yBandBottomPct: 100 },
]

describe('verifyDiagnosis', () => {
  it('returns disagreement when the auditor rejects the claim', async () => {
    const client = fakeClient(JSON.stringify({ agrees: false, note: 'step 1 is valid: 6/2 = 3' }))
    const r = await verifyDiagnosis(client, 'claude-haiku-4-5-20251001', steps, {
      errorStepIndex: 1, explanation: 'Division mistake',
    })
    expect(r.agrees).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w server -- verifier` → FAIL.

- [ ] **Step 3: Implement**

`server/src/pipeline/verifier.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w server -- verifier` → PASS.

- [ ] **Step 5: Commit**

```bash
git add server && git commit -m "feat(server): haiku verifier audit"
```

---

### Task 8: Orchestrator — `runAnalysis` + verdict derivation

**Files:**
- Create: `server/src/pipeline/run.ts`, `server/test/run.test.ts`

**Interfaces:**
- Consumes: `transcribe`, `analyzeSteps`, `verifyDiagnosis`, `Config`.
- Produces:
  - `RETAKE_TIPS: string[]`
  - `makeRunAnalysis(client: Anthropic, config: Config, deps?: { transcribe; analyzeSteps; verifyDiagnosis }): RunAnalysisFn` — deps default to the real stage functions; tests inject fakes.
  - Verdict rules: all-correct → every step `ok`; error at i with verifier agreement → `<i: ok`, `i: wrong`, `>i: downstream`; verifier disagreement → flagged step `suspect` (others same rules), `verifierAgreed: false`.
  - Out-of-range `errorStepIndex` from Stage 2 → throws `ClaudeJsonError` (route maps it to 502 in Task 9).

- [ ] **Step 1: Write the failing tests**

`server/test/run.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Stage1Result, Stage2Result, VerifierResult } from '@snap/shared'
import type Anthropic from '@anthropic-ai/sdk'
import { ClaudeJsonError } from '../src/claude/client.js'
import { makeRunAnalysis } from '../src/pipeline/run.js'
import type { Config } from '../src/config.js'

const client = {} as Anthropic
const config: Config = {
  port: 0, anthropicApiKey: 'k', legibilityThreshold: 0.4,
  models: { vision: 'v', analysis: 'a', verifier: 'h' },
}
const image = { base64: 'AAAA', mediaType: 'image/jpeg' as const }

const step = (index: number) => ({
  index, latex: `L${index}`, plain: `P${index}`, yBandTopPct: index * 10, yBandBottomPct: index * 10 + 9,
})
const s1 = (over: Partial<Stage1Result> = {}): Stage1Result =>
  ({ isMath: true, legibility: 0.9, steps: [step(0), step(1), step(2)], ...over })
const errorDiag: Stage2Result = {
  errorStepIndex: 1, misconceptionTag: 'sign-error',
  explanation: 'Sign flipped.', followUp: { problem: 'p', concept: 'c' },
}
const cleanDiag: Stage2Result = { errorStepIndex: null, misconceptionTag: null, explanation: null, followUp: null }

function run(opts: { s1?: Stage1Result; s2?: Stage2Result; v?: VerifierResult }) {
  return makeRunAnalysis(client, config, {
    transcribe: async () => opts.s1 ?? s1(),
    analyzeSteps: async () => opts.s2 ?? cleanDiag,
    verifyDiagnosis: async () => opts.v ?? { agrees: true, note: '' },
  })(image)
}

describe('runAnalysis', () => {
  it('returns not-math without calling stage 2', async () => {
    expect(await run({ s1: s1({ isMath: false }) })).toEqual({ kind: 'not-math' })
  })
  it('returns unreadable below the legibility threshold', async () => {
    const r = await run({ s1: s1({ legibility: 0.3 }) })
    expect(r.kind).toBe('unreadable')
  })
  it('returns unreadable when no steps were found', async () => {
    const r = await run({ s1: s1({ steps: [] }) })
    expect(r.kind).toBe('unreadable')
  })
  it('marks all steps ok for correct work', async () => {
    const r = await run({ s2: cleanDiag })
    if (r.kind !== 'analysis') throw new Error('expected analysis')
    expect(r.errorStepIndex).toBeNull()
    expect(r.steps.map((s) => s.verdict)).toEqual(['ok', 'ok', 'ok'])
    expect(r.verifierAgreed).toBe(true)
  })
  it('derives ok/wrong/downstream when verifier agrees', async () => {
    const r = await run({ s2: errorDiag, v: { agrees: true, note: '' } })
    if (r.kind !== 'analysis') throw new Error('expected analysis')
    expect(r.steps.map((s) => s.verdict)).toEqual(['ok', 'wrong', 'downstream'])
    expect(r.misconceptionTag).toBe('sign-error')
  })
  it('softens to suspect when verifier disagrees', async () => {
    const r = await run({ s2: errorDiag, v: { agrees: false, note: 'looks fine' } })
    if (r.kind !== 'analysis') throw new Error('expected analysis')
    expect(r.steps[1]?.verdict).toBe('suspect')
    expect(r.verifierAgreed).toBe(false)
  })
  it('throws ClaudeJsonError on out-of-range error index', async () => {
    await expect(run({ s2: { ...errorDiag, errorStepIndex: 99 } })).rejects.toThrow(ClaudeJsonError)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w server -- run` → FAIL.

- [ ] **Step 3: Implement**

`server/src/pipeline/run.ts`:
```ts
import type Anthropic from '@anthropic-ai/sdk'
import type { AnalyzeResponse, Step, TranscribedStep } from '@snap/shared'
import { ClaudeJsonError } from '../claude/client.js'
import type { Config } from '../config.js'
import type { RunAnalysisFn } from '../app.js'
import { transcribe } from './stage1.js'
import { analyzeSteps } from './stage2.js'
import { verifyDiagnosis } from './verifier.js'

export const RETAKE_TIPS = [
  'Get more light on the page',
  'Flatten the page and shoot from directly above',
  'Fit just one problem in the frame',
]

type Deps = {
  transcribe: typeof transcribe
  analyzeSteps: typeof analyzeSteps
  verifyDiagnosis: typeof verifyDiagnosis
}

function withVerdicts(steps: TranscribedStep[], errorIndex: number | null, verifierAgreed: boolean): Step[] {
  return steps.map((s) => ({
    ...s,
    verdict:
      errorIndex === null ? 'ok'
      : s.index < errorIndex ? 'ok'
      : s.index === errorIndex ? (verifierAgreed ? 'wrong' : 'suspect')
      : 'downstream',
  }))
}

export function makeRunAnalysis(
  client: Anthropic,
  config: Config,
  deps: Deps = { transcribe, analyzeSteps, verifyDiagnosis },
): RunAnalysisFn {
  return async (image) => {
    const s1 = await deps.transcribe(client, config.models.vision, image)
    if (!s1.isMath) return { kind: 'not-math' }
    if (s1.legibility < config.legibilityThreshold || s1.steps.length === 0)
      return { kind: 'unreadable', tips: RETAKE_TIPS }

    const s2 = await deps.analyzeSteps(client, config.models.analysis, s1.steps)

    if (s2.errorStepIndex === null) {
      return {
        kind: 'analysis', steps: withVerdicts(s1.steps, null, true),
        errorStepIndex: null, misconceptionTag: null, explanation: null,
        followUp: null, verifierAgreed: true,
      } satisfies AnalyzeResponse
    }

    if (!s1.steps.some((s) => s.index === s2.errorStepIndex))
      throw new ClaudeJsonError(`stage 2 flagged nonexistent step ${s2.errorStepIndex}`)

    const v = await deps.verifyDiagnosis(client, config.models.verifier, s1.steps, {
      errorStepIndex: s2.errorStepIndex,
      explanation: s2.explanation ?? '',
    })

    return {
      kind: 'analysis', steps: withVerdicts(s1.steps, s2.errorStepIndex, v.agrees),
      errorStepIndex: s2.errorStepIndex, misconceptionTag: s2.misconceptionTag,
      explanation: s2.explanation, followUp: s2.followUp, verifierAgreed: v.agrees,
    } satisfies AnalyzeResponse
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w server -- run` → 7 PASS. `npm run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add server && git commit -m "feat(server): runAnalysis orchestrator with verdict derivation and verifier softening"
```

---

### Task 9: `POST /analyze` route (multipart + sharp + error mapping)

**Files:**
- Modify: `server/src/app.ts`, `server/src/index.ts`
- Test: `server/test/app.test.ts` (extend)

**Interfaces:**
- Consumes: `RunAnalysisFn`, `ClaudeJsonError`.
- Produces: `POST /analyze` accepting multipart field `photo` → 200 `AnalyzeResponse`; 400 `{ error: 'no file' }` when missing; 502 `{ error: 'analysis-failed' }` on `ClaudeJsonError`; 500 `{ error: 'internal' }` otherwise. Image normalized via sharp: auto-rotate (EXIF), resize to width ≤ 1568 (no enlargement), JPEG q85.

- [ ] **Step 1: Write the failing tests**

Append to `server/test/app.test.ts`:
```ts
import formAutoContent from 'form-auto-content'
import sharp from 'sharp'
import { ClaudeJsonError } from '../src/claude/client.js'

async function tinyJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .jpeg().toBuffer()
}

describe('POST /analyze', () => {
  it('returns the pipeline result for an uploaded photo', async () => {
    let received = ''
    const app = buildApp({
      runAnalysis: async (img) => {
        received = img.mediaType
        return { kind: 'unreadable', tips: ['more light'] }
      },
    })
    const form = formAutoContent({ photo: await tinyJpeg() })
    const res = await app.inject({ method: 'POST', url: '/analyze', ...form })
    expect(res.statusCode).toBe(200)
    expect(res.json().kind).toBe('unreadable')
    expect(received).toBe('image/jpeg')
  })
  it('400s with no file', async () => {
    const app = buildApp({ runAnalysis: async () => ({ kind: 'not-math' }) })
    const res = await app.inject({ method: 'POST', url: '/analyze', payload: {} })
    expect(res.statusCode).toBe(400)
  })
  it('502s on ClaudeJsonError', async () => {
    const app = buildApp({ runAnalysis: async () => { throw new ClaudeJsonError('bad') } })
    const form = formAutoContent({ photo: await tinyJpeg() })
    const res = await app.inject({ method: 'POST', url: '/analyze', ...form })
    expect(res.statusCode).toBe(502)
    expect(res.json()).toEqual({ error: 'analysis-failed' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w server -- app` → new tests FAIL (404 route not found).

- [ ] **Step 3: Implement**

Replace `server/src/app.ts`:
```ts
import Fastify, { type FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'
import sharp from 'sharp'
import type { AnalyzeResponse } from '@snap/shared'
import { ClaudeJsonError } from './claude/client.js'

export type RunAnalysisFn = (image: { base64: string; mediaType: 'image/jpeg' }) => Promise<AnalyzeResponse>

export function buildApp(deps: { runAnalysis: RunAnalysisFn }): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 15 * 1024 * 1024 })
  app.register(multipart, { limits: { fileSize: 15 * 1024 * 1024, files: 1 } })

  app.get('/health', async () => ({ ok: true }))

  app.post('/analyze', async (req, reply) => {
    const file = typeof req.file === 'function' ? await req.file() : undefined
    if (!file) return reply.code(400).send({ error: 'no file' })
    const raw = await file.toBuffer()
    const jpeg = await sharp(raw)
      .rotate() // honor EXIF orientation from phone cameras
      .resize({ width: 1568, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
    try {
      return await deps.runAnalysis({ base64: jpeg.toString('base64'), mediaType: 'image/jpeg' })
    } catch (err) {
      if (err instanceof ClaudeJsonError) return reply.code(502).send({ error: 'analysis-failed' })
      req.log?.error?.(err)
      return reply.code(500).send({ error: 'internal' })
    }
  })

  return app
}
```

Replace `server/src/index.ts` (wire the real pipeline):
```ts
import Anthropic from '@anthropic-ai/sdk'
import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { makeRunAnalysis } from './pipeline/run.js'

const config = loadConfig()
const client = new Anthropic({ apiKey: config.anthropicApiKey, timeout: 30_000, maxRetries: 1 })
const app = buildApp({ runAnalysis: makeRunAnalysis(client, config) })
app.listen({ port: config.port, host: '0.0.0.0' }).then(() => {
  console.log(`snap-a-mistake server on :${config.port}`)
})
```

Note: the `400 no file` test sends a non-multipart payload; `req.file` is absent on such requests, hence the `typeof req.file === 'function'` guard. If Fastify instead responds 406/415 before the handler, accept that by asserting `res.statusCode` is `>= 400 && < 500` — the contract is "client error, not a crash".

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w server` → all PASS. `npm run typecheck` → clean.

- [ ] **Step 5: Smoke test against the real API (manual)**

```bash
cp server/.env.example server/.env   # then paste the real ANTHROPIC_API_KEY
npm run dev -w server
# in another terminal, with any handwritten-math photo:
curl -s -F "photo=@/path/to/math-photo.jpg" http://localhost:3000/analyze | head -c 2000
```
Expected: a JSON `AnalyzeResponse` with transcribed steps. This is the first real end-to-end run — eyeball the transcription quality.

- [ ] **Step 6: Commit**

```bash
git add server && git commit -m "feat(server): POST /analyze route with sharp normalization and error mapping"
```

---

### Task 10: Golden-set regression harness

**Files:**
- Create: `server/scripts/judge.ts`, `server/test/judge.test.ts`, `server/scripts/golden.ts`, `server/golden/manifest.json`, `server/golden/photos/.gitkeep`

**Interfaces:**
- Consumes: `makeRunAnalysis`, `AnalyzeResponse`.
- Produces:
  - `GoldenCase = { file: string; expect: 'correct' | 'error' | 'unreadable' | 'not-math'; errorStepIndex?: number; tag?: MisconceptionTag }`
  - `judge(expected: GoldenCase, actual: AnalyzeResponse): { pass: boolean; detail: string }`
  - `npm run golden -w server` — runs every manifest case through the REAL pipeline, prints a pass/fail table, exits 1 on any failure. This is the regression gate for all prompt tuning.

- [ ] **Step 1: Write the failing tests for the comparator**

`server/test/judge.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { AnalyzeResponse } from '@snap/shared'
import { judge, type GoldenCase } from '../scripts/judge.js'

const analysis = (over: Partial<Extract<AnalyzeResponse, { kind: 'analysis' }>> = {}): AnalyzeResponse => ({
  kind: 'analysis', steps: [], errorStepIndex: null, misconceptionTag: null,
  explanation: null, followUp: null, verifierAgreed: true, ...over,
})

describe('judge', () => {
  it('passes correct-work cases with a null error index', () => {
    const c: GoldenCase = { file: 'a.jpg', expect: 'correct' }
    expect(judge(c, analysis()).pass).toBe(true)
  })
  it('fails correct-work cases that got accused (false accusation)', () => {
    const c: GoldenCase = { file: 'a.jpg', expect: 'correct' }
    expect(judge(c, analysis({ errorStepIndex: 1, misconceptionTag: 'sign-error' })).pass).toBe(false)
  })
  it('passes error cases when step AND tag match', () => {
    const c: GoldenCase = { file: 'b.jpg', expect: 'error', errorStepIndex: 2, tag: 'sign-error' }
    expect(judge(c, analysis({ errorStepIndex: 2, misconceptionTag: 'sign-error' })).pass).toBe(true)
  })
  it('fails error cases flagging the wrong step', () => {
    const c: GoldenCase = { file: 'b.jpg', expect: 'error', errorStepIndex: 2, tag: 'sign-error' }
    expect(judge(c, analysis({ errorStepIndex: 0, misconceptionTag: 'sign-error' })).pass).toBe(false)
  })
  it('passes error cases with the right step but different tag (partial credit noted in detail)', () => {
    const c: GoldenCase = { file: 'b.jpg', expect: 'error', errorStepIndex: 2, tag: 'sign-error' }
    const r = judge(c, analysis({ errorStepIndex: 2, misconceptionTag: 'algebraic-slip' }))
    expect(r.pass).toBe(true)
    expect(r.detail).toContain('tag mismatch')
  })
  it('matches unreadable and not-math kinds directly', () => {
    expect(judge({ file: 'c.jpg', expect: 'not-math' }, { kind: 'not-math' }).pass).toBe(true)
    expect(judge({ file: 'd.jpg', expect: 'unreadable' }, { kind: 'unreadable', tips: [] }).pass).toBe(true)
    expect(judge({ file: 'd.jpg', expect: 'unreadable' }, { kind: 'not-math' }).pass).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w server -- judge` → FAIL.

- [ ] **Step 3: Implement the comparator**

`server/scripts/judge.ts`:
```ts
import type { AnalyzeResponse, MisconceptionTag } from '@snap/shared'

export type GoldenCase = {
  file: string
  expect: 'correct' | 'error' | 'unreadable' | 'not-math'
  errorStepIndex?: number
  tag?: MisconceptionTag
}

export function judge(expected: GoldenCase, actual: AnalyzeResponse): { pass: boolean; detail: string } {
  if (expected.expect === 'not-math' || expected.expect === 'unreadable') {
    const pass = actual.kind === expected.expect
    return { pass, detail: pass ? 'ok' : `expected ${expected.expect}, got ${actual.kind}` }
  }
  if (actual.kind !== 'analysis') return { pass: false, detail: `expected analysis, got ${actual.kind}` }

  if (expected.expect === 'correct') {
    const pass = actual.errorStepIndex === null
    return { pass, detail: pass ? 'ok' : `FALSE ACCUSATION: flagged step ${actual.errorStepIndex} (${actual.misconceptionTag})` }
  }

  // expected.expect === 'error'
  if (actual.errorStepIndex === null) return { pass: false, detail: 'missed the error entirely' }
  if (actual.errorStepIndex !== expected.errorStepIndex)
    return { pass: false, detail: `flagged step ${actual.errorStepIndex}, expected ${expected.errorStepIndex}` }
  if (expected.tag && actual.misconceptionTag !== expected.tag)
    return { pass: true, detail: `right step; tag mismatch (${actual.misconceptionTag} vs ${expected.tag})` }
  return { pass: true, detail: 'ok' }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w server -- judge` → 6 PASS.

- [ ] **Step 5: Write the runner and starter manifest**

`server/golden/manifest.json` (starter — entries added as photos are created):
```json
{
  "cases": [
    { "file": "correct-power-rule.jpg", "expect": "correct" },
    { "file": "sign-error-derivative.jpg", "expect": "error", "errorStepIndex": 2, "tag": "sign-error" },
    { "file": "blurry.jpg", "expect": "unreadable" },
    { "file": "grocery-list.jpg", "expect": "not-math" }
  ]
}
```

`server/scripts/golden.ts`:
```ts
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { loadConfig } from '../src/config.js'
import { makeRunAnalysis } from '../src/pipeline/run.js'
import { judge, type GoldenCase } from './judge.js'

const dir = path.join(import.meta.dirname, '..', 'golden')
const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8')) as { cases: GoldenCase[] }

const config = loadConfig()
const client = new Anthropic({ apiKey: config.anthropicApiKey, timeout: 30_000, maxRetries: 1 })
const run = makeRunAnalysis(client, config)

let failures = 0
let skipped = 0
for (const c of manifest.cases) {
  const photo = path.join(dir, 'photos', c.file)
  if (!existsSync(photo)) { skipped++; console.log(`SKIP  ${c.file} (photo not added yet)`); continue }
  const base64 = (await readFile(photo)).toString('base64')
  try {
    const actual = await run({ base64, mediaType: 'image/jpeg' })
    const { pass, detail } = judge(c, actual)
    if (!pass) failures++
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${c.file} — ${detail}`)
  } catch (err) {
    failures++
    console.log(`FAIL  ${c.file} — pipeline threw: ${err}`)
  }
}
console.log(`\n${manifest.cases.length - failures - skipped} passed, ${failures} failed, ${skipped} skipped`)
process.exit(failures > 0 ? 1 : 0)
```

Note: photos are pre-resized by hand or sent full-size — the script bypasses the sharp step deliberately (it tests the pipeline, not the route). Keep photos under ~2MB; long-edge ≤ 1568px is ideal.

- [ ] **Step 6: Verify the runner works with zero photos**

Run: `npm run golden -w server` (requires `server/.env` with a real key)
Expected: every case prints `SKIP`, summary `0 passed, 0 failed, 4 skipped`, exit 0.

- [ ] **Step 7: Commit**

```bash
git add server && git commit -m "feat(server): golden-set regression harness (judge + runner + starter manifest)"
```

---

## After this plan

- **Manual follow-through (not code):** photograph the real golden set — 4 correct solutions, ~8 planted errors covering distinct tags, 3 garbage inputs — drop them in `server/golden/photos/`, fill in `manifest.json`, and run `npm run golden -w server`. Tune the Stage 1/Stage 2/verifier prompts until the set passes; every prompt tweak reruns the script.
- **Plan 2 (separate document):** the Expo app — camera → analyzing → result overlay → follow-up loop → SQLite insights — plus Railway deployment. Written once the golden set proves the backend contract.

## Self-Review Notes

- Spec coverage: Stage 1/2/verifier ✅ (Tasks 5–7), thresholds + not-math/unreadable gates ✅ (Task 8), API contract + zod-validate-with-retry + 502 ✅ (Tasks 2, 4, 9), 30s timeout ✅ (Anthropic client `timeout: 30_000`, Task 9 index.ts), golden set + regression script ✅ (Task 10), statelessness ✅ (no storage anywhere). App-side spec items (screens, SQLite history, retry UX) are Plan 2 by design.
- Type consistency: `RunAnalysisFn` defined once in `app.ts`, consumed by Task 8/9/10; `fakeClient` defined once in Task 4's test and imported elsewhere; step fixtures use `TranscribedStep` consistently.
- No placeholders: every code step contains complete code; the only deferred work is explicitly listed under "After this plan".
