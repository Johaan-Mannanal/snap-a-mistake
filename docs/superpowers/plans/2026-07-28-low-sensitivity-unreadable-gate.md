# Low-Sensitivity Unreadable Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the unreadable-photo result appear only when a nonempty math transcript has overwhelming evidence of catastrophic image quality, while preserving zero-step, non-math, and request-scoped recovery safeguards.

**Architecture:** Keep the two vision passes and all response schemas unchanged. Replace the current “either verifier concern” rejection with one explicit combined predicate: stage-one legibility at or below `0.15`, plus both independent verifier booleans false. Protect the boundary and fallback behavior with direct pipeline tests, then reconcile only the public sentences and evidence totals affected by the change.

**Tech Stack:** TypeScript, Fastify pipeline, Vitest, npm workspaces, GitHub-flavored Markdown.

## Global Constraints

- `isMath: false` still returns `not-math`.
- A transcript with zero steps still returns `unreadable`, including when `allowUncertainTranscript` is true.
- A nonempty transcript returns `unreadable` only when stage-one legibility is `<= 0.15`, `faithful` is false, and `legible` is false.
- Any nonempty transcript outside that combined condition continues into diagnosis automatically.
- `allowUncertainTranscript: true` still bypasses the rare combined rejection for that request only.
- Do not alter the verifier prompt, schemas, model configuration, app UI, demo script, or unrelated thresholds.
- Limit documentation edits to the exact retake-gate behavior and fresh automated totals.
- Preserve the paid-golden disclosure, prior focused live evidence, MIT license, and FERMAT attribution/provenance.
- Do not stage, commit, delete, or rewrite the user-owned root `.expo/` directory or root `tsconfig.json`.
- Do not push until the merged result is fully verified; the user has explicitly authorized the final push.

---

## File structure

- `server/src/pipeline/run.ts` — owns the combined unreadable decision.
- `server/test/run.test.ts` — directly exercises the pipeline boundary and safeguards.
- `README.md` — public architecture wording and final automated totals.
- `docs/submission/DEVPOST.md` — ready-to-paste technical workflow and totals.
- `docs/submission/PROMETHEUS-ABOUT.md` — first-person workflow story and totals.
- `docs/validation/2026-07-22-prometheus-readiness.md` — reproducible final evidence and pending human gates.

---

### Task 1: Make the unreadable decision overwhelmingly conservative

**Files:**
- Modify: `server/test/run.test.ts:71-141`
- Modify: `server/src/pipeline/run.ts:76-85`

**Interfaces:**
- Consumes: `Stage1Result.legibility`, `TranscriptionVerification.faithful`, `TranscriptionVerification.legible`, and `AnalysisOptions.allowUncertainTranscript`.
- Produces: an internal `CATASTROPHIC_LEGIBILITY_THRESHOLD` constant and the pipeline’s existing `AnalyzeResponse`; no public type changes.

- [ ] **Step 1: Change the moderate-confidence test to the desired behavior**

Replace the existing `keeps a low-confidence transcript unreadable when the verifier rejects it` test with:

```ts
it('continues a nonempty moderate-confidence transcript when the verifier rejects it', async () => {
  let diagnosisCalls = 0
  const analyze = makeRunAnalysis(client, config, {
    transcribe: async () => s1({ legibility: 0.3 }),
    verifyTranscription: async () => ({ faithful: false, legible: false, note: 'blurred' }),
    analyzeSteps: async () => {
      diagnosisCalls += 1
      return errorDiag
    },
    verifyDiagnosis: async () => ({ agrees: true, note: '' }),
  })

  await expect(analyze(image)).resolves.toMatchObject({
    kind: 'analysis',
    errorStepIndex: 1,
  })
  expect(diagnosisCalls).toBe(1)
})
```

- [ ] **Step 2: Add the catastrophic boundary tests**

Immediately after that test, add:

```ts
it('returns unreadable only when low stage-one confidence and both verifier rejections agree', async () => {
  let diagnosisCalls = 0
  const analyze = makeRunAnalysis(client, config, {
    transcribe: async () => s1({ legibility: 0.15 }),
    verifyTranscription: async () => ({ faithful: false, legible: false, note: 'unusable' }),
    analyzeSteps: async () => {
      diagnosisCalls += 1
      return errorDiag
    },
    verifyDiagnosis: async () => ({ agrees: true, note: '' }),
  })

  await expect(analyze(image)).resolves.toEqual({
    kind: 'unreadable',
    tips: expect.any(Array),
  })
  expect(diagnosisCalls).toBe(0)
})

it('continues just above the catastrophic legibility boundary', async () => {
  const analyze = makeRunAnalysis(client, config, {
    transcribe: async () => s1({ legibility: 0.151 }),
    verifyTranscription: async () => ({ faithful: false, legible: false, note: 'uncertain' }),
    analyzeSteps: async () => errorDiag,
    verifyDiagnosis: async () => ({ agrees: true, note: '' }),
  })

  await expect(analyze(image)).resolves.toMatchObject({
    kind: 'analysis',
    errorStepIndex: 1,
  })
})

it.each([
  { faithful: true, legible: false },
  { faithful: false, legible: true },
])('continues catastrophic-confidence work when one verifier signal passes: %o', async (check) => {
  const analyze = makeRunAnalysis(client, config, {
    transcribe: async () => s1({ legibility: 0.1 }),
    verifyTranscription: async () => ({ ...check, note: 'partially supported' }),
    analyzeSteps: async () => errorDiag,
    verifyDiagnosis: async () => ({ agrees: true, note: '' }),
  })

  await expect(analyze(image)).resolves.toMatchObject({
    kind: 'analysis',
    errorStepIndex: 1,
  })
})
```

