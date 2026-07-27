# Unreadable Photo Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a student permanently discard an unreadable scan or explicitly analyze its uncertain transcript once, without weakening safeguards for later scans.

**Architecture:** Add a request-scoped `allowUncertainTranscript` option from the Expo multipart client through Fastify to the stateless analysis pipeline. Keep non-math and empty-transcript rejection absolute, but let the explicit override continue past low legibility or a failed fidelity audit. Add a focused app transition that atomically deletes the unreadable scan/session, flushes owned-photo cleanup, and navigates to capture.

**Tech Stack:** TypeScript, Expo Router, React Native, Fastify multipart, Zod contracts, SQLite repository, Vitest, Expo lint/export.

## Global Constraints

- The default analysis path remains conservative and unchanged for requests without the override.
- `allowUncertainTranscript` applies to one `/analyze` request only and is never persisted as a preference.
- Non-math input and a transcript containing zero steps cannot be forced through.
- “Take a new photo” permanently removes the unreadable scan from Previous scans and Patterns and queues/removes its owned photo.
- “Proceed anyway” clearly displays “Results may be less accurate.”
- Unknown, duplicate, malformed, or truncated multipart fields fail before model invocation.
- Network, timeout, server, persistence, and deletion failures must preserve recoverable local state.
- No new runtime dependency is permitted.
- Preserve the premium black-and-white interface, using only existing semantic accents.

---

## File structure

- `server/src/pipeline/run.ts` — owns request-scoped pipeline policy and absolute/overridable rejection rules.
- `server/src/app.ts` — parses and validates the optional multipart override before invoking the pipeline.
- `server/test/run.test.ts` — proves default and override pipeline behavior.
- `server/test/app.test.ts` — proves strict multipart parsing and option forwarding.
- `app/src/lib/api.ts` — serializes the request-scoped override.
- `app/src/lib/api.test.ts` — proves default requests omit the field and override requests include exactly `true`.
- `app/src/lib/unreadableRecovery.ts` — coordinates permanent unreadable-scan deletion independently of React rendering.
- `app/src/lib/unreadableRecovery.test.ts` — proves operation ordering, retry safety, and cleanup behavior.
- `app/src/ui/presentation.ts` — owns unreadable copy and action vocabulary.
- `app/src/ui/presentation.test.ts` — proves the warning and action priority.
- `app/app/analyze.tsx` — binds forced retry, deletion, busy/error states, and system-back behavior to the result screen.
- `app/src/ui/analyzeScreen.test.ts` — source-level guard for the two visible unreadable actions and warning.
- `README.md` and `docs/validation/2026-07-22-prometheus-readiness.md` — document the request-scoped override and final evidence.

---

### Task 1: Request-scoped server override

**Files:**
- Modify: `server/src/pipeline/run.ts`
- Modify: `server/src/app.ts`
- Test: `server/test/run.test.ts`
- Test: `server/test/app.test.ts`

**Interfaces:**
- Produces: `AnalysisOptions = { allowUncertainTranscript?: boolean }`
- Changes: `RunAnalysisFn` to `(image, options?: AnalysisOptions) => Promise<AnalyzeResponse>`
- Consumes later: the Expo client sends multipart field `allowUncertainTranscript=true`

- [ ] **Step 1: Write failing pipeline tests**

Add tests showing the default path remains strict and the override is narrow:

