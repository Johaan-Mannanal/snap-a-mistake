# Snap-a-Mistake Mobile App (Plan 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Expo/React Native app: snap a photo → staged analyzing screen → result with red-band overlay + step cards → follow-up loop → local SQLite insights, consuming the completed backend's `POST /analyze`.

**Architecture:** New `app` workspace in the existing monorepo. All testable logic lives in `app/src/lib/*` as pure TypeScript modules with **no react-native imports** (tested with vitest in node env, same as the rest of the repo). Screens are thin expo-router components over those modules. The API contract comes exclusively from `@snap/shared` — the app never re-declares response types. A fixture-serving mock server (reusing the backend's `buildApp`) lets the whole UI be built and demoed without an API key.

**Tech Stack:** Expo (latest SDK via create-expo-app, expo-router template), TypeScript strict, expo-camera, expo-image-picker, expo-sqlite, vitest, `@snap/shared` (zod schemas).

## Global Constraints

- Monorepo: root `package.json` workspaces become `["shared", "server", "app"]`; app package name `@snap/app`; TypeScript `strict: true`.
- `app/src/lib/**` MUST NOT import `react-native`, `expo-*`, or `react` — vitest runs them in node.
- `AnalyzeResponse`, `Step`, `MisconceptionTag` come from `@snap/shared` only — never re-declared locally.
- API base URL: `process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'`. Client timeout 35s (server caps Claude at 30s).
- History is recorded ONLY for `kind: 'analysis'` responses (one row per analysis: tag or null + correct flag).
- Copy strings, verbatim (they are tuned demo copy):
  - Staged progress: `Reading your handwriting…` → `Checking each step…` → `Verifying the diagnosis…` (advance every 3s, hold on last)
  - Correct state: `All steps check out ✓`
  - Suspect state (verifier disagreed): `I'm not fully sure about step {N} — want to walk through it?`
  - Not-math: `I only speak math for now 📐`
  - Reserved slot: `🎬 Video lesson — coming soon` (disabled button; do NOT implement video)
  - Follow-up actions: `Try a follow-up` / `I'm done — check it`
- Verdict colors: ok `#22c55e`, wrong `#ef4444`, suspect `#f59e0b`, downstream `#94a3b8`.
- Every task: tests first for `src/lib` modules; screens verified by concrete manual steps against the mock server.

## File Structure

```
package.json                       # MODIFY: add "app" workspace
app/                               # created by create-expo-app (expo-router template)
  package.json                     # MODIFY: name @snap/app, scripts, deps
  vitest.config.ts
  metro.config.js                  # monorepo-safe metro config
  src/lib/api.ts                   # analyzePhoto() + ApiError
  src/lib/session.ts               # in-memory flow state between screens
  src/lib/trends.ts                # pure summarize() for insights
  src/lib/overlay.ts               # pure bandStyle() math for the red band
  src/lib/labels.ts                # MisconceptionTag → human label
  src/lib/history.ts               # expo-sqlite wrapper (thin, not unit tested)
  src/lib/*.test.ts                # vitest tests for the pure modules
  src/components/PhotoOverlay.tsx  # photo + red band(s)
  src/components/StepCard.tsx      # ✓/⚠️/✗/↓ step row
  src/components/Screen.tsx        # shared dark layout wrapper
  app/_layout.tsx                  # router stack + db init
  app/index.tsx                    # Home/Camera
  app/analyze.tsx                  # Analyzing + Result (all response kinds)
  app/followup.tsx                 # follow-up problem screen
  app/insights.tsx                 # misconception patterns
server/scripts/mock.ts             # fixture server reusing buildApp (no API key)
```

---

### Task 1: Expo app scaffold in the monorepo

**Files:**
- Create: `app/` via create-expo-app; `app/metro.config.js`; `app/vitest.config.ts`; `app/src/lib/.gitkeep`
- Modify: root `package.json` (workspaces), `app/package.json`, `app/tsconfig.json`

**Interfaces:**
- Produces: an `app` workspace where `npm test -w app` and `npm run typecheck -w app` run clean, `@snap/shared` resolves, and `npx expo start` bundles.

- [ ] **Step 1: Scaffold the app**

From the repo root:
```bash
npx create-expo-app@latest app --no-install
cd app && ls app/
```
The default template ships expo-router with example screens under `app/app/`. Delete the example content (keep the folder):
```bash
npx tsx -e "0" 2>/dev/null; rm -rf app/app/'(tabs)' app/app/+not-found.tsx app/components app/hooks app/constants app/scripts 2>/dev/null; true
```
(Adjust to what the template actually generated — the goal: `app/app/` keeps only `_layout.tsx`, everything else example-y is gone. If the template has `app-example/` reset script instead, just delete `app-example/`.)

- [ ] **Step 2: Wire the workspace**

Root `package.json` — change the workspaces line:
```json
  "workspaces": ["shared", "server", "app"],
```

`app/package.json` — set the name and add scripts + deps (merge into what the template generated; keep template's expo deps):
```json
{
  "name": "@snap/app",
  "scripts": {
    "start": "expo start",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```
Add dependencies: `"@snap/shared": "*"`, `"zod": "^3.23.8"`. Add devDependencies: `"vitest": "^2.1.0"`.

Then from the repo root:
```bash
npm install
npx expo install expo-camera expo-image-picker expo-sqlite --  # run inside app/: cd app && npx expo install ...
```

- [ ] **Step 3: Monorepo-safe metro config**

`app/metro.config.js`:
```js
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)
config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, 'node_modules'),
  path.join(workspaceRoot, 'node_modules'),
]
module.exports = config
```

- [ ] **Step 4: Vitest config (node env, lib only)**

`app/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['src/lib/**/*.test.ts'], environment: 'node' },
})
```

`app/tsconfig.json` — ensure strict (template extends `expo/tsconfig.base`; add):
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": { "strict": true, "noUncheckedIndexedAccess": true },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 5: Minimal `_layout.tsx` so the app boots**

`app/app/_layout.tsx`:
```tsx
import { Stack } from 'expo-router'

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0f172a' } }} />
  )
}
```
`app/app/index.tsx` (placeholder, replaced in Task 5):
```tsx
import { Text, View } from 'react-native'
export default function Home() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: 'white' }}>Snap-a-Mistake</Text>
    </View>
  )
}
```

- [ ] **Step 6: Verify**

```bash
npm run typecheck -w app     # clean
npm test -w app              # "No test files found" is acceptable at this task only
cd app && npx expo start     # bundles; open in Expo Go or iOS simulator, see placeholder text; Ctrl-C
```
Also confirm the other workspaces still pass: `npm test` at root.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore(app): Expo scaffold wired into monorepo (metro + vitest + strict TS)"
```

---

### Task 2: Mock backend for app development

**Files:**
- Create: `server/scripts/mock.ts`
- Modify: `server/package.json` (add script `"mock": "tsx scripts/mock.ts"`)

**Interfaces:**
- Consumes: `buildApp` from `server/src/app.ts`.
- Produces: `npm run mock -w server` — serves `POST /analyze` on :3000 returning a canned fixture after a 4s delay. `MOCK=correct|error|suspect|unreadable|not-math` picks the fixture (default `error`). No API key needed.

- [ ] **Step 1: Write the mock server**

`server/scripts/mock.ts`:
```ts
import type { AnalyzeResponse } from '@snap/shared'
import { buildApp } from '../src/app.js'

const steps = (verdicts: Array<'ok' | 'wrong' | 'suspect' | 'downstream'>) =>
  verdicts.map((verdict, index) => ({
    index,
    latex: ['\\int x e^x\\,dx', '= x e^x - \\int e^x\\,dx \\cdot x', '= x e^x - x e^x', '= 0'][index] ?? `step_{${index}}`,
    plain: [
      'integral of x times e to the x, dx',
      'x e^x minus the integral of e^x dx, times x',
      'x e^x minus x e^x',
      'equals zero',
    ][index] ?? `step ${index}`,
    yBandTopPct: 8 + index * 20,
    yBandBottomPct: 24 + index * 20,
    verdict,
  }))

const FIXTURES: Record<string, AnalyzeResponse> = {
  correct: {
    kind: 'analysis', steps: steps(['ok', 'ok', 'ok', 'ok']), errorStepIndex: null,
    misconceptionTag: null, explanation: null, followUp: null, verifierAgreed: true,
  },
  error: {
    kind: 'analysis', steps: steps(['ok', 'wrong', 'downstream', 'downstream']), errorStepIndex: 1,
    misconceptionTag: 'integration-by-parts-error',
    explanation:
      'You kept the x inside the remaining integral — integration by parts moves it out: ∫u dv = uv − ∫v du, and du is just dx here. That stray x makes every later line collapse to zero.',
    followUp: { problem: 'Use integration by parts to evaluate ∫ x·2ᵈˣ… try the simpler ∫ x eˣ dx again with u = x, dv = eˣ dx.', concept: 'integration by parts' },
    verifierAgreed: true,
  },
  suspect: {
    kind: 'analysis', steps: steps(['ok', 'suspect', 'downstream', 'downstream']), errorStepIndex: 1,
    misconceptionTag: 'integration-by-parts-error',
    explanation: 'Step 2 may have kept an extra factor of x inside the integral.',
    followUp: { problem: 'Evaluate ∫ x eˣ dx with u = x, dv = eˣ dx.', concept: 'integration by parts' },
    verifierAgreed: false,
  },
  unreadable: { kind: 'unreadable', tips: ['Get more light on the page', 'Flatten the page and shoot from directly above', 'Fit just one problem in the frame'] },
  'not-math': { kind: 'not-math' },
}

const pick = process.env.MOCK ?? 'error'
const fixture = FIXTURES[pick]
if (!fixture) throw new Error(`unknown MOCK fixture "${pick}" (valid: ${Object.keys(FIXTURES).join(', ')})`)

const app = buildApp({
  runAnalysis: async () => {
    await new Promise((r) => setTimeout(r, 4000))
    return fixture
  },
  logger: true,
})
app.listen({ port: 3000, host: '0.0.0.0' }).then(() => {
  console.log(`mock server on :3000 serving fixture "${pick}"`)
})
```

Add to `server/package.json` scripts: `"mock": "tsx scripts/mock.ts"`.

- [ ] **Step 2: Verify**

```bash
npm run typecheck -w server
npm run mock -w server &
sleep 2 && curl -s -F "photo=@server/golden/photos/.gitkeep;type=image/jpeg" http://localhost:3000/analyze | head -c 300
kill %1
```
Expected: JSON starting `{"kind":"analysis","steps":[...` after ~4s. (Any file works — the mock ignores content but the route still requires a `photo` part; if sharp rejects the empty .gitkeep, use any small real image instead.)

- [ ] **Step 3: Commit**

```bash
git add server && git commit -m "feat(server): fixture mock server for app development"
```

---

### Task 3: API client (`analyzePhoto`)

**Files:**
- Create: `app/src/lib/api.ts`, `app/src/lib/api.test.ts`

**Interfaces:**
- Consumes: `AnalyzeResponseSchema`, `AnalyzeResponse` from `@snap/shared`.
- Produces:
  - `API_URL: string`
  - `class ApiError extends Error { failure: { kind: 'network' } | { kind: 'server'; status: number } }`
  - `analyzePhoto(uri: string, fetchFn?: typeof fetch): Promise<AnalyzeResponse>` — multipart POST of the photo file, 35s abort, zod-parsed response.

- [ ] **Step 1: Write the failing tests**

`app/src/lib/api.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import { ApiError, analyzePhoto } from './api.js'

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response
const bad = (status: number) => ({ ok: false, status, json: async () => ({ error: 'x' }) }) as Response

const analysis = {
  kind: 'analysis', steps: [], errorStepIndex: null, misconceptionTag: null,
  explanation: null, followUp: null, verifierAgreed: true,
}

describe('analyzePhoto', () => {
  it('POSTs multipart and returns the parsed response', async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok(analysis))
    const r = await analyzePhoto('file:///photo.jpg', fetchFn)
    expect(r.kind).toBe('analysis')
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/analyze')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
  })
  it('maps non-2xx to ApiError{server,status}', async () => {
    const fetchFn = vi.fn().mockResolvedValue(bad(502))
    await expect(analyzePhoto('file:///p.jpg', fetchFn)).rejects.toMatchObject({ failure: { kind: 'server', status: 502 } })
  })
  it('maps a contract-violating body to ApiError{server}', async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok({ kind: 'nonsense' }))
    await expect(analyzePhoto('file:///p.jpg', fetchFn)).rejects.toMatchObject({ failure: { kind: 'server', status: 200 } })
  })
  it('maps thrown fetch errors to ApiError{network}', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Network request failed'))
    await expect(analyzePhoto('file:///p.jpg', fetchFn)).rejects.toMatchObject({ failure: { kind: 'network' } })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w app` → FAIL (module missing).

- [ ] **Step 3: Implement**

`app/src/lib/api.ts`:
```ts
import { AnalyzeResponseSchema, type AnalyzeResponse } from '@snap/shared'

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export type ApiFailure = { kind: 'network' } | { kind: 'server'; status: number }

export class ApiError extends Error {
  constructor(public failure: ApiFailure) {
    super(failure.kind === 'server' ? `server error ${failure.status}` : 'network error')
  }
}

export async function analyzePhoto(uri: string, fetchFn: typeof fetch = fetch): Promise<AnalyzeResponse> {
  const form = new FormData()
  // React Native FormData accepts {uri, name, type} file descriptors; cast for the DOM types.
  form.append('photo', { uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 35_000)
  let res: Response
  try {
    res = await fetchFn(`${API_URL}/analyze`, { method: 'POST', body: form, signal: controller.signal })
  } catch {
    throw new ApiError({ kind: 'network' })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new ApiError({ kind: 'server', status: res.status })
  const body = await res.json().catch(() => null)
  const parsed = AnalyzeResponseSchema.safeParse(body)
  if (!parsed.success) throw new ApiError({ kind: 'server', status: res.status })
  return parsed.data
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w app` → 4 PASS. `npm run typecheck -w app` → clean.

- [ ] **Step 5: Commit**

```bash
git add app && git commit -m "feat(app): analyzePhoto API client with typed failures"
```

---

### Task 4: Session store + overlay math + tag labels

**Files:**
- Create: `app/src/lib/session.ts`, `app/src/lib/session.test.ts`, `app/src/lib/overlay.ts`, `app/src/lib/overlay.test.ts`, `app/src/lib/labels.ts`, `app/src/lib/labels.test.ts`

**Interfaces:**
- Produces:
  - `getSession(): Session` where `Session = { photoUri: string | null; analysis: AnalyzeResponse | null; followUp: { problem: string; concept: string } | null; isRetry: boolean }`
  - `setPhoto(uri: string)`, `setAnalysis(a: AnalyzeResponse)`, `startFollowUp()`, `resetSession()`
  - `bandStyle(step: { yBandTopPct: number; yBandBottomPct: number }, displayedHeight: number): { top: number; height: number }` (min height 24px, clamped to the image)
  - `tagLabel(tag: MisconceptionTag): string`

- [ ] **Step 1: Write the failing tests**

`app/src/lib/session.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest'
import type { AnalyzeResponse } from '@snap/shared'
import { getSession, resetSession, setAnalysis, setPhoto, startFollowUp } from './session.js'

const withFollowUp: AnalyzeResponse = {
  kind: 'analysis', steps: [], errorStepIndex: 1, misconceptionTag: 'sign-error',
  explanation: 'x', followUp: { problem: 'p', concept: 'c' }, verifierAgreed: true,
}

beforeEach(resetSession)

describe('session', () => {
  it('setPhoto stores the uri and clears any prior analysis', () => {
    setAnalysis(withFollowUp)
    setPhoto('file:///a.jpg')
    expect(getSession().photoUri).toBe('file:///a.jpg')
    expect(getSession().analysis).toBeNull()
  })
  it('setAnalysis captures the followUp problem', () => {
    setAnalysis(withFollowUp)
    expect(getSession().followUp?.problem).toBe('p')
  })
  it('startFollowUp flags a retry and clears photo/analysis but keeps the followUp', () => {
    setPhoto('file:///a.jpg')
    setAnalysis(withFollowUp)
    startFollowUp()
    const s = getSession()
    expect(s.isRetry).toBe(true)
    expect(s.photoUri).toBeNull()
    expect(s.analysis).toBeNull()
    expect(s.followUp?.problem).toBe('p')
  })
  it('resetSession clears everything', () => {
    setPhoto('file:///a.jpg')
    startFollowUp()
    resetSession()
    expect(getSession()).toEqual({ photoUri: null, analysis: null, followUp: null, isRetry: false })
  })
})
```

`app/src/lib/overlay.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { bandStyle } from './overlay.js'

describe('bandStyle', () => {
  it('maps percentages onto the displayed height', () => {
    expect(bandStyle({ yBandTopPct: 10, yBandBottomPct: 30 }, 500)).toEqual({ top: 50, height: 100 })
  })
  it('enforces a 24px minimum band height', () => {
    expect(bandStyle({ yBandTopPct: 50, yBandBottomPct: 51 }, 400).height).toBe(24)
  })
  it('clamps within the image bounds', () => {
    const b = bandStyle({ yBandTopPct: 98, yBandBottomPct: 100 }, 400)
    expect(b.top + b.height).toBeLessThanOrEqual(400)
    expect(b.top).toBeGreaterThanOrEqual(0)
  })
})
```

`app/src/lib/labels.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { MISCONCEPTION_TAGS } from '@snap/shared'
import { tagLabel } from './labels.js'

describe('tagLabel', () => {
  it('has a human label for every tag in the vocabulary', () => {
    for (const tag of MISCONCEPTION_TAGS) {
      expect(tagLabel(tag)).toBeTruthy()
      expect(tagLabel(tag)).not.toContain('-')
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w app` → new files FAIL (modules missing).

- [ ] **Step 3: Implement**

`app/src/lib/session.ts`:
```ts
import type { AnalyzeResponse } from '@snap/shared'

export type Session = {
  photoUri: string | null
  analysis: AnalyzeResponse | null
  followUp: { problem: string; concept: string } | null
  isRetry: boolean
}

let session: Session = { photoUri: null, analysis: null, followUp: null, isRetry: false }

export function getSession(): Session {
  return session
}
export function setPhoto(uri: string): void {
  session = { ...session, photoUri: uri, analysis: null }
}
export function setAnalysis(a: AnalyzeResponse): void {
  const followUp = a.kind === 'analysis' && a.followUp ? a.followUp : session.followUp
  session = { ...session, analysis: a, followUp }
}
export function startFollowUp(): void {
  session = { ...session, isRetry: true, photoUri: null, analysis: null }
}
export function resetSession(): void {
  session = { photoUri: null, analysis: null, followUp: null, isRetry: false }
}
```

`app/src/lib/overlay.ts`:
```ts
export function bandStyle(
  step: { yBandTopPct: number; yBandBottomPct: number },
  displayedHeight: number,
): { top: number; height: number } {
  const rawTop = (step.yBandTopPct / 100) * displayedHeight
  const rawHeight = ((step.yBandBottomPct - step.yBandTopPct) / 100) * displayedHeight
  const height = Math.min(Math.max(rawHeight, 24), displayedHeight)
  const top = Math.min(Math.max(rawTop, 0), displayedHeight - height)
  return { top, height }
}
```

`app/src/lib/labels.ts`:
```ts
import type { MisconceptionTag } from '@snap/shared'

const LABELS: Record<MisconceptionTag, string> = {
  'sign-error': 'Sign error',
  'dropped-term': 'Dropped term',
  'distribution-error': 'Distribution error',
  'chain-rule-missed': 'Chain rule missed',
  'product-rule-misapplied': 'Product rule misapplied',
  'integration-by-parts-error': 'Integration by parts error',
  'u-sub-bounds-error': 'U‑substitution bounds error',
  'algebraic-slip': 'Algebraic slip',
  'exponent-rule-error': 'Exponent rule error',
  'equals-abuse': 'Equals sign misuse',
  other: 'Other misconception',
}

export function tagLabel(tag: MisconceptionTag): string {
  return LABELS[tag]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w app` → 12 PASS total. `npm run typecheck -w app` → clean.

- [ ] **Step 5: Commit**

```bash
git add app && git commit -m "feat(app): session store, overlay band math, tag labels"
```

---

### Task 5: Trends + SQLite history

**Files:**
- Create: `app/src/lib/trends.ts`, `app/src/lib/trends.test.ts`, `app/src/lib/history.ts`

**Interfaces:**
- Produces:
  - `HistoryRecord = { tag: MisconceptionTag | null; correct: boolean; createdAt: string }` (ISO date)
  - `TagSummary = { tag: MisconceptionTag; thisWeek: number; trend: 'more' | 'fewer' | 'same' }`
  - `summarize(records: HistoryRecord[], now: Date): TagSummary[]` — mistakes only, counts last 7 days per tag, trend vs the 7 days before that, sorted by `thisWeek` desc then tag; tags with 0 both weeks omitted.
  - `initDb(): Promise<void>`, `recordAnalysis(e: { tag: MisconceptionTag | null; correct: boolean }): Promise<void>`, `loadHistory(): Promise<HistoryRecord[]>` (SQLite; screens call these — no unit tests, exercised on device).

- [ ] **Step 1: Write the failing tests**

`app/src/lib/trends.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { HistoryRecord } from './history.js'
import { summarize } from './trends.js'

const now = new Date('2026-07-18T12:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()
const rec = (tag: HistoryRecord['tag'], n: number, correct = false): HistoryRecord =>
  ({ tag, correct, createdAt: daysAgo(n) })

describe('summarize', () => {
  it('counts mistakes per tag within the last 7 days', () => {
    const out = summarize([rec('sign-error', 1), rec('sign-error', 3), rec('chain-rule-missed', 2)], now)
    expect(out.find((t) => t.tag === 'sign-error')?.thisWeek).toBe(2)
    expect(out.find((t) => t.tag === 'chain-rule-missed')?.thisWeek).toBe(1)
  })
  it('ignores correct records and null tags', () => {
    const out = summarize([rec('sign-error', 1, true), rec(null, 1)], now)
    expect(out).toEqual([])
  })
  it('marks fewer when this week improved on last week', () => {
    const out = summarize([rec('sign-error', 10), rec('sign-error', 9), rec('sign-error', 2)], now)
    expect(out[0]).toMatchObject({ tag: 'sign-error', thisWeek: 1, trend: 'fewer' })
  })
  it('marks more when this week got worse, and sorts by thisWeek desc', () => {
    const out = summarize(
      [rec('sign-error', 1), rec('sign-error', 2), rec('algebraic-slip', 3)],
      now,
    )
    expect(out[0]).toMatchObject({ tag: 'sign-error', thisWeek: 2, trend: 'more' })
    expect(out[1]).toMatchObject({ tag: 'algebraic-slip', thisWeek: 1 })
  })
  it('drops records older than 14 days from trend math', () => {
    const out = summarize([rec('sign-error', 20), rec('sign-error', 1)], now)
    expect(out[0]).toMatchObject({ thisWeek: 1, trend: 'more' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w app` → FAIL.

- [ ] **Step 3: Implement**

`app/src/lib/trends.ts`:
```ts
import type { MisconceptionTag } from '@snap/shared'
import type { HistoryRecord } from './history.js'

export type TagSummary = { tag: MisconceptionTag; thisWeek: number; trend: 'more' | 'fewer' | 'same' }

const WEEK = 7 * 86_400_000

export function summarize(records: HistoryRecord[], now: Date): TagSummary[] {
  const thisWeek = new Map<MisconceptionTag, number>()
  const lastWeek = new Map<MisconceptionTag, number>()
  for (const r of records) {
    if (r.correct || r.tag === null) continue
    const age = now.getTime() - new Date(r.createdAt).getTime()
    if (age < 0 || age >= 2 * WEEK) continue
    const bucket = age < WEEK ? thisWeek : lastWeek
    bucket.set(r.tag, (bucket.get(r.tag) ?? 0) + 1)
  }
  const tags = new Set<MisconceptionTag>([...thisWeek.keys(), ...lastWeek.keys()])
  return [...tags]
    .map((tag) => {
      const cur = thisWeek.get(tag) ?? 0
      const prev = lastWeek.get(tag) ?? 0
      return { tag, thisWeek: cur, trend: cur > prev ? 'more' : cur < prev ? 'fewer' : 'same' } as TagSummary
    })
    .sort((a, b) => b.thisWeek - a.thisWeek || a.tag.localeCompare(b.tag))
}
```

`app/src/lib/history.ts` (thin SQLite wrapper — no react imports, but expo-sqlite is RN-only, so it is NOT covered by vitest and must never be imported from other `src/lib` modules' tests; `trends.ts` imports only its *type*):
```ts
import * as SQLite from 'expo-sqlite'
import type { MisconceptionTag } from '@snap/shared'

export type HistoryRecord = { tag: MisconceptionTag | null; correct: boolean; createdAt: string }

let db: SQLite.SQLiteDatabase | null = null

export async function initDb(): Promise<void> {
  db = await SQLite.openDatabaseAsync('history.db')
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS analyses (id INTEGER PRIMARY KEY AUTOINCREMENT, tag TEXT, correct INTEGER NOT NULL, createdAt TEXT NOT NULL)',
  )
}

export async function recordAnalysis(e: { tag: MisconceptionTag | null; correct: boolean }): Promise<void> {
  if (!db) await initDb()
  await db!.runAsync('INSERT INTO analyses (tag, correct, createdAt) VALUES (?, ?, ?)', [
    e.tag, e.correct ? 1 : 0, new Date().toISOString(),
  ])
}

export async function loadHistory(): Promise<HistoryRecord[]> {
  if (!db) await initDb()
  const rows = await db!.getAllAsync<{ tag: string | null; correct: number; createdAt: string }>(
    'SELECT tag, correct, createdAt FROM analyses ORDER BY createdAt DESC',
  )
  return rows.map((r) => ({ tag: r.tag as HistoryRecord['tag'], correct: r.correct === 1, createdAt: r.createdAt }))
}
```

**Type-only import caveat:** `trends.ts` uses `import type { HistoryRecord } from './history.js'` — type-only imports are erased at build time, so vitest never loads expo-sqlite. Do not change it to a value import.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w app` → 17 PASS. `npm run typecheck -w app` → clean.

- [ ] **Step 5: Commit**

```bash
git add app && git commit -m "feat(app): trend summarizer and sqlite history store"
```

---

### Task 6: Shared UI components (Screen, StepCard, PhotoOverlay)

**Files:**
- Create: `app/src/components/Screen.tsx`, `app/src/components/StepCard.tsx`, `app/src/components/PhotoOverlay.tsx`

**Interfaces:**
- Consumes: `Step` from `@snap/shared`; `bandStyle` from `src/lib/overlay.ts`; `tagLabel` from `src/lib/labels.ts`.
- Produces:
  - `<Screen>{children}</Screen>` — dark safe-area wrapper (bg `#0f172a`, padding 20).
  - `<StepCard step={Step} misconceptionLabel={string | null} explanation={string | null} />` — verdict icon+color row; expands label+explanation when verdict is `wrong` or `suspect`.
  - `<PhotoOverlay uri={string} steps={Step[]} />` — the photo with red/amber bands over `wrong`/`suspect` steps.

- [ ] **Step 1: Implement Screen**

`app/src/components/Screen.tsx`:
```tsx
import { PropsWithChildren } from 'react'
import { ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>{children}</ScrollView>
    </SafeAreaView>
  )
}
```

- [ ] **Step 2: Implement StepCard**

`app/src/components/StepCard.tsx`:
```tsx
import { Text, View } from 'react-native'
import type { Step } from '@snap/shared'

const VERDICT = {
  ok: { icon: '✓', color: '#22c55e' },
  wrong: { icon: '✗', color: '#ef4444' },
  suspect: { icon: '⚠️', color: '#f59e0b' },
  downstream: { icon: '↓', color: '#94a3b8' },
} as const

export function StepCard(props: { step: Step; misconceptionLabel: string | null; explanation: string | null }) {
  const v = VERDICT[props.step.verdict]
  const expanded = props.step.verdict === 'wrong' || props.step.verdict === 'suspect'
  return (
    <View style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: v.color }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Text style={{ color: v.color, fontSize: 18, width: 24 }}>{v.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#e2e8f0', fontSize: 15 }}>{props.step.plain}</Text>
          <Text style={{ color: '#64748b', fontFamily: 'Courier', fontSize: 12, marginTop: 2 }}>{props.step.latex}</Text>
        </View>
      </View>
      {expanded && (
        <View style={{ marginTop: 10, gap: 4 }}>
          {props.misconceptionLabel && (
            <Text style={{ color: v.color, fontWeight: '700', fontSize: 13 }}>{props.misconceptionLabel}</Text>
          )}
          {props.explanation && <Text style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 20 }}>{props.explanation}</Text>}
        </View>
      )}
    </View>
  )
}
```

- [ ] **Step 3: Implement PhotoOverlay**

`app/src/components/PhotoOverlay.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { Image, View } from 'react-native'
import type { Step } from '@snap/shared'
import { bandStyle } from '../lib/overlay.js'

export function PhotoOverlay(props: { uri: string; steps: Step[] }) {
  const [aspect, setAspect] = useState(4 / 3)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    Image.getSize(props.uri, (w, h) => setAspect(w / h), () => {})
  }, [props.uri])

  const flagged = props.steps.filter((s) => s.verdict === 'wrong' || s.verdict === 'suspect')
  return (
    <View
      style={{ width: '100%', aspectRatio: aspect, borderRadius: 12, overflow: 'hidden' }}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
    >
      <Image source={{ uri: props.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      {height > 0 &&
        flagged.map((s) => {
          const b = bandStyle(s, height)
          const color = s.verdict === 'wrong' ? '#ef4444' : '#f59e0b'
          return (
            <View
              key={s.index}
              pointerEvents="none"
              style={{
                position: 'absolute', left: 0, right: 0, top: b.top, height: b.height,
                borderColor: color, borderWidth: 3, borderRadius: 8, backgroundColor: `${color}22`,
              }}
            />
          )
        })}
    </View>
  )
}
```

- [ ] **Step 4: Verify**

`npm run typecheck -w app` → clean. `npm test -w app` → still 17 PASS (components have no unit tests; they're exercised in Task 7's manual verification).

- [ ] **Step 5: Commit**

```bash
git add app && git commit -m "feat(app): Screen, StepCard, PhotoOverlay components"
```

---

### Task 7: Camera home screen

**Files:**
- Create: `app/app/index.tsx` (replace placeholder)
- Modify: `app/app.json` (camera/photo permission strings)

**Interfaces:**
- Consumes: `setPhoto` from `src/lib/session.ts`; `getSession` (to show a follow-up banner when `isRetry`).
- Produces: the `/` route — camera with framing tips, shutter, gallery pick, Insights link; on photo → `router.push('/analyze')`.

- [ ] **Step 1: Permission strings**

In `app/app.json`, inside `expo.plugins`, ensure expo-camera & expo-image-picker plugins with copy:
```json
"plugins": [
  "expo-router",
  ["expo-camera", { "cameraPermission": "Snap-a-Mistake uses the camera to photograph your handwritten math work." }],
  ["expo-image-picker", { "photosPermission": "Snap-a-Mistake reads photos you choose of your handwritten math work." }]
]
```
(Keep any plugins the template already lists.)

- [ ] **Step 2: Implement the screen**

`app/app/index.tsx`:
```tsx
import { useRef } from 'react'
import { Pressable, Text, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getSession, setPhoto } from '../src/lib/session.js'

export default function Home() {
  const camera = useRef<CameraView>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const isRetry = getSession().isRetry

  const usePhoto = (uri: string) => {
    setPhoto(uri)
    router.push('/analyze')
  }

  const snap = async () => {
    const photo = await camera.current?.takePictureAsync({ quality: 0.7 })
    if (photo?.uri) usePhoto(photo.uri)
  }

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })
    const uri = res.assets?.[0]?.uri
    if (uri) usePhoto(uri)
  }

  if (!permission?.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <Text style={{ color: '#e2e8f0', fontSize: 17, textAlign: 'center' }}>
          Snap-a-Mistake needs the camera to photograph your work.
        </Text>
        <Pressable onPress={requestPermission} style={{ backgroundColor: '#6366f1', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
          <Text style={{ color: 'white', fontWeight: '700' }}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={pick}><Text style={{ color: '#94a3b8' }}>Or pick from your photos</Text></Pressable>
      </SafeAreaView>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <CameraView ref={camera} style={{ flex: 1 }} />
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }} pointerEvents="box-none">
        {isRetry && (
          <View style={{ backgroundColor: '#6366f1', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6, marginTop: 8 }}>
            <Text style={{ color: 'white', fontWeight: '600' }}>Follow-up: snap your new attempt</Text>
          </View>
        )}
        <View style={{ backgroundColor: '#00000088', borderRadius: 10, padding: 10, marginTop: 8 }}>
          <Text style={{ color: 'white', fontSize: 13 }}>💡 Good light · page flat · one problem per shot</Text>
        </View>
      </SafeAreaView>
      <SafeAreaView style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingBottom: 16 }}>
          <Pressable onPress={pick}><Text style={{ color: 'white', fontSize: 15 }}>🖼️ Gallery</Text></Pressable>
          <Pressable
            onPress={snap}
            style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: 'white', borderWidth: 5, borderColor: '#6366f1' }}
          />
          <Pressable onPress={() => router.push('/insights')}><Text style={{ color: 'white', fontSize: 15 }}>📊 Insights</Text></Pressable>
        </View>
      </SafeAreaView>
    </View>
  )
}
```

- [ ] **Step 3: Manual verification**

```bash
cd app && npx expo start
```
On the iOS simulator (no camera: use Gallery with a saved image) or a real phone via Expo Go:
1. Permission screen appears on first launch; granting shows the live camera with the tips pill.
2. Shutter button captures; app navigates to `/analyze` (will 404-render or error — analyze screen arrives in Task 8; a blank/unmatched route is acceptable here).
3. Gallery opens the picker; choosing an image also navigates.
4. `npm run typecheck -w app` clean; `npm test -w app` still green.

- [ ] **Step 4: Commit**

```bash
git add app && git commit -m "feat(app): camera home screen with framing tips and gallery pick"
```

---

### Task 8: Analyzing + Result screen

**Files:**
- Create: `app/app/analyze.tsx`
- Modify: `app/app/_layout.tsx` (init DB once)

**Interfaces:**
- Consumes: `analyzePhoto`, `ApiError` (lib/api), `getSession`/`setAnalysis` (lib/session), `recordAnalysis` (lib/history), `tagLabel` (lib/labels), `PhotoOverlay`, `StepCard`, `Screen`.
- Produces: `/analyze` route covering all five result states (correct / error / suspect / unreadable / not-math) + network-failure state with retry (photo kept). Records history for `kind:'analysis'` only. Buttons: `Try a follow-up` (when a followUp exists), `🎬 Video lesson — coming soon` (disabled), `Snap another`.

- [ ] **Step 1: DB init in the layout**

`app/app/_layout.tsx`:
```tsx
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { initDb } from '../src/lib/history.js'

export default function RootLayout() {
  useEffect(() => { initDb().catch(() => {}) }, [])
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0f172a' } }} />
  )
}
```

- [ ] **Step 2: Implement the analyze screen**

`app/app/analyze.tsx`:
```tsx
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import type { AnalyzeResponse } from '@snap/shared'
import { ApiError, analyzePhoto } from '../src/lib/api.js'
import { getSession, setAnalysis, startFollowUp, resetSession } from '../src/lib/session.js'
import { recordAnalysis } from '../src/lib/history.js'
import { tagLabel } from '../src/lib/labels.js'
import { Screen } from '../src/components/Screen.js'
import { StepCard } from '../src/components/StepCard.js'
import { PhotoOverlay } from '../src/components/PhotoOverlay.js'

const STAGES = ['Reading your handwriting…', 'Checking each step…', 'Verifying the diagnosis…']

function Button(props: { label: string; onPress?: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={{
        backgroundColor: props.disabled ? '#334155' : props.primary ? '#6366f1' : '#1e293b',
        borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: props.disabled ? 0.6 : 1,
      }}
    >
      <Text style={{ color: props.disabled ? '#94a3b8' : 'white', fontWeight: '700', fontSize: 15 }}>{props.label}</Text>
    </Pressable>
  )
}

export default function Analyze() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [failed, setFailed] = useState(false)
  const [stage, setStage] = useState(0)
  const uri = getSession().photoUri

  const run = useCallback(() => {
    if (!uri) { router.replace('/'); return }
    setFailed(false)
    setResult(null)
    setStage(0)
    analyzePhoto(uri)
      .then((r) => {
        setAnalysis(r)
        setResult(r)
        if (r.kind === 'analysis') {
          void recordAnalysis({ tag: r.misconceptionTag, correct: r.errorStepIndex === null })
        }
      })
      .catch((e: unknown) => {
        void e
        setFailed(true)
      })
  }, [uri])

  useEffect(run, [run])
  useEffect(() => {
    if (result || failed) return
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 3000)
    return () => clearInterval(t)
  }, [result, failed])

  const snapAnother = () => { resetSession(); router.replace('/') }

  if (failed) {
    return (
      <Screen>
        <Text style={{ color: '#e2e8f0', fontSize: 20, fontWeight: '700' }}>Couldn't reach the tutor 😕</Text>
        <Text style={{ color: '#94a3b8' }}>Your photo is saved — check your connection and try again.</Text>
        <Button label="Try again" onPress={run} primary />
        <Button label="Snap another" onPress={snapAnother} />
      </Screen>
    )
  }

  if (!result) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', marginTop: 120, gap: 20 }}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={{ color: '#e2e8f0', fontSize: 17 }}>{STAGES[stage]}</Text>
        </View>
      </Screen>
    )
  }

  if (result.kind === 'not-math') {
    return (
      <Screen>
        <Text style={{ color: '#e2e8f0', fontSize: 20, fontWeight: '700' }}>I only speak math for now 📐</Text>
        <Text style={{ color: '#94a3b8' }}>Snap a photo of handwritten algebra or calculus work.</Text>
        <Button label="Retake" onPress={snapAnother} primary />
      </Screen>
    )
  }

  if (result.kind === 'unreadable') {
    return (
      <Screen>
        <Text style={{ color: '#e2e8f0', fontSize: 20, fontWeight: '700' }}>I couldn't read that clearly</Text>
        {result.tips.map((tip) => (
          <Text key={tip} style={{ color: '#94a3b8', fontSize: 15 }}>• {tip}</Text>
        ))}
        <Button label="Retake" onPress={snapAnother} primary />
      </Screen>
    )
  }

  const correct = result.errorStepIndex === null
  const suspect = !correct && !result.verifierAgreed
  const label = result.misconceptionTag ? tagLabel(result.misconceptionTag) : null

  return (
    <Screen>
      {correct ? (
        <View style={{ backgroundColor: '#14532d', borderRadius: 12, padding: 16 }}>
          <Text style={{ color: '#86efac', fontSize: 20, fontWeight: '800' }}>All steps check out ✓</Text>
          <Text style={{ color: '#bbf7d0', marginTop: 4 }}>Every step follows from the last — clean work.</Text>
        </View>
      ) : suspect ? (
        <View style={{ backgroundColor: '#451a03', borderRadius: 12, padding: 16 }}>
          <Text style={{ color: '#fbbf24', fontSize: 17, fontWeight: '700' }}>
            I'm not fully sure about step {result.errorStepIndex} — want to walk through it?
          </Text>
        </View>
      ) : null}
      {uri && <PhotoOverlay uri={uri} steps={result.steps} />}
      {result.steps.map((s) => (
        <StepCard
          key={s.index}
          step={s}
          misconceptionLabel={s.index === result.errorStepIndex ? label : null}
          explanation={s.index === result.errorStepIndex ? result.explanation : null}
        />
      ))}
      {result.followUp && !correct && (
        <Button label="Try a follow-up" onPress={() => router.push('/followup')} primary />
      )}
      <Button label="🎬 Video lesson — coming soon" disabled />
      <Button label="Snap another" onPress={snapAnother} />
    </Screen>
  )
}
```

- [ ] **Step 3: Manual verification against the mock server**

Terminal 1: `MOCK=error npm run mock -w server`
Terminal 2: `cd app && EXPO_PUBLIC_API_URL=http://<your-Mac-LAN-IP>:3000 npx expo start`
(Simulator can use `http://localhost:3000`; a phone needs the Mac's LAN IP — find with `ipconfig getifaddr en0`.)

Walk each fixture by restarting the mock with `MOCK=`:
1. `error` — staged messages advance ~3s apart; then photo with red band, ✓/✗/↓ cards, expanded misconception + explanation on the flagged card, `Try a follow-up` visible, video button disabled.
2. `correct` — green `All steps check out ✓` card, no follow-up button.
3. `suspect` — amber card with the exact softened copy; band renders amber.
4. `unreadable` — three tips + Retake.
5. `not-math` — `I only speak math for now 📐`.
6. Kill the mock server → analyze → failure state with `Try again`; restart mock, `Try again` succeeds without re-snapping.

- [ ] **Step 4: Typecheck + tests still green**

`npm run typecheck -w app` and `npm test -w app` → clean/17 PASS.

- [ ] **Step 5: Commit**

```bash
git add app && git commit -m "feat(app): analyzing + result screen for all response states"
```

---

### Task 9: Follow-up loop

**Files:**
- Create: `app/app/followup.tsx`

**Interfaces:**
- Consumes: `getSession`, `startFollowUp` (lib/session), `Screen`.
- Produces: `/followup` route — shows the generated problem big + concept chip; `I'm done — check it` sets retry mode and returns to the camera, closing the loop.

- [ ] **Step 1: Implement**

`app/app/followup.tsx`:
```tsx
import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { getSession, startFollowUp } from '../src/lib/session.js'
import { Screen } from '../src/components/Screen.js'

export default function FollowUp() {
  const followUp = getSession().followUp
  if (!followUp) {
    return (
      <Screen>
        <Text style={{ color: '#94a3b8' }}>No follow-up problem yet — analyze some work first.</Text>
        <Pressable onPress={() => router.replace('/')}><Text style={{ color: '#6366f1', fontWeight: '700' }}>Back to camera</Text></Pressable>
      </Screen>
    )
  }
  return (
    <Screen>
      <View style={{ backgroundColor: '#312e81', alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
        <Text style={{ color: '#c7d2fe', fontSize: 13, fontWeight: '600' }}>{followUp.concept}</Text>
      </View>
      <Text style={{ color: '#e2e8f0', fontSize: 24, lineHeight: 34, fontWeight: '600', marginTop: 8 }}>
        {followUp.problem}
      </Text>
      <Text style={{ color: '#94a3b8', marginTop: 8 }}>Work it out on paper, then snap your solution.</Text>
      <Pressable
        onPress={() => { startFollowUp(); router.replace('/') }}
        style={{ backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 }}
      >
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>I'm done — check it</Text>
      </Pressable>
    </Screen>
  )
}
```

- [ ] **Step 2: Manual verification**

With `MOCK=error` running: analyze → `Try a follow-up` → problem shows big with concept chip → `I'm done — check it` → camera shows the `Follow-up: snap your new attempt` banner → snapping runs a fresh analysis. Switch mock to `correct` before the retry to rehearse the demo's redemption beat.

- [ ] **Step 3: Commit**

```bash
git add app && git commit -m "feat(app): follow-up problem screen closing the retry loop"
```

---

### Task 10: Insights screen

**Files:**
- Create: `app/app/insights.tsx`

**Interfaces:**
- Consumes: `loadHistory` (lib/history), `summarize` (lib/trends), `tagLabel` (lib/labels), `Screen`.
- Produces: `/insights` route — per-tag mistake counts this week with trend arrows (`fewer` → `improving ↗`, `more` → `↘ watch this`, `same` → `→ steady`), plus an empty state.

- [ ] **Step 1: Implement**

`app/app/insights.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { loadHistory } from '../src/lib/history.js'
import { summarize, type TagSummary } from '../src/lib/trends.js'
import { tagLabel } from '../src/lib/labels.js'
import { Screen } from '../src/components/Screen.js'

const TREND = {
  fewer: { text: 'improving ↗', color: '#22c55e' },
  more: { text: '↘ watch this', color: '#ef4444' },
  same: { text: '→ steady', color: '#94a3b8' },
} as const

export default function Insights() {
  const [rows, setRows] = useState<TagSummary[] | null>(null)

  useEffect(() => {
    loadHistory().then((records) => setRows(summarize(records, new Date()))).catch(() => setRows([]))
  }, [])

  return (
    <Screen>
      <Pressable onPress={() => router.back()}><Text style={{ color: '#6366f1', fontWeight: '700' }}>‹ Back</Text></Pressable>
      <Text style={{ color: '#e2e8f0', fontSize: 24, fontWeight: '800' }}>Your patterns</Text>
      {rows === null ? (
        <Text style={{ color: '#94a3b8' }}>Loading…</Text>
      ) : rows.length === 0 ? (
        <Text style={{ color: '#94a3b8' }}>No misconceptions tracked yet — snap some work and I'll start spotting patterns.</Text>
      ) : (
        rows.map((r) => (
          <View key={r.tag} style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: '#e2e8f0', fontSize: 16, fontWeight: '600' }}>{tagLabel(r.tag)}</Text>
              <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>
                {r.thisWeek} this week
              </Text>
            </View>
            <Text style={{ color: TREND[r.trend].color, fontWeight: '700' }}>{TREND[r.trend].text}</Text>
          </View>
        ))
      )}
    </Screen>
  )
}
```

- [ ] **Step 2: Manual verification**

With `MOCK=error` running, analyze 2-3 photos, then open Insights from the camera screen: `Integration by parts error — N this week` with a trend marker. Fresh install (or simulator reset) shows the empty state.

- [ ] **Step 3: Full-suite gate**

`npm test` (root) → all workspaces green. `npm run typecheck` (root) → clean.

- [ ] **Step 4: Commit**

```bash
git add app && git commit -m "feat(app): insights screen with weekly misconception trends"
```

---

## After this plan

- **Live smoke test:** put `ANTHROPIC_API_KEY` in `server/.env`, run `npm run dev -w server`, point `EXPO_PUBLIC_API_URL` at it, snap real Calc III work end-to-end.
- **Golden set:** photograph the ~15-case set into `server/golden/photos/`, fill `manifest.json`, iterate prompts against `npm run golden -w server`.
- **Demo prep:** deploy server to Railway, set `EXPO_PUBLIC_API_URL` to it, record the 2-minute video (error → explanation → follow-up → green ✓ → insights).

## Self-Review Notes

- Spec coverage: all five screens ✅ (Tasks 7–10 + analyze covering the Analyzing state), staged progress copy ✅, overlay band + step cards ✅ (Task 6/8), correct-work green state ✅, verifier-softened suspect state ✅, follow-up loop with camera banner ✅, SQLite history + patterns ✅, retake tips (server-provided) rendered ✅, video-lesson slot reserved-and-disabled ✅, API failure keeps the photo and offers retry ✅. Server-side spec items were Plan 1.
- Type consistency: `Session`/`HistoryRecord`/`TagSummary`/`bandStyle`/`tagLabel` names match across Tasks 3–10; `trends.ts` imports `HistoryRecord` type-only from `history.ts` (caveat documented in Task 5).
- Testing split is deliberate: pure logic (api/session/overlay/labels/trends) is TDD'd in vitest; RN screens/components ship with concrete mock-server manual scripts instead of a heavyweight jest-native harness — right trade for a 12-day hackathon.
- No placeholders: every code step is complete; the only deferred work is listed under "After this plan".