This adds three Vitest cases; the parameterized case contains two inputs but counts as two tests.

- [ ] **Step 3: Make the explicit override exercise the new rare rejection**

In `continues past uncertain transcription only for an explicit override`, change:

```ts
transcribe: async () => s1({ legibility: 0.3 }),
```

to:

```ts
transcribe: async () => s1({ legibility: 0.1 }),
```

This ensures the override test would hit the combined rejection without `allowUncertainTranscript`.

- [ ] **Step 4: Reconcile the high-confidence reconstruction test**

Replace `returns unreadable when the image-to-transcript check finds reconstructed work` with:

```ts
it('continues a high-confidence nonempty transcript despite a verifier reconstruction concern', async () => {
  const analyze = makeRunAnalysis(client, config, {
    transcribe: async () => s1({ legibility: 0.9 }),
    verifyTranscription: async () => ({
      faithful: false,
      legible: false,
      note: 'Step 4 may be reconstructed.',
    }),
    analyzeSteps: async () => cleanDiag,
    verifyDiagnosis: async () => ({ agrees: true, note: '' }),
  })

  await expect(analyze(image)).resolves.toMatchObject({
    kind: 'analysis',
    errorStepIndex: null,
  })
})
```

- [ ] **Step 5: Run the focused test and verify RED**

Run:

```bash
npm run test:vitest -w server -- test/run.test.ts
```

Expected: the changed moderate-confidence test, the `0.151` boundary test, both one-signal-passes cases, and the high-confidence reconstruction test fail because the current `OR` condition still returns `unreadable`. The exact `0.15` test and override test should already pass. Confirm failures are assertion mismatches, not syntax or setup errors.

- [ ] **Step 6: Implement the minimal combined predicate**

In `server/src/pipeline/run.ts`, immediately below `RETAKE_TIPS`, add:

```ts
const CATASTROPHIC_LEGIBILITY_THRESHOLD = 0.15
```

Replace:

```ts
if (
  !options.allowUncertainTranscript
  && (!transcriptionCheck.faithful || !transcriptionCheck.legible)
)
  return { kind: 'unreadable', tips: RETAKE_TIPS }
```

with:

```ts
const overwhelminglyUnreadable =
  s1.legibility <= CATASTROPHIC_LEGIBILITY_THRESHOLD
  && !transcriptionCheck.faithful
  && !transcriptionCheck.legible
if (!options.allowUncertainTranscript && overwhelminglyUnreadable)
  return { kind: 'unreadable', tips: RETAKE_TIPS }
```

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```bash
npm run test:vitest -w server -- test/run.test.ts
```

Expected: every `run.test.ts` test passes, including unchanged zero-step and non-math safeguards.

- [ ] **Step 8: Run the entire server test workspace**

Run:

```bash
npm test -w server
```

Expected: all server Vitest and importer tests pass.

- [ ] **Step 9: Commit the behavioral fix**

Run:

```bash
git add server/src/pipeline/run.ts server/test/run.test.ts
git diff --cached --check
git commit -m "fix: make unreadable gate overwhelmingly conservative"
```

---

### Task 2: Reconcile public behavior and final evidence

**Files:**
- Modify: `README.md`
- Modify: `docs/submission/DEVPOST.md`
- Modify: `docs/submission/PROMETHEUS-ABOUT.md`
- Modify: `docs/validation/2026-07-22-prometheus-readiness.md`

**Interfaces:**
- Consumes: the combined predicate implemented in Task 1 and the exact final test output.
- Produces: public copy that accurately describes the rare retake gate and fresh repository-reproducible totals.

- [ ] **Step 1: Run the complete verification gate**

Run:

```bash
npm test
npm run typecheck
npm run lint -w app
git diff --check
```

Expected after the four added test instances: `571` total tests — `42` shared Vitest, `146` server Vitest, `4` importer, and `379` app Vitest. Record actual output instead if the test runner reports a different count; never force the documentation to match this estimate.

- [ ] **Step 2: Update the README behavior sentence**

In `README.md`, replace the current `server/` architecture bullet with:

```md
- `server/` normalizes a submitted image, compares every nonempty transcript with the visible ink, then runs diagnosis and an independent diagnosis check. Non-math and zero-step transcripts remain absolute rejections. For nonempty math work, the retake screen appears only when stage-one legibility is at or below `0.15` and the independent image check rejects both faithfulness and legibility; ordinary uncertainty continues into diagnosis. The optional `allowUncertainTranscript=true` flag is a request-scoped override for a student who chooses **Proceed anyway** after that rare rejection. The server has no accounts, database, or photo/history store.
```