```ts
it('keeps low-legibility rejection strict by default', async () => {
  expect(await run({ s1: s1({ legibility: 0.3 }) })).toMatchObject({ kind: 'unreadable' })
})

it('continues past uncertain transcription only for an explicit override', async () => {
  const analyze = makeRunAnalysis(client, config, {
    transcribe: async () => s1({ legibility: 0.3 }),
    verifyTranscription: async () => ({ faithful: false, legible: false, note: 'uncertain' }),
    analyzeSteps: async () => errorDiag,
    verifyDiagnosis: async () => ({ agrees: true, note: '' }),
  })

  const result = await analyze(image, { allowUncertainTranscript: true })
  expect(result).toMatchObject({
    kind: 'analysis',
    errorStepIndex: 1,
    misconceptionTag: 'sign-error',
  })
})

it('does not force an empty transcript through', async () => {
  const analyze = makeRunAnalysis(client, config, {
    transcribe: async () => s1({ legibility: 0.2, steps: [] }),
    verifyTranscription: async () => ({ faithful: false, legible: false, note: 'empty' }),
    analyzeSteps: async () => cleanDiag,
    verifyDiagnosis: async () => ({ agrees: true, note: '' }),
  })
  await expect(analyze(image, { allowUncertainTranscript: true }))
    .resolves.toMatchObject({ kind: 'unreadable' })
})
```

- [ ] **Step 2: Run the pipeline tests and verify RED**

Run:

```bash
npm run test:vitest -w server -- --run test/run.test.ts
```

Expected: FAIL because `RunAnalysisFn` and the returned function do not accept analysis options, and low legibility still returns before the override can act.

- [ ] **Step 3: Implement the minimal pipeline policy**

In `server/src/app.ts`, export:

```ts
export type AnalysisOptions = { allowUncertainTranscript?: boolean }
export type RunAnalysisFn = (
  image: { base64: string; mediaType: 'image/jpeg' },
  options?: AnalysisOptions,
) => Promise<AnalyzeResponse>
```

In `server/src/pipeline/run.ts`, default options to `{}` and enforce:

```ts
if (!s1.isMath) return { kind: 'not-math' }
if (s1.steps.length === 0) return { kind: 'unreadable', tips: RETAKE_TIPS }
if (!options.allowUncertainTranscript && s1.legibility < config.legibilityThreshold)
  return { kind: 'unreadable', tips: RETAKE_TIPS }

const transcriptionCheck = await timeStage(/* existing fidelity call */)
if (
  !options.allowUncertainTranscript
  && (!transcriptionCheck.faithful || !transcriptionCheck.legible)
) return { kind: 'unreadable', tips: RETAKE_TIPS }
```

For a default low-legibility result, preserve the existing early return and avoid an unnecessary paid fidelity call. For an overridden request with steps, run the fidelity call for audit information but do not let its result block diagnosis.

- [ ] **Step 4: Run the pipeline tests and verify GREEN**

Run:

```bash
npm run test:vitest -w server -- --run test/run.test.ts
```

Expected: PASS, including the existing default unreadable tests.

- [ ] **Step 5: Write failing Fastify multipart tests**

Add route tests that capture the received options:

```ts
it('forwards the exact proceed-anyway override', async () => {
  let received: AnalysisOptions | undefined
  const app = buildApp(appDeps({
    runAnalysis: async (_image, options) => {
      received = options
      return { kind: 'unreadable', tips: ['more light'] }
    },
  }))
  const form = formAutoContent({
    photo: await tinyJpeg(),
    allowUncertainTranscript: 'true',
  })

  const response = await app.inject({ method: 'POST', url: '/analyze', ...form })
  expect(response.statusCode).toBe(200)
  expect(received).toEqual({ allowUncertainTranscript: true })
})
```

Add table cases for value `false`, value `1`, an unknown field, a duplicate file/field, missing photo, and oversized/truncated fields. Each must return `400` and leave `runAnalysis` uncalled.

- [ ] **Step 6: Run the route tests and verify RED**

Run:

```bash
npm run test:vitest -w server -- --run test/app.test.ts
```

Expected: FAIL because `/analyze` currently consumes only `req.file()` and does not validate or forward the field.

- [ ] **Step 7: Implement strict `/analyze` multipart parsing**

Replace the single `req.file()` read with a `for await (const part of req.parts())` loop following the established `/correct-diagnosis` pattern:

```ts
let photo: Buffer | undefined
let allowUncertainTranscript = false
let overrideSeen = false
let invalid = false

for await (const part of req.parts()) {
  if (part.type === 'file') {
    if (part.fieldname !== 'photo' || photo !== undefined) invalid = true
    const bytes = await part.toBuffer()
    if (!invalid && photo === undefined) photo = bytes
    continue
  }
  if (
    part.fieldname !== 'allowUncertainTranscript'
    || overrideSeen
    || part.valueTruncated
    || part.value !== 'true'
  ) {
    invalid = true
  } else {
    overrideSeen = true
    allowUncertainTranscript = true
  }
}
```

Return `{ error: 'invalid analysis request' }` with status `400` for invalid input and invoke:

```ts
deps.runAnalysis(await normalizeJpeg(photo), { allowUncertainTranscript })
```

Map multipart limits to the same `400` contract rather than leaking `500`.

- [ ] **Step 8: Run server tests and typechecking**

Run:

```bash
npm run test:vitest -w server -- --run test/run.test.ts test/app.test.ts
npm run typecheck -w server
```

Expected: PASS.

- [ ] **Step 9: Commit the server boundary**

```bash
git add server/src/app.ts server/src/pipeline/run.ts server/test/app.test.ts server/test/run.test.ts
git commit -m "feat: allow explicit uncertain analysis"
```

---

### Task 2: Expo client override

**Files:**
- Modify: `app/src/lib/api.ts`
- Test: `app/src/lib/api.test.ts`

**Interfaces:**
- Consumes: `allowUncertainTranscript=true` accepted by `/analyze`
- Produces: `AnalyzeRequestOptions = RequestOptions & { allowUncertainTranscript?: boolean }`
- Used later: `analyzePhoto(uri, { signal, allowUncertainTranscript: true })`

- [ ] **Step 1: Write failing client serialization tests**

Add:

```ts
it('omits the uncertainty override on normal analysis', async () => {
  const fetchFn = vi.fn().mockResolvedValue(ok(analysis))
  await analyzePhoto('file:///photo.jpg', { fetchFn })
  const body = fetchFn.mock.calls[0]?.[1]?.body as FormData
  expect(body.has('allowUncertainTranscript')).toBe(false)
})

it('sends the exact uncertainty override only when requested', async () => {
  const fetchFn = vi.fn().mockResolvedValue(ok(analysis))
  await analyzePhoto('file:///photo.jpg', {
    fetchFn,
    allowUncertainTranscript: true,
  })
  const body = fetchFn.mock.calls[0]?.[1]?.body as FormData
  expect(body.get('allowUncertainTranscript')).toBe('true')
})
```

- [ ] **Step 2: Run the client test and verify RED**

Run:

```bash
npm test -w app -- --run src/lib/api.test.ts
```

Expected: TypeScript transform or assertion failure because `analyzePhoto` does not support or serialize the option.

- [ ] **Step 3: Implement minimal client support**

Keep cancellation and transport options private to `requestApi`, and add:

```ts
export type AnalyzeRequestOptions = RequestOptions & {
  allowUncertainTranscript?: boolean
}
```

Update only `analyzePhoto`:

```ts
export async function analyzePhoto(
  uri: string,
  options: AnalyzeRequestOptions = {},
): Promise<AnalyzeResponse> {
  const form = new FormData()
  form.append('photo', new File(uri), 'photo.jpg')
  if (options.allowUncertainTranscript)
    form.append('allowUncertainTranscript', 'true')
  return requestApi('/analyze', { body: form }, AnalyzeResponseSchema.safeParse, options)
}
```

Leave `correctDiagnosis` and follow-up requests unchanged.

- [ ] **Step 4: Run client tests and typechecking**

Run:

```bash
npm test -w app -- --run src/lib/api.test.ts
npm run typecheck -w app
```

Expected: PASS.

- [ ] **Step 5: Commit the client boundary**

```bash
git add app/src/lib/api.ts app/src/lib/api.test.ts
git commit -m "feat: send uncertain analysis override"
```

