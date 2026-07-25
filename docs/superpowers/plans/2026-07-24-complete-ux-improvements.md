# Complete UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved capture, analysis, correction, follow-up, local-history, Trends, privacy, accessibility, and resilience improvements without changing Snap-a-Mistake's established visual identity or stateless server architecture.

**Architecture:** The app assigns a stable scan ID at photo review, copies the image into app-owned document storage, and stores validated scan records plus revisions in SQLite. The Fastify server adds stateless correction and alternate-follow-up operations using shared Zod contracts. Screens consume focused repository, session, API, and presentation modules so every phase can be tested and reviewed independently.

**Tech Stack:** Expo SDK 57, Expo Router, React Native 0.86, TypeScript, Zod, Expo FileSystem, Expo SQLite, Expo Haptics, React Native Gesture Handler/Reanimated, Fastify, OpenAI structured JSON, Vitest, Python unittest.

## Global Constraints

- Preserve the premium black-and-white interface; red and green remain semantic accents and blue remains rare.
- Keep all server operations stateless and never persist images, model responses, or student work on the server.
- Store full scan history and owned photographs locally until the student deletes them.
- Use readable Unicode math for student-facing generated text; never display raw LaTeX control sequences.
- Do not present timer-driven descriptions as real backend progress.
- Preserve a reviewed photograph across cancellation and every recoverable failure.
- Use minimum 44-point touch targets and support VoiceOver, maximum Dynamic Type, and reduced motion.
- Read the exact Expo SDK 57 documentation before implementation: [FileSystem](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/), [SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/), [Haptics](https://docs.expo.dev/versions/v57.0.0/sdk/haptics/), and [Expo Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/).
- Do not stage or modify the user-owned root `.expo/` directory or root `tsconfig.json`.
- Run the focused test for each red/green cycle, then the full workspace test and typecheck gates before each phase commit.

---

## Phase 1: Persistence foundation

### Task 1: Define shared follow-up and correction contracts

**Files:**
- Modify: `shared/src/index.ts`
- Modify: `shared/test/schemas.test.ts`
- Modify: `server/scripts/mock.ts`
- Modify: `server/test/run.test.ts`
- Modify: `server/test/stage2.test.ts`
- Modify: `app/src/lib/session.ts`
- Modify: `app/src/lib/session.test.ts`
- Modify: `app/src/ui/presentation.test.ts`

**Interfaces:**
- Produces: `FollowUpSchema`, `FollowUp`, `AnalysisResultSchema`, `CorrectionContextSchema`, `CorrectionContext`, `CorrectedDiagnosisSchema`, `AlternateFollowUpContextSchema`, and `AlternateFollowUpContext`.
- Consumed by: server correction/follow-up pipelines, server routes, app API client, persisted scan schemas.

- [ ] **Step 1: Write failing schema tests**

Add cases that require a Unicode-safe hint, reject raw `\frac`/caret notation in hints, validate a selected step contained in the submitted analysis, and cap previous problems at five:

```ts
it('validates correction and alternate follow-up contexts', () => {
  const analysis = AnalysisResultSchema.parse({
    kind: 'analysis',
    steps: [{ ...step(0), verdict: 'wrong' }],
    errorStepIndex: 0,
    misconceptionTag: 'sign-error',
    explanation: 'The sign changed.',
    followUp: { problem: 'Simplify −2x + x.', concept: 'signs', hint: 'Combine like terms.' },
    verifierAgreed: true,
  })
  expect(CorrectionContextSchema.parse({ analysis, selectedStepIndex: 0 }).selectedStepIndex).toBe(0)
  expect(() => CorrectionContextSchema.parse({ analysis, selectedStepIndex: 4 })).toThrow()
  expect(() => FollowUpSchema.parse({ problem: 'x²', concept: 'powers', hint: '\\frac{1}{2}' })).toThrow()
})
```

- [ ] **Step 2: Run the shared test and verify it fails**

Run: `npm test -w shared -- --run test/schemas.test.ts`  
Expected: FAIL because the new exported schemas do not exist.

- [ ] **Step 3: Extract and implement the shared schemas**

Use this public shape:

```ts
export const FollowUpSchema = z.object({
  problem: StudentFacingMathTextSchema,
  concept: z.string().min(1),
  hint: StudentFacingMathTextSchema,
})
export type FollowUp = z.infer<typeof FollowUpSchema>

export const AnalysisResultSchema = z.object({
  kind: z.literal('analysis'),
  steps: z.array(StepSchema),
  errorStepIndex: z.number().int().nullable(),
  misconceptionTag: z.enum(MISCONCEPTION_TAGS).nullable(),
  explanation: StudentFacingMathTextSchema.nullable(),
  followUp: FollowUpSchema.nullable(),
  verifierAgreed: z.boolean(),
}).superRefine(validateAnalysisConsistency)

export const CorrectionContextSchema = z.object({
  analysis: AnalysisResultSchema,
  selectedStepIndex: z.number().int().min(0),
}).superRefine((value, ctx) => {
  if (!value.analysis.steps.some((step) => step.index === value.selectedStepIndex))
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['selectedStepIndex'], message: 'selected step must exist' })
})

export const CorrectedDiagnosisSchema = z.object({
  misconceptionTag: z.enum(MISCONCEPTION_TAGS),
  explanation: StudentFacingMathTextSchema,
  followUp: FollowUpSchema,
})

export const AlternateFollowUpContextSchema = z.object({
  concept: z.string().min(1),
  diagnosis: StudentFacingMathTextSchema,
  previousProblems: z.array(StudentFacingMathTextSchema).min(1).max(5),
})
```

Refactor `Stage2Schema` and `AnalyzeResponseSchema` to reuse `FollowUpSchema` and `AnalysisResultSchema` without weakening existing consistency checks.

- [ ] **Step 4: Update every existing typed follow-up fixture**

Add a short Unicode-safe `hint` to every existing non-null follow-up in the server mocks/tests and app tests. Change the app session field to `followUp: FollowUp | null` so the hint is not discarded.

- [ ] **Step 5: Run full tests and typecheck**

Run: `npm test && npm run typecheck`  
Expected: all workspace tests PASS and every workspace typechecks after the shared-contract migration.

- [ ] **Step 6: Commit**

```bash
git add shared/src/index.ts shared/test/schemas.test.ts server/scripts/mock.ts server/test/run.test.ts server/test/stage2.test.ts app/src/lib/session.ts app/src/lib/session.test.ts app/src/ui/presentation.test.ts
git commit -m "feat: define correction and follow-up contracts"
```

### Task 2: Add the stateless diagnosis-correction pipeline

**Files:**
- Create: `server/src/pipeline/correction.ts`
- Create: `server/test/correction.test.ts`
- Modify: `server/src/pipeline/run.ts`
- Modify: `server/src/app.ts`
- Modify: `server/src/index.ts`
- Modify: `server/scripts/mock.ts`
- Modify: `server/test/app.test.ts`

**Interfaces:**
- Consumes: `CorrectionContext`, `CorrectedDiagnosisSchema`, existing `callModelJson`, verifier, model config, and JPEG image input.
- Produces: `RunCorrectionFn = (image, context) => Promise<AnalyzeResponse>` and `POST /correct-diagnosis`.

- [ ] **Step 1: Write failing correction-pipeline tests**

Cover forced step selection, verdict remapping, verifier disagreement, nonexistent selected steps, and Unicode-safe structured output:

```ts
it('keeps the student-selected step and remaps verdicts', async () => {
  const result = await runCorrection(image, { analysis, selectedStepIndex: 2 })
  expect(result.kind).toBe('analysis')
  if (result.kind !== 'analysis') throw new Error('expected analysis')
  expect(result.errorStepIndex).toBe(2)
  expect(result.steps.map((step) => step.verdict)).toEqual(['ok', 'ok', 'wrong', 'downstream'])
})
```

- [ ] **Step 2: Run the focused server test and verify it fails**

Run: `npm run test:vitest -w server -- test/correction.test.ts`  
Expected: FAIL because `makeRunCorrection` is missing.

- [ ] **Step 3: Implement the correction pipeline**

Export `withVerdicts` from `run.ts` and implement:

```ts
export type RunCorrectionFn = (
  image: { base64: string; mediaType: 'image/jpeg' },
  context: CorrectionContext,
) => Promise<AnalyzeResponse>

export function makeRunCorrection(client: OpenAI, config: Config): RunCorrectionFn
```

The model prompt must:

- Treat `selectedStepIndex` as fixed, not optional.
- Explain why that step is the first logical break.
- Return only `misconceptionTag`, `explanation`, and `followUp`.
- Require Unicode/prose output.

Run the existing verifier against the selected step and returned explanation, then use `withVerdicts(context.analysis.steps, selectedStepIndex, verifier.agrees)`.

- [ ] **Step 4: Write failing route tests**

Add multipart tests for a JPEG plus `context` JSON, missing/invalid context, a selected step absent from the analysis, and model failure:

```ts
const form = multipartForm({
  photo: { filename: 'work.jpg', contentType: 'image/jpeg', data: JPEG },
  context: JSON.stringify(validCorrectionContext),
})
const response = await app.inject({ method: 'POST', url: '/correct-diagnosis', ...form })
expect(response.statusCode).toBe(200)
```

- [ ] **Step 5: Implement and wire `POST /correct-diagnosis`**

Extend `buildApp` dependencies with `runCorrection`. Parse multipart parts with these limits:

```ts
type BuildAppDeps = {
  runAnalysis: RunAnalysisFn
  runCorrection: RunCorrectionFn
  logger?: boolean
}
```

The route must accept exactly one `photo` and one bounded `context` field, resize/rotate the photo through the existing JPEG helper, validate `CorrectionContextSchema`, and return 400 for invalid input, 502 for `ModelJsonError`, or the validated correction response.

Update every `buildApp` call in `app.test.ts` through a shared test dependency factory, and add a deterministic correction function to `scripts/mock.ts`.

- [ ] **Step 6: Run server tests and typecheck**

Run: `npm run test:vitest -w server -- test/correction.test.ts test/app.test.ts && npm run typecheck -w server`  
Expected: focused tests PASS and TypeScript exits 0.

- [ ] **Step 7: Commit**

```bash
git add server/src/pipeline/correction.ts server/src/pipeline/run.ts server/src/app.ts server/src/index.ts server/scripts/mock.ts server/test/correction.test.ts server/test/app.test.ts
git commit -m "feat: revise diagnoses from student corrections"
```

### Task 3: Add alternate follow-up generation

**Files:**
- Create: `server/src/pipeline/followup.ts`
- Create: `server/test/followup.test.ts`
- Modify: `server/src/app.ts`
- Modify: `server/src/index.ts`
- Modify: `server/test/app.test.ts`
- Modify: `server/src/pipeline/stage2.ts`
- Modify: `server/test/stage2.test.ts`
- Modify: `server/scripts/mock.ts`

**Interfaces:**
- Consumes: `AlternateFollowUpContext`, `FollowUpSchema`, configured analysis model.
- Produces: `GenerateFollowUpFn = (context) => Promise<FollowUp>` and `POST /follow-up`.

- [ ] **Step 1: Write failing generation tests**

Verify that the prompt asks for the same concept, prohibits previously returned problems, requires one hint, and rejects raw LaTeX:

```ts
it('requests a distinct problem and progressive hint', async () => {
  await generateFollowUp(client, model, {
    concept: 'integration by parts',
    diagnosis: 'The remaining integral kept an extra x.',
    previousProblems: ['Evaluate ∫ x eˣ dx.'],
  })
  expect(lastPrompt()).toMatch(/must differ/i)
  expect(lastPrompt()).toMatch(/one hint/i)
})
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `npm run test:vitest -w server -- test/followup.test.ts test/stage2.test.ts`  
Expected: FAIL because alternate generation and required hints are missing.

- [ ] **Step 3: Implement follow-up generation and update stage 2**

Implement:

```ts
export type GenerateFollowUpFn = (context: AlternateFollowUpContext) => Promise<FollowUp>
export function makeGenerateFollowUp(client: OpenAI, model: string): GenerateFollowUpFn
```

Update the stage-two JSON contract so every error diagnosis returns:

```json
{"followUp":{"problem":"Evaluate ∫ x eˣ dx.","concept":"integration by parts","hint":"Choose u so differentiating it simplifies the product."}}
```

- [ ] **Step 4: Add and implement the JSON route**

Add `POST /follow-up` with `AlternateFollowUpContextSchema.safeParse(req.body)`. Return 400 for invalid input, 502 for model JSON failure, and the validated `FollowUp` on success. Do not log the diagnosis or previous problems.

- [ ] **Step 5: Update mock fixtures and run server tests**

Run: `npm test -w server && npm run typecheck -w server`  
Expected: all server Vitest and importer tests PASS; typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add server/src/pipeline/followup.ts server/src/pipeline/stage2.ts server/src/app.ts server/src/index.ts server/scripts/mock.ts server/test/followup.test.ts server/test/stage2.test.ts server/test/app.test.ts
git commit -m "feat: generate hinted similar problems"
```

### Task 4: Define the local scan domain and SQLite migration

**Files:**
- Create: `app/src/lib/scanTypes.ts`
- Create: `app/src/lib/scanTypes.test.ts`
- Create: `app/src/lib/scanRepository.ts`
- Create: `app/src/lib/scanRepository.test.ts`
- Modify: `app/src/lib/history.ts`
- Modify: `app/app/_layout.tsx`

**Interfaces:**
- Produces: `ScanRecordSchema`, `ScanRecord`, `ScanRevision`, `PersistedSessionSchema`, `ScanRepository`.
- Consumed by: session, review, analysis, result, follow-up, Trends, Insights, scan detail.

- [ ] **Step 1: Write failing domain-schema tests**

Test original/follow-up parent rules, lifecycle and feedback enums, active revision consistency, invalid persisted JSON, and interrupted-session restoration:

```ts
expect(() => ScanRecordSchema.parse({
  ...scan,
  attemptKind: 'follow-up',
  parentScanId: null,
})).toThrow('follow-up requires parentScanId')
```

- [ ] **Step 2: Run the focused app test and verify it fails**

Run: `npm test -w app -- src/lib/scanTypes.test.ts`  
Expected: FAIL because `ScanRecordSchema` is missing.

- [ ] **Step 3: Implement the domain types**

Use these discriminants:

```ts
export const ScanOriginSchema = z.enum(['camera', 'library'])
export const AttemptKindSchema = z.enum(['original', 'follow-up'])
export const ScanLifecycleSchema = z.enum(['review', 'analyzing', 'complete', 'interrupted', 'unsaved'])
export const FeedbackStateSchema = z.enum(['unreviewed', 'accepted', 'corrected', 'rejected', 'excluded'])
export const FollowUpStatusSchema = z.enum(['none', 'ready', 'in-progress', 'resolved', 'unresolved'])
export const RevisionReasonSchema = z.enum(['initial', 'retry', 'student-correction'])
```

`ScanRecord` must contain the exact fields approved in the design, with `activeRevision` and `revisions` containing validated `AnalyzeResponse` values.

Export the neighboring repository inputs so later tasks use one vocabulary:

```ts
export type NewScanDraft = {
  id: string
  imageUri: string
  origin: ScanOrigin
  attemptKind: AttemptKind
  parentScanId: string | null
  createdAt: string
}

export type TrendSource =
  | { kind: 'scan'; scan: ScanRecord }
  | { kind: 'legacy'; tag: MisconceptionTag | null; correct: boolean; createdAt: string }
```

- [ ] **Step 4: Write failing repository and migration tests**

Use a narrow injected `DatabasePort` fake to assert:

- Migration 1 creates `scans`, `scan_revisions`, `app_state`, and `cleanup_queue`.
- Migration is idempotent.
- Legacy `analyses` rows remain readable.
- Saving a retry updates one scan.
- Saving a correction inserts a revision and switches the active revision atomically.
- Deleting a scan cascades revisions and enqueues its owned image URI.
- Clear-all covers scans, revisions, legacy rows, app state, and cleanup entries.

- [ ] **Step 5: Implement the repository**

Expose:

```ts
export interface ScanRepository {
  migrate(): Promise<void>
  createDraft(input: NewScanDraft): Promise<ScanRecord>
  saveRevision(scanId: string, revision: ScanRevision, durationMs: number): Promise<ScanRecord>
  setFeedback(scanId: string, feedback: FeedbackState): Promise<ScanRecord>
  setFollowUpStatus(scanId: string, status: FollowUpStatus): Promise<ScanRecord>
  get(scanId: string): Promise<ScanRecord | null>
  list(): Promise<ScanRecord[]>
  loadTrendSources(): Promise<TrendSource[]>
  delete(scanId: string): Promise<string | null>
  clearAll(): Promise<string[]>
  getState<T>(key: string, schema: z.ZodType<T>): Promise<T | null>
  setState<T>(key: string, value: T): Promise<void>
  deleteState(key: string): Promise<void>
}
```

Use `PRAGMA journal_mode = WAL`, `PRAGMA foreign_keys = ON`, `PRAGMA user_version`, and `withExclusiveTransactionAsync` for migration and coordinated writes. Store response JSON only after shared-schema validation.

- [ ] **Step 6: Keep a compatibility history facade**

Refactor `history.ts` so current callers can continue compiling during the phase, but route new writes through the repository. Remove the facade only after Analyze and Insights have migrated.

- [ ] **Step 7: Run focused tests and typecheck**

Run: `npm test -w app -- src/lib/scanTypes.test.ts src/lib/scanRepository.test.ts && npm run typecheck -w app`  
Expected: focused tests PASS and typecheck exits 0.

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/scanTypes.ts app/src/lib/scanTypes.test.ts app/src/lib/scanRepository.ts app/src/lib/scanRepository.test.ts app/src/lib/history.ts app/app/_layout.tsx
git commit -m "feat: persist full local scan records"
```

### Task 5: Add durable image ownership and session recovery

**Files:**
- Create: `app/src/lib/scanFiles.ts`
- Create: `app/src/lib/scanFiles.test.ts`
- Modify: `app/src/lib/session.ts`
- Modify: `app/src/lib/session.test.ts`
- Modify: `app/app/_layout.tsx`

**Interfaces:**
- Consumes: Expo SDK 57 `File`, `Directory`, `Paths`; `ScanRepository`; `PersistedSessionSchema`.
- Produces: `ownScanPhoto`, `deleteOwnedPhoto`, `flushCleanupQueue`, `hydrateSession`, and async session mutations.

- [ ] **Step 1: Write failing file-lifecycle tests**

Inject a `FilePort` and test directory creation, file copy, missing source, exact-file deletion, idempotent cleanup, and refusal to delete URIs outside the owned scan directory:

```ts
await expect(deleteOwnedPhoto('file:///tmp/not-owned.jpg', files)).rejects.toThrow('outside scan directory')
```

- [ ] **Step 2: Implement durable photo helpers**

Use the SDK 57 object API:

```ts
const scanDirectory = new Directory(Paths.document, 'scans')
scanDirectory.create({ idempotent: true, intermediates: true })

export async function ownScanPhoto(scanId: string, sourceUri: string): Promise<string> {
  const source = new File(sourceUri)
  const destination = new File(scanDirectory, `${scanId}.jpg`)
  await source.copy(destination, { overwrite: true })
  return destination.uri
}
```

Validate ownership by comparing normalized parent directory URIs before deletion.

- [ ] **Step 3: Write failing session-recovery tests**

Test review/result/follow-up persistence, invalid persisted state fallback, and conversion of `analyzing` to `interrupted` during hydration.

- [ ] **Step 4: Implement persisted session hydration**

Keep `getSession()` synchronous after bootstrap, but make mutations await persistence:

```ts
export async function hydrateSession(repository: ScanRepository): Promise<Session>
export async function setPendingPhoto(input: { uri: string; origin: ScanOrigin }): Promise<void>
export async function setReviewedPhoto(input: ReviewedPhoto): Promise<void>
export async function persistAnalysis(scanId: string, response: AnalyzeResponse, durationMs: number): Promise<void>
export async function startFollowUp(parentScanId: string, followUp: FollowUp): Promise<void>
export async function resetSession(options?: { preserveDraft?: boolean }): Promise<void>
```

Store the active session under `app_state.key = 'active-session'`. Do not preserve an old follow-up when a new analysis has no follow-up.

Retain the existing `setPhoto(uri)` and `setAnalysis(response)` wrappers temporarily so current routes still typecheck in Phase 1. Mark them for removal: Task 6 migrates `setPhoto`, Task 7 migrates `setAnalysis`, and Task 10 removes the final legacy session wrapper after `startFollowUp` call sites move to the persisted signature.

- [ ] **Step 5: Gate routing on bootstrap**

Update `_layout.tsx` to await database migration, cleanup retry, and session hydration before rendering the Stack. Show a black launch surface while bootstrapping and a recoverable local-data error if migration fails.

- [ ] **Step 6: Run phase tests and full gates**

Run:

```bash
npm test -w app -- src/lib/scanFiles.test.ts src/lib/session.test.ts
npm run typecheck -w app
npm test
npm run typecheck
```

Expected: focused and full tests PASS; all workspaces typecheck.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/scanFiles.ts app/src/lib/scanFiles.test.ts app/src/lib/session.ts app/src/lib/session.test.ts app/app/_layout.tsx
git commit -m "feat: retain photos and restore active sessions"
```

---

## Phase 2: Capture and analysis

### Task 6: Add photo review and privacy disclosure

**Files:**
- Create: `app/app/review.tsx`
- Create: `app/src/ui/reviewScreen.ts`
- Create: `app/src/ui/reviewScreen.test.ts`
- Create: `app/src/components/ZoomablePhoto.tsx`
- Modify: `app/app/index.tsx`
- Modify: `app/src/lib/cameraCapture.ts`
- Modify: `app/src/lib/session.ts`

**Interfaces:**
- Consumes: temporary photo URI and origin, durable photo helper, session repository.
- Produces: reviewed durable scan draft and navigation to `/analyze`.

- [ ] **Step 1: Write failing review-presentation tests**

Test camera/library labels, first-use privacy visibility, copy-failure state, and disabled Analyze state while copying.

- [ ] **Step 2: Implement review presentation and route**

`review.tsx` must render the complete photo with `ZoomablePhoto`, privacy copy when `privacy-disclosure-v1` is absent, and these actions:

```ts
type ReviewActions = {
  primary: 'Analyze'
  retake: 'Retake' | null
  replace: 'Choose another'
}
```

On Analyze: allocate a scan ID, copy to app documents, create a `review` draft, persist the session, mark the disclosure acknowledged, and navigate to `/analyze`. Copy failure stays on review.

- [ ] **Step 3: Redirect capture and gallery selection to review**

Replace direct `router.push('/analyze')` in `index.tsx` with:

```ts
await setPendingPhoto({ uri, origin: 'camera' | 'library' })
router.push('/review')
```

Catch picker failure separately from user cancellation.

- [ ] **Step 4: Implement pinch-to-zoom**

Use the already-installed Gesture Handler and Reanimated packages. Clamp scale to `1...4`, reset translation when scale returns to 1, expose a non-gesture fallback to VoiceOver, and keep the image contained by default.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -w app -- src/ui/reviewScreen.test.ts src/lib/cameraCapture.test.ts src/lib/session.test.ts && npm run typecheck -w app`  
Expected: tests PASS and typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add app/app/review.tsx app/app/index.tsx app/src/components/ZoomablePhoto.tsx app/src/lib/cameraCapture.ts app/src/lib/session.ts app/src/ui/reviewScreen.ts app/src/ui/reviewScreen.test.ts
git commit -m "feat: review photos before analysis"
```

### Task 7: Make analysis honest, cancellable, and specific

**Files:**
- Modify: `app/src/lib/api.ts`
- Modify: `app/src/lib/api.test.ts`
- Modify: `app/src/components/AnalysisProgress.tsx`
- Modify: `app/app/analyze.tsx`
- Modify: `app/src/ui/presentation.ts`
- Modify: `app/src/ui/presentation.test.ts`

**Interfaces:**
- Produces: typed `ApiFailure` variants, `analyzePhoto(uri, { signal })`, elapsed-state presentation, and cancel-to-review behavior.

- [ ] **Step 1: Write failing API classification tests**

Cover `network`, `timeout`, `cancelled`, `server`, and `invalid-response`:

```ts
await expect(analyzePhoto(uri, { fetchFn: abortingFetch, signal })).rejects.toMatchObject({
  failure: { kind: 'cancelled' },
})
```

- [ ] **Step 2: Implement abort and failure classification**

Use:

```ts
export type ApiFailure =
  | { kind: 'network' }
  | { kind: 'timeout' }
  | { kind: 'cancelled' }
  | { kind: 'server'; status: number }
  | { kind: 'invalid-response'; status: number }

export async function analyzePhoto(
  uri: string,
  options: { signal?: AbortSignal; fetchFn?: typeof fetch } = {},
): Promise<AnalyzeResponse>
```

Combine the caller signal with the 180-second timeout controller. Never translate caller cancellation into a network failure.

- [ ] **Step 3: Write failing progress and recovery-presentation tests**

Assert initial, 20-second, and 60-second copy; VoiceOver announcement boundaries; and the correct action set for every failure and non-analysis result.

- [ ] **Step 4: Replace fake completion stages**

`AnalysisProgress` receives `elapsedSeconds`, `descriptionIndex`, and `onCancel`. Rotate descriptions without completion checkmarks. Show the long-wait copy once at 20 seconds and retain a 44-point Cancel button.

- [ ] **Step 5: Integrate repository lifecycle and recovery**

Set the scan to `analyzing` before the request, write `complete` plus duration on success, and write `interrupted` on cancellation. On a save failure, show the valid result with an unsaved banner and **Retry saving**.

- [ ] **Step 6: Run app tests and phase gates**

Run:

```bash
npm test -w app -- src/lib/api.test.ts src/ui/presentation.test.ts src/ui/analyzeScreen.test.ts
npm run typecheck -w app
npm test
npm run typecheck
```

Expected: focused and full gates PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/api.ts app/src/lib/api.test.ts app/src/components/AnalysisProgress.tsx app/app/analyze.tsx app/src/ui/presentation.ts app/src/ui/presentation.test.ts
git commit -m "feat: make analysis cancellable and transparent"
```

---

## Phase 3: Result trust

### Task 8: Focus the result and link steps to the photograph

**Files:**
- Create: `app/src/lib/resultFocus.ts`
- Create: `app/src/lib/resultFocus.test.ts`
- Create: `app/src/components/StepTimeline.tsx`
- Modify: `app/src/components/StepCard.tsx`
- Modify: `app/src/components/PhotoOverlay.tsx`
- Modify: `app/app/analyze.tsx`

**Interfaces:**
- Produces: `focusedStepIndexes(steps, errorStepIndex)`, controlled expansion state, `selectedStepIndex`, and bidirectional photo/timeline selection.

- [ ] **Step 1: Write failing focus tests**

Test first/middle/last error positions, correct work, suspect work, sparse indexes, and absence of downstream steps:

```ts
expect(focusedStepIndexes(steps, 2)).toEqual([1, 2, 3])
expect(focusedStepIndexes(steps, null)).toEqual(steps.map((step) => step.index))
```

- [ ] **Step 2: Implement pure focus logic**

Return at most the preceding, diagnosed, and immediate following indexed steps for an error result. Correct work remains fully visible because it has no first break to focus.

- [ ] **Step 3: Make timeline expansion controlled**

`StepTimeline` owns:

```ts
type StepTimelineProps = {
  steps: Step[]
  errorStepIndex: number | null
  selectedStepIndex: number | null
  showAll: boolean
  onSelectStep(index: number): void
  onShowAll(): void
}
```

Each `StepCard` becomes pressable, keeps a 44-point target, exposes expanded/collapsed accessibility state, and can collapse correct/downstream detail individually.

- [ ] **Step 4: Link overlay selection**

`PhotoOverlay` receives `selectedStepIndex` and `onSelectStep`. Only located wrong/suspect/selected steps render bands. Tapping a band selects the timeline step; selecting a timeline step updates the photo highlight and scrolls to the photo using `ScrollView` refs.

- [ ] **Step 5: Reuse `ZoomablePhoto` in results**

Render the overlay inside the zoom container while keeping the label and border scale visually consistent. Missing location data leaves the step selectable in the timeline without creating a fake band.

- [ ] **Step 6: Run focused tests and typecheck**

Run: `npm test -w app -- src/lib/resultFocus.test.ts src/lib/overlay.test.ts src/ui/analyzeScreen.test.ts && npm run typecheck -w app`  
Expected: tests PASS and typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/resultFocus.ts app/src/lib/resultFocus.test.ts app/src/components/StepTimeline.tsx app/src/components/StepCard.tsx app/src/components/PhotoOverlay.tsx app/app/analyze.tsx
git commit -m "feat: focus results on the first break"
```

### Task 9: Add diagnosis feedback and revised analysis

**Files:**
- Create: `app/src/components/DiagnosisFeedback.tsx`
- Create: `app/src/ui/diagnosisFeedback.ts`
- Create: `app/src/ui/diagnosisFeedback.test.ts`
- Modify: `app/src/lib/api.ts`
- Modify: `app/src/lib/api.test.ts`
- Modify: `app/src/lib/scanRepository.ts`
- Modify: `app/app/analyze.tsx`

**Interfaces:**
- Consumes: correction contracts and `POST /correct-diagnosis`.
- Produces: accepted, corrected, all-correct, and excluded revision flows.

- [ ] **Step 1: Write failing feedback-state tests**

Cover Yes, choose-step, all-correct, not-captured, correction failure, correction cancellation, and retry. Assert rejected revisions cannot become active.

- [ ] **Step 2: Add the correction API client**

Implement:

```ts
export async function correctDiagnosis(
  uri: string,
  context: CorrectionContext,
  options: { signal?: AbortSignal; fetchFn?: typeof fetch } = {},
): Promise<AnalyzeResponse>
```

Use multipart `photo` plus JSON `context`, the same typed failures as analysis, and `AnalyzeResponseSchema`.

- [ ] **Step 3: Build the feedback component**

Show **Yes** and **Not quite** only for active error diagnoses. The correction sheet lists every extracted step using readable text plus:

- All steps are correct
- The relevant step wasn't captured
- Cancel

The sheet must announce its title and preserve focus when dismissed.

- [ ] **Step 4: Integrate correction persistence**

On Yes, set feedback to `accepted`. On selected step, call the correction endpoint, add a `student-correction` revision, mark the prior revision rejected, and switch active result atomically. On all-correct, synthesize a valid correct `AnalyzeResponse` from existing steps with every verdict `ok`. On not-captured, set `excluded` and return to review.

- [ ] **Step 5: Run app tests and phase gates**

Run:

```bash
npm test -w app -- src/ui/diagnosisFeedback.test.ts src/lib/api.test.ts src/lib/scanRepository.test.ts
npm run typecheck -w app
npm test
npm run typecheck
```

Expected: focused and full gates PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/DiagnosisFeedback.tsx app/src/ui/diagnosisFeedback.ts app/src/ui/diagnosisFeedback.test.ts app/src/lib/api.ts app/src/lib/api.test.ts app/src/lib/scanRepository.ts app/app/analyze.tsx
git commit -m "feat: let students correct the first break"
```

---

## Phase 4: Follow-up loop

### Task 10: Preserve and extend follow-up practice

**Files:**
- Create: `app/src/components/CurrentProblemCard.tsx`
- Create: `app/src/lib/followUp.ts`
- Create: `app/src/lib/followUp.test.ts`
- Modify: `app/app/followup.tsx`
- Modify: `app/app/index.tsx`
- Modify: `app/src/lib/api.ts`
- Modify: `app/src/lib/api.test.ts`
- Modify: `app/src/lib/session.ts`
- Modify: `app/src/lib/scanRepository.ts`

**Interfaces:**
- Produces: hint reveal, alternate similar problem, parent-linked follow-up scans, and resolution status.

- [ ] **Step 1: Write failing follow-up state tests**

Test hidden/revealed hint, distinct-problem replacement, previous-problem cap, parent linkage, correct resolution, unresolved diagnosis, and visible back navigation.

- [ ] **Step 2: Add alternate follow-up API support**

Implement:

```ts
export async function requestAlternateFollowUp(
  context: AlternateFollowUpContext,
  options: { signal?: AbortSignal; fetchFn?: typeof fetch } = {},
): Promise<FollowUp>
```

Validate with `FollowUpSchema`; keep the prior problem if the request fails.

- [ ] **Step 3: Upgrade the follow-up route**

Render concept, problem, **Show a hint**, **Try another similar problem**, **Check my work**, and a visible back action. Disable only the action with an in-flight request. Append replaced problems to the bounded previous-problem list.

- [ ] **Step 4: Add the camera problem card**

In follow-up mode, show a collapsed 44-point **Current problem** control above the shutter. Expanding it reveals the problem and optional hint without covering the gallery or shutter actions. VoiceOver reads the problem once, not on every camera rerender.

- [ ] **Step 5: Link follow-up scans and resolve status**

When **Check my work** is tapped, persist `parentScanId` and `attemptKind: 'follow-up'` in the active session. After analysis:

```ts
const resolved = result.kind === 'analysis'
  && (result.errorStepIndex === null || result.misconceptionTag !== parent.misconceptionTag)
```

Set the parent follow-up status to `resolved` or `unresolved`, while retaining the child scan as its own attempt.

Remove the temporary legacy `setPhoto`/`setAnalysis`/single-argument `startFollowUp` wrappers from `session.ts` after confirming `rg -n "setPhoto\\(|setAnalysis\\(|startFollowUp\\(" app` finds only the new persisted call signatures.

- [ ] **Step 6: Run focused tests and phase gates**

Run:

```bash
npm test -w app -- src/lib/followUp.test.ts src/lib/api.test.ts src/lib/session.test.ts src/lib/scanRepository.test.ts
npm run typecheck -w app
npm test
npm run typecheck
```

Expected: all gates PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/components/CurrentProblemCard.tsx app/src/lib/followUp.ts app/src/lib/followUp.test.ts app/app/followup.tsx app/app/index.tsx app/src/lib/api.ts app/src/lib/api.test.ts app/src/lib/session.ts app/src/lib/scanRepository.ts
git commit -m "feat: complete the follow-up learning loop"
```

---

## Phase 5: Insights and previous scans

### Task 11: Replace raw counts with trustworthy learning patterns

**Files:**
- Modify: `app/src/lib/trends.ts`
- Modify: `app/src/lib/trends.test.ts`
- Modify: `app/src/lib/scanRepository.ts`
- Modify: `app/src/lib/history.ts`

**Interfaces:**
- Consumes: distinct active scan results plus legacy aggregate rows.
- Produces: `PatternSummary` with evidence, direction, attempts, resolved follow-ups, and positive status.

- [ ] **Step 1: Write failing Trends tests**

Add cases for:

- Retry revisions count once.
- Rejected/excluded revisions count zero.
- Corrected active revision replaces its prior tag.
- One total attempt produces `not-enough-data`.
- Two relevant attempts permit directional comparison.
- Resolved follow-ups increment positive progress.
- Legacy rows still contribute.

```ts
expect(summarize([oneCurrentAttempt], now)[0].trend).toBe('not-enough-data')
expect(summarize([retryRevision, activeRevision], now)[0].thisWeek).toBe(1)
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -w app -- src/lib/trends.test.ts`  
Expected: FAIL because the current implementation counts flat history rows and has no evidence threshold.

- [ ] **Step 3: Implement the new summary**

Use:

```ts
export const MIN_DIRECTIONAL_EVIDENCE = 2
export type PatternSummary = {
  tag: MisconceptionTag
  thisWeek: number
  lastWeek: number
  trend: 'more' | 'fewer' | 'same' | 'not-enough-data'
  resolvedFollowUps: number
}
```

Count one active non-rejected revision per scan ID. Include legacy rows as already-distinct attempts. Sort current-week count descending, then resolved follow-ups descending, then label.

- [ ] **Step 4: Remove obsolete direct history writes**

After Analyze and Insights use `ScanRepository`, remove `recordAnalysis` from normal flow. Keep only legacy read/migration support inside the repository.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -w app -- src/lib/trends.test.ts src/lib/scanRepository.test.ts && npm run typecheck -w app`  
Expected: tests PASS and typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/trends.ts app/src/lib/trends.test.ts app/src/lib/scanRepository.ts app/src/lib/history.ts
git commit -m "feat: make learning patterns evidence based"
```

### Task 12: Build Patterns and Previous scans in one destination

**Files:**
- Create: `app/src/components/InsightsSwitcher.tsx`
- Create: `app/src/components/ScanHistoryRow.tsx`
- Create: `app/src/ui/insightsPresentation.ts`
- Create: `app/src/ui/insightsPresentation.test.ts`
- Modify: `app/app/insights.tsx`
- Modify: `app/app/index.tsx`

**Interfaces:**
- Produces: accessible two-section Insights view and routes to `/scan/[id]`.

- [ ] **Step 1: Write failing presentation tests**

Test loading, empty, database error, patterns, previous-scan states, status labels, and destructive-action copy. Ensure DB error never maps to empty.

- [ ] **Step 2: Build the accessible section switch**

`InsightsSwitcher` exposes two buttons with selected state:

```ts
type InsightsSection = 'patterns' | 'scans'
```

The current section is local screen state. Patterns renders `PatternSummary`; scans renders reverse-chronological `ScanHistoryRow` items with thumbnail, date/time, status, tag, and follow-up status. Use `FlatList` for Previous scans and render the switcher as its `ListHeaderComponent`; do not place a virtualized history list inside `AppScreen`'s `ScrollView`.

- [ ] **Step 3: Add robust loading and error states**

Load repository scans and Trend sources together. Map failures to a retryable **Couldn't load local history** state. Empty Patterns and empty Previous scans use distinct copy.

- [ ] **Step 4: Remove the duplicate camera entry**

Keep a single Insights control in the top camera bar. Replace the bottom-right duplicate with an empty balanced spacer so shutter alignment remains centered.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -w app -- src/ui/insightsPresentation.test.ts src/lib/trends.test.ts && npm run typecheck -w app`  
Expected: tests PASS and typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/InsightsSwitcher.tsx app/src/components/ScanHistoryRow.tsx app/src/ui/insightsPresentation.ts app/src/ui/insightsPresentation.test.ts app/app/insights.tsx app/app/index.tsx
git commit -m "feat: add patterns and previous scans"
```

### Task 13: Restore, delete, and clear local scans

**Files:**
- Create: `app/app/scan/[id].tsx`
- Create: `app/src/ui/scanDetail.ts`
- Create: `app/src/ui/scanDetail.test.ts`
- Create: `app/src/components/ConfirmAction.tsx`
- Modify: `app/app/insights.tsx`
- Modify: `app/src/lib/scanRepository.ts`
- Modify: `app/src/lib/scanFiles.ts`

**Interfaces:**
- Produces: read-only historical result restoration, per-scan delete, clear-all, privacy disclosure, and cleanup retry.

- [ ] **Step 1: Write failing scan-detail tests**

Test complete, corrected, interrupted, excluded, missing-photo, and invalid-ID states. Test exact delete and clear-all confirmation copy.

- [ ] **Step 2: Build historical scan detail**

Load by route ID, render the active revision through the same result components in read-only mode, expose revision status, show a missing-photo placeholder when necessary, and never offer diagnosis feedback on a historical view without first restoring it as active.

- [ ] **Step 3: Implement per-scan deletion**

Confirm:

> Delete this scan? Its photo, analysis, corrections, and follow-up will be removed from this phone. This cannot be undone.

Delete the database record transactionally, then delete the returned owned URI. If file deletion fails, enqueue cleanup and still remove the scan from the UI.

- [ ] **Step 4: Implement clear-all and privacy**

Confirm:

> Clear all history? Every saved photo, analysis, follow-up, correction, and learning pattern will be removed from this phone. This cannot be undone.

Clear repository data, delete each returned owned image, reset active session, retry queued cleanup, and return to the camera. Add the approved Data and privacy copy below the Insights content.

- [ ] **Step 5: Run phase gates**

Run:

```bash
npm test -w app -- src/ui/scanDetail.test.ts src/lib/scanRepository.test.ts src/lib/scanFiles.test.ts
npm run typecheck -w app
npm test
npm run typecheck
```

Expected: all gates PASS.

- [ ] **Step 6: Commit**

```bash
git add app/app/scan/[id].tsx app/src/ui/scanDetail.ts app/src/ui/scanDetail.test.ts app/src/components/ConfirmAction.tsx app/app/insights.tsx app/src/lib/scanRepository.ts app/src/lib/scanFiles.ts
git commit -m "feat: restore and manage saved scans"
```

---

## Phase 6: Accessibility and final polish

### Task 14: Add haptics, responsive framing, and accessibility announcements

**Files:**
- Modify: `app/package.json`
- Modify: `package-lock.json`
- Create: `app/src/lib/feedback.ts`
- Create: `app/src/lib/feedback.test.ts`
- Modify: `app/src/components/CameraCorners.tsx`
- Modify: `app/src/components/AppButton.tsx`
- Modify: `app/src/components/AppScreen.tsx`
- Modify: `app/src/components/AnalysisProgress.tsx`
- Modify: `app/src/components/StepCard.tsx`
- Modify: `app/app/index.tsx`
- Modify: `app/app/analyze.tsx`
- Modify: `app/app/followup.tsx`
- Modify: `app/app/insights.tsx`

**Interfaces:**
- Produces: centralized capture/completion haptics, accessible announcements, scalable text, and responsive guides.

- [ ] **Step 1: Install the SDK-compatible haptics package**

Run: `npx expo install expo-haptics` with working directory `app/`.  
Expected: `app/package.json` contains the SDK 57-compatible `expo-haptics` version and the lockfile updates.

- [ ] **Step 2: Write failing feedback tests**

Inject a haptics port and verify one light capture impact, one success notification per completed analysis, and no haptic when reduced-motion/feedback suppression is enabled.

- [ ] **Step 3: Implement centralized feedback**

Expose:

```ts
export function captureFeedback(port: HapticsPort): Promise<void>
export function analysisCompleteFeedback(port: HapticsPort): Promise<void>
export function announce(message: string): void
```

Use `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`, `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`, and `AccessibilityInfo.announceForAccessibility`.

- [ ] **Step 4: Make framing guides responsive**

Replace hard-coded top/bottom offsets with a frame computed from `useWindowDimensions`, safe-area insets, top controls, and bottom controls. Preserve a minimum 24-point margin and keep the frame in portrait safe bounds.

- [ ] **Step 5: Audit Dynamic Type and VoiceOver**

Remove fixed line heights that clip at maximum text size, set `maxFontSizeMultiplier` only where a control cannot safely expand, add accessibility hints to icon-only controls, mark selected/collapsed state, and announce:

- analysis started
- longer wait
- analysis completed
- analysis cancelled
- classified failures
- correction completed

- [ ] **Step 6: Run focused tests and app gates**

Run:

```bash
npm test -w app -- src/lib/feedback.test.ts src/ui/presentation.test.ts src/ui/analyzeScreen.test.ts
npm run typecheck -w app
npm run lint -w app
```

Expected: tests and typecheck PASS; lint reports no errors.

- [ ] **Step 7: Commit**

```bash
git add app/package.json package-lock.json app/src/lib/feedback.ts app/src/lib/feedback.test.ts app/src/components/CameraCorners.tsx app/src/components/AppButton.tsx app/src/components/AppScreen.tsx app/src/components/AnalysisProgress.tsx app/src/components/StepCard.tsx app/app/index.tsx app/app/analyze.tsx app/app/followup.tsx app/app/insights.tsx
git commit -m "feat: polish accessibility and tactile feedback"
```

### Task 15: Update mocks, documentation, and final verification

**Files:**
- Modify: `server/scripts/mock.ts`
- Modify: `README.md`
- Modify: `app/README.md`
- Modify: `docs/submission/DEMO-SCRIPT.md`
- Modify: `docs/submission/DEVPOST.md`
- Modify: `docs/validation/2026-07-22-prometheus-readiness.md`

**Interfaces:**
- Produces: deterministic fixtures for every new screen, accurate public documentation, and recorded verification evidence.

- [ ] **Step 1: Expand mock modes**

Add deterministic modes for:

- correct
- error
- suspect
- unreadable
- not-math
- timeout
- server-error
- correction
- alternate-follow-up

Every error/suspect fixture includes `followUp.hint` and Unicode-safe text.

- [ ] **Step 2: Add a manual on-device checklist**

Document the exact checks from the approved design:

```markdown
- [ ] Camera and gallery both reach review.
- [ ] Cancel returns to review with the photo intact.
- [ ] Offline, timeout, server, unreadable, and not-math states offer the correct actions.
- [ ] Correction replaces the active diagnosis and does not add a Pattern attempt.
- [ ] Follow-up remains visible on camera and links to its parent.
- [ ] App restart restores review, result, and follow-up states.
- [ ] Previous scan opens, deletes individually, and clear-all removes every owned image.
- [ ] VoiceOver and maximum Dynamic Type complete the core journey.
```

- [ ] **Step 3: Correct public documentation**

Update README architecture, behavior, test totals, math-presentation description, privacy statement, and run commands. Use **similar problem**, not **simpler problem**, unless a specific model contract guarantees reduced difficulty.

- [ ] **Step 4: Run all automated gates**

Run:

```bash
npm test
npm run typecheck
npm run lint -w app
npm run golden -w server
```

Expected:

- All workspace tests PASS.
- Every workspace typechecks.
- App lint has no errors.
- Golden run completes and writes no unreviewed source changes.

- [ ] **Step 5: Run physical-phone verification**

Use the live server for real-model checks and the mock server for deterministic failure states. Complete the documented checklist on the physical iPhone, including app termination/relaunch and local deletion.

- [ ] **Step 6: Rehearse the two-minute demo**

Record one uninterrupted rehearsal showing:

1. Capture and review.
2. Real analysis.
3. First-break explanation.
4. Student correction or diagnosis acceptance.
5. Similar follow-up.
6. Patterns and a previous scan.

Confirm no secrets, terminal windows, personal notifications, or unrelated photos appear.

- [ ] **Step 7: Commit**

```bash
git add server/scripts/mock.ts README.md app/README.md docs/submission/DEMO-SCRIPT.md docs/submission/DEVPOST.md docs/validation/2026-07-22-prometheus-readiness.md
git commit -m "docs: finalize improved demo experience"
```

## Final integration gate

- [ ] Confirm `git status --short` contains only known user-owned untracked files.
- [ ] Review every phase commit in order with `git log --oneline`.
- [ ] Run `npm test`, `npm run typecheck`, `npm run lint -w app`, and the golden regression once more.
- [ ] Complete the physical-phone checklist once more from a clean app launch.
- [ ] Merge the isolated worktree branch into `main` only after all gates pass.
- [ ] Push `main` only after verifying the remote diff contains no secrets, local databases, saved scan photos, `.expo/`, or root `tsconfig.json`.