- [ ] **Step 3: Update the Devpost workflow sentence**

In `docs/submission/DEVPOST.md`, replace workflow step 3 with:

```md
3. A second image check compares every nonempty transcript with the visible ink. Blank and non-math work remains blocked, but ordinary uncertainty continues into diagnosis. The retake screen appears only when stage-one confidence is exceptionally low and that image check rejects both faithfulness and legibility; **Proceed anyway** is a clearly warned, request-scoped override for that rare case.
```

- [ ] **Step 4: Update the first-person project story**

In `docs/submission/PROMETHEUS-ABOUT.md`, replace the fidelity-gate sentences in **How I built it** with:

```md
A second image pass compares each nonempty transcript with the visible ink before grading continues. Blank or non-math work stays blocked, while ordinary uncertainty continues into diagnosis. The app asks for a new photo only when stage-one confidence is exceptionally low and that second pass rejects both faithfulness and legibility; **Proceed anyway** remains a clearly warned override for that request only.
```

Blend these sentences into the existing paragraph without changing the rest of the section.

- [ ] **Step 5: Update the validation recovery description**

In `docs/validation/2026-07-22-prometheus-readiness.md`, replace the paragraph beginning `Strict analysis remains the default` with:

```md
The retake screen is now deliberately rare. Non-math and zero-step inputs remain blocked, while a nonempty transcript reaches that screen only when stage-one legibility is at or below `0.15` and the independent image check rejects both faithfulness and legibility. **Proceed anyway** sends `allowUncertainTranscript=true` for that request only; a forced request still cannot bypass a zero-step result.
```

Preserve the historical July 27 live evidence and the disclosure that the paid 25-image golden gate was not run.

- [ ] **Step 6: Reconcile automated totals with actual output**

Update the four files so their final automated evidence uses the exact total and component breakdown printed in Step 1. If the expected count is confirmed, replace:

```text
567
142 server
```

with:

```text
571
146 server
```

Do not alter human-only checklist boxes or claim a new live-model run.

- [ ] **Step 7: Validate public-copy consistency**

Run:

```bash
node - <<'NODE'
const fs = require('fs')
const files = [
  'README.md',
  'docs/submission/DEVPOST.md',
  'docs/submission/PROMETHEUS-ABOUT.md',
  'docs/validation/2026-07-22-prometheus-readiness.md',
]
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8')
  if (!text.includes('0.15') && file !== 'docs/submission/DEVPOST.md' && file !== 'docs/submission/PROMETHEUS-ABOUT.md')
    throw new Error(`${file}: exact gate threshold missing`)
  if (!/ordinary uncertainty continues|ordinary uncertainty continues into diagnosis/.test(text))
    throw new Error(`${file}: low-sensitivity behavior missing`)
  if (text.includes('567') || text.includes('142 server'))
    throw new Error(`${file}: stale automated totals remain`)
}
console.log('public unreadable-gate copy is consistent')
NODE
git diff --check
```

Expected: PASS.

- [ ] **Step 8: Re-run focused and full verification after documentation changes**

Run:

```bash
npm run test:vitest -w server -- test/run.test.ts
npm test
npm run typecheck
npm run lint -w app
git diff --check
git status --short
```

Expected: all commands pass; only the four intended tracked documentation files are modified, with no changes to root `.expo/` or root `tsconfig.json`.

- [ ] **Step 9: Commit the factual reconciliation**

Run:

```bash
git add README.md docs/submission/DEVPOST.md docs/submission/PROMETHEUS-ABOUT.md docs/validation/2026-07-22-prometheus-readiness.md
git diff --cached --check
git commit -m "docs: describe rare unreadable fallback"
```

---

### Task 3: Integrate and publish the verified fix

**Files:**
- No source changes.

**Interfaces:**
- Consumes: reviewed Task 1 and Task 2 commits.
- Produces: verified local `main` and an identical `origin/main`.

- [ ] **Step 1: Run whole-branch review**

Review the complete implementation range against:

```text
docs/superpowers/specs/2026-07-28-low-sensitivity-unreadable-gate-design.md
```

Critical and important findings must be fixed and re-reviewed before integration.

- [ ] **Step 2: Fast-forward local main**

From the main checkout:

```bash
git pull --ff-only
git merge --ff-only <implementation-branch>
```

Preserve the user-owned untracked root `.expo/` and root `tsconfig.json`.

- [ ] **Step 3: Verify the merged result**

Run:

```bash
npm test
npm run typecheck
npm run lint -w app
git diff --check
```

Expected: every command passes with the final totals recorded in Task 2.

- [ ] **Step 4: Push and verify the remote SHA**

The user has explicitly authorized this push. Run:

```bash
git push origin main
git fetch origin main
test "$(git rev-parse main)" = "$(git rev-parse origin/main)"
```

Report the final SHA, exact test total, and the low-sensitivity decision in the handoff.