---

### Task 3: Permanent unreadable-scan discard transition

**Files:**
- Create: `app/src/lib/unreadableRecovery.ts`
- Create: `app/src/lib/unreadableRecovery.test.ts`
- Modify: `app/app/analyze.tsx`

**Interfaces:**
- Produces:

```ts
export type DiscardUnreadableDependencies = {
  deleteScan(scanId: string): Promise<unknown>
  clearSession(scanId: string): Promise<void>
  flushOwnedPhotos(): Promise<void>
  navigate(): void
}

export function createUnreadableDiscardTransition(): {
  discard(scanId: string, deps: DiscardUnreadableDependencies): Promise<void>
}
```

- Consumes: repository `delete`, `clearSessionForDeletedScan`, and `flushCleanupQueue`

- [ ] **Step 1: Write failing transition tests**

Create tests proving ordering, coalescing, deletion failure, and cleanup-queue tolerance:

```ts
it('deletes the scan before clearing memory and navigating', async () => {
  const calls: string[] = []
  const transition = createUnreadableDiscardTransition()
  await transition.discard('scan-1', {
    deleteScan: async () => { calls.push('delete') },
    clearSession: async () => { calls.push('clear') },
    flushOwnedPhotos: async () => { calls.push('flush') },
    navigate: () => { calls.push('navigate') },
  })
  expect(calls).toEqual(['delete', 'clear', 'flush', 'navigate'])
})

it('does not clear or navigate when transactional deletion fails', async () => {
  const calls: string[] = []
  const transition = createUnreadableDiscardTransition()
  await expect(transition.discard('scan-1', {
    deleteScan: async () => { throw new Error('database unavailable') },
    clearSession: async () => { calls.push('clear') },
    flushOwnedPhotos: async () => { calls.push('flush') },
    navigate: () => { calls.push('navigate') },
  })).rejects.toThrow('database unavailable')
  expect(calls).toEqual([])
})
```

Add a coalescing test that calls `discard` twice before deletion settles and expects each dependency exactly once. Add a test where `flushOwnedPhotos` rejects but navigation still occurs because database deletion already committed and the queue is durable.

- [ ] **Step 2: Run the transition tests and verify RED**

Run:

```bash
npm test -w app -- --run src/lib/unreadableRecovery.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the focused transition**

Implement one in-flight promise. Treat physical cleanup as best-effort only after deletion and session clearing:

```ts
export function createUnreadableDiscardTransition() {
  let active: Promise<void> | null = null
  return {
    discard(scanId: string, deps: DiscardUnreadableDependencies) {
      if (active) return active
      const work = (async () => {
        await deps.deleteScan(scanId)
        await deps.clearSession(scanId)
        await deps.flushOwnedPhotos().catch(() => {})
        deps.navigate()
      })()
      const tracked = work.finally(() => {
        if (active === tracked) active = null
      })
      active = tracked
      return tracked
    },
  }
}
```

- [ ] **Step 4: Run the transition tests and verify GREEN**

Run:

```bash
npm test -w app -- --run src/lib/unreadableRecovery.test.ts
```

Expected: PASS.

- [ ] **Step 5: Wire deletion into Analyze with a failing source guard**

First update `app/src/ui/analyzeScreen.test.ts` to require `createUnreadableDiscardTransition`, `clearSessionForDeletedScan`, `flushCleanupQueue`, and the label `Take a new photo`. Run it before editing the screen:

```bash
npm test -w app -- --run src/ui/analyzeScreen.test.ts
```

Expected: FAIL because Analyze still renders `Return to review`.

- [ ] **Step 6: Implement unreadable deletion state**

In `app/app/analyze.tsx`:

- Add one transition ref.
- Add `discardingUnreadable` and `unreadableDiscardFailed` state.
- Build `takeNewUnreadablePhoto` that invalidates correction work, calls repository `delete(scanId)`, clears the matching in-memory session with `clearSessionForDeletedScan(scanId)`, flushes cleanup, and routes to `/`.
- Disable both unreadable actions while deletion is active.
- Show a retryable error without navigating when transactional deletion fails.
- Route system back through this deletion action when `result.kind === 'unreadable'`; keep existing result reset behavior for other result kinds.

Use `router.dismissTo('/')` only after the transition completes.

- [ ] **Step 7: Run focused app tests**

Run:

```bash
npm test -w app -- --run src/lib/unreadableRecovery.test.ts src/ui/analyzeScreen.test.ts src/lib/routeNavigation.test.ts
npm run typecheck -w app
```

Expected: PASS.

- [ ] **Step 8: Commit permanent discard**

```bash
git add app/app/analyze.tsx app/src/lib/unreadableRecovery.ts app/src/lib/unreadableRecovery.test.ts app/src/ui/analyzeScreen.test.ts
git commit -m "feat: discard unreadable scans before retake"
```

---

### Task 4: Proceed-anyway UI and retry semantics

**Files:**
- Modify: `app/src/ui/presentation.ts`
- Modify: `app/src/ui/presentation.test.ts`
- Modify: `app/app/analyze.tsx`
- Modify: `app/src/ui/analyzeScreen.test.ts`

**Interfaces:**
- Consumes: `analyzePhoto(uri, { allowUncertainTranscript: true, signal })`
- Produces: unreadable actions `['capture', 'proceed-anyway']`
- Preserves: the last request mode across transport retries, but never across a new scan

- [ ] **Step 1: Write failing presentation tests**

Change unreadable expectations to:

```ts
expect(analysisRecoveryPresentation({
  kind: 'unreadable',
  tips: ['Use better light.'],
})).toMatchObject({
  title: 'This photo is too hard to read.',
  detail: 'Take a new photo, or continue with a less certain reading.',
  actions: ['capture', 'proceed-anyway'],
})
```

Add source guards requiring:

```ts
expect(analyzeScreen).toContain('label="Proceed anyway"')
expect(analyzeScreen).toContain('Results may be less accurate.')
const unreadableStart = analyzeScreen.indexOf("if (result.kind === 'unreadable')")
const unreadableEnd = analyzeScreen.indexOf('const correct =', unreadableStart)
const unreadableBranch = analyzeScreen.slice(unreadableStart, unreadableEnd)
expect(unreadableStart).toBeGreaterThan(-1)
expect(unreadableEnd).toBeGreaterThan(unreadableStart)
expect(unreadableBranch).not.toContain('Return to review')
```

- [ ] **Step 2: Run the presentation tests and verify RED**

Run:

```bash
npm test -w app -- --run src/ui/presentation.test.ts src/ui/analyzeScreen.test.ts
```

Expected: FAIL because unreadable exposes only `review`, has no warning, and has no proceed action.

- [ ] **Step 3: Update the presentation contract**

Expand:

```ts
type RecoveryAction = 'retry' | 'review' | 'capture' | 'proceed-anyway'
```

Return exact unreadable copy:

```ts
{
  eyebrow: 'UNREADABLE',
  title: 'This photo is too hard to read.',
  detail: 'Take a new photo, or continue with a less certain reading.',
  actions: ['capture', 'proceed-anyway'],
}
```

- [ ] **Step 4: Add forced-run and retry-mode state to Analyze**

Refactor `run` to accept:

```ts
type AnalysisRunOptions = { allowUncertainTranscript: boolean }
```

Maintain a ref:

```ts
const retryRunOptions = useRef<AnalysisRunOptions>({
  allowUncertainTranscript: false,
})
```

At each run, set the ref before the request and call:

```ts
const response = await analyzePhoto(uri, {
  signal: controller.signal,
  allowUncertainTranscript: options.allowUncertainTranscript,
})
```

Initial analysis always invokes `run({ allowUncertainTranscript: false })`. “Proceed anyway” invokes `run({ allowUncertainTranscript: true })`. Recovery “Try again” invokes `run(retryRunOptions.current)` so a network failure during the explicit override does not silently revert to strict mode.

Track whether the most recent completed request was forced. If it returns unreadable again, show:

```text
There still wasn’t enough readable math to analyze.
```

Do not trigger another request automatically.

- [ ] **Step 5: Render the approved unreadable actions**

Render:

```tsx
<AppButton
  label={discardingUnreadable ? 'Removing photo…' : 'Take a new photo'}
  disabled={discardingUnreadable}
  onPress={takeNewUnreadablePhoto}
/>
<Text style={styles.stateWarning}>Results may be less accurate.</Text>
<AppButton
  label="Proceed anyway"
  disabled={discardingUnreadable}
  onPress={() => run({ allowUncertainTranscript: true })}
  variant="secondary"
/>
```

Keep tips visible. Remove `Return to review` from only the unreadable branch. Announce the override start as “Analyzing with lower confidence.”

- [ ] **Step 6: Run focused UI tests and typechecking**

Run:

```bash
npm test -w app -- --run src/ui/presentation.test.ts src/ui/analyzeScreen.test.ts src/lib/api.test.ts src/lib/unreadableRecovery.test.ts
npm run typecheck -w app
```

Expected: PASS.

- [ ] **Step 7: Commit proceed-anyway UX**

```bash
git add app/app/analyze.tsx app/src/ui/presentation.ts app/src/ui/presentation.test.ts app/src/ui/analyzeScreen.test.ts
git commit -m "feat: add proceed anyway recovery"
```

---

### Task 5: Documentation and complete verification

**Files:**
- Modify: `README.md`
- Modify: `docs/validation/2026-07-22-prometheus-readiness.md`

**Interfaces:**
- Documents the finished behavior and evidence; produces no runtime interface.

- [ ] **Step 1: Update user and architecture documentation**

Document:

- Strict analysis remains the default.
- “Proceed anyway” is a one-request override and may be less accurate.
- Blank and non-math inputs remain blocked.
- “Take a new photo” deletes the unreadable attempt and owned image.

Update automated test totals only after reading the final full-suite output.

- [ ] **Step 2: Run the full automated verification**

Run:

```bash
npm test
npm run typecheck
npm run lint -w app
(cd app && npx expo export --platform ios --output-dir /tmp/snap-a-mistake-unreadable-recovery)
git diff --check
```

Expected: every command exits `0`; all shared, server, importer, and app tests pass; the iOS bundle exports successfully.

- [ ] **Step 3: Run focused live checks**

With the approved API key and live server:

1. Submit a clear readable integration-by-parts error through the default path and confirm the wrong step is preserved and diagnosed.
2. Submit a moderately blurred version through the default path and confirm unreadable.
3. Submit the same blurred version with `allowUncertainTranscript=true`. Accept either a schema-valid analysis preserving visible work or unreadable only when zero steps were transcribed.
4. Record outcomes honestly in the validation document without claiming a full golden pass.

- [ ] **Step 4: Perform the physical-phone checklist**

- Default unreadable result shows both approved actions and the warning.
- “Take a new photo” opens capture; the deleted attempt is absent from Previous scans and Patterns after restart.
- “Proceed anyway” shows progress and never returns automatically to camera.
- A forced network failure retries in forced mode.
- A second unreadable response stays on the recovery screen.
- Button busy states prevent double submission.
- VoiceOver reads the warning before “Proceed anyway.”

- [ ] **Step 5: Commit documentation and evidence**

```bash
git add README.md docs/validation/2026-07-22-prometheus-readiness.md
git commit -m "docs: record unreadable recovery behavior"
```

- [ ] **Step 6: Final branch audit**

Run:

```bash
git status --short --branch
git log --oneline -5
```

Confirm only the user-owned untracked `.expo/` and root `tsconfig.json` remain, if they are still present. Do not stage or modify them.
