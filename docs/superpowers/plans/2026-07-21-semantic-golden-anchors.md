# Semantic Golden Anchors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the FERMAT golden gate validate the mathematical content of the selected runtime step while preserving one strict canonical misconception tag per case.

**Architecture:** A focused `step-anchor.ts` module normalizes and matches human-authored math fragments against the runtime step chosen by Stage 2. Golden error cases use exactly one locator: stable synthetic fixtures retain numeric indices, while FERMAT photographs use semantic anchors. Stage 2 receives an explicit canonical-tag decision order, and a compact sanitized run-2 replay fixture proves the new contract without API calls.

**Tech Stack:** TypeScript, Zod, Vitest, Node.js ESM/filesystem APIs, JSON fixtures, npm workspaces.

## Global Constraints

- Do not change production API or shared `AnalyzeResponse` schemas.
- Do not change images, provenance source annotations, model IDs, timeouts, retry policy, or the thirteen-tag vocabulary.
- FERMAT error cases must use semantic anchors; synthetic error cases must retain fixed numeric indices.
- The tag remains one exact canonical value; do not add accepted-tag arrays.
- Audit/replay data must exclude image bytes, full prompts, explanations, follow-ups, keys, headers, and environment values.
- Do not run a paid golden command during implementation. A paid FERMAT validation requires a separate user approval after review.

---

### Task 1: Add semantic locator primitives and strict judging

**Files:**
- Create: `server/scripts/step-anchor.ts`
- Create: `server/test/step-anchor.test.ts`
- Modify: `server/scripts/judge.ts`
- Modify: `server/scripts/golden-audit.ts`
- Modify: `server/test/judge.test.ts`
- Modify: `server/test/golden-audit.test.ts`

**Interfaces:**
- Produces: `StepAnchorSchema`, `StepAnchor`, `normalizeStepAnchorText(value)`, and `matchStepAnchor(anchor, step)`.
- Consumes: `TranscribedStep` from `@snap/shared`.
- Produces for Task 2: `GoldenCaseSchema` accepts `errorStepAnchor` and `judge()` applies it.

- [ ] **Step 1: Write failing normalization and matcher tests**

Create `server/test/step-anchor.test.ts` with focused examples:

```ts
expect(normalizeStepAnchorText(' \\left( X^{−1} \\right) ')).toBe('x^-1')
expect(normalizeStepAnchorText('2 \\cdot 2')).toBe('2*2')

const step = {
  index: 8,
  latex: '\\tan^{-1}y=x^{-1}+C',
  plain: 'Inverse tangent of y equals x to the power negative one plus C.',
  yBandTopPct: 60,
  yBandBottomPct: 70,
}
expect(matchStepAnchor({ all: ['x^{-1}'] }, step)).toMatchObject({ pass: true })
expect(matchStepAnchor({ all: ['2x-4xy'], none: ['2x^2-4xy'] }, step)).toMatchObject({ pass: false })
```

Also assert conjunction across `all`, exclusion through `none`, and rejection of a fragment that normalizes to an empty string.

- [ ] **Step 2: Verify RED**

Run: `npm run test:vitest -w server -- step-anchor.test.ts`

Expected: FAIL because `../scripts/step-anchor.js` does not exist.

- [ ] **Step 3: Implement the anchor module**

Create `server/scripts/step-anchor.ts`:

```ts
import { z } from 'zod'
import type { TranscribedStep } from '@snap/shared'

export function normalizeStepAnchorText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[−–—]/g, '-')
    .replace(/\\cdot|[×·]/g, '*')
    .replace(/\\(?:left|right|quad|[,;!])/g, '')
    .replace(/\s+/g, '')
    .replace(/[{}\[\]()]/g, '')
}

const nonEmptyFragment = z.string().min(1).refine(
  (value) => normalizeStepAnchorText(value).length > 0,
  'anchor fragment must contain mathematical content',
)

export const StepAnchorSchema = z.object({
  all: z.array(nonEmptyFragment).min(1),
  none: z.array(nonEmptyFragment).optional(),
})
export type StepAnchor = z.infer<typeof StepAnchorSchema>

export function matchStepAnchor(anchor: StepAnchor, step: Pick<TranscribedStep, 'latex' | 'plain'>) {
  const fields = [normalizeStepAnchorText(step.latex), normalizeStepAnchorText(step.plain)]
  const contains = (fragment: string) => {
    const normalized = normalizeStepAnchorText(fragment)
    return fields.some((field) => field.includes(normalized))
  }
  const missing = anchor.all.filter((fragment) => !contains(fragment))
  const forbidden = (anchor.none ?? []).filter(contains)
  return { pass: missing.length === 0 && forbidden.length === 0, missing, forbidden }
}
```

- [ ] **Step 4: Write failing schema and judge tests**

In `server/test/judge.test.ts`, add cases proving:

```ts
GoldenCaseSchema.parse({
  file: 'photo.jpg', source: 'fermat', sourceId: 'img_1', expect: 'error',
  errorStepAnchor: { all: ['x^{-1}'] }, tag: 'notation-error',
})
```

parses, while FERMAT numeric locators, synthetic anchors, both locators, neither locator, empty anchors, and locators on non-error outcomes throw.

Add judge tests where the same anchored step passes at indices 8 and 9; a selected line without the anchor fails; a forbidden fragment fails; and existing synthetic exact-index behavior still passes/fails as before.

- [ ] **Step 5: Verify schema/judge RED**

Run: `npm run test:vitest -w server -- judge.test.ts`

Expected: FAIL because `GoldenCaseSchema` does not accept `errorStepAnchor` and `judge()` still requires exact index equality.

- [ ] **Step 6: Implement the strict locator union and judge order**

Import `StepAnchorSchema` and `matchStepAnchor` into `judge.ts`. Add `errorStepAnchor: StepAnchorSchema.optional()` to the object. In `superRefine`, require exactly one locator for errors, then enforce anchor for FERMAT and index for synthetic. For non-errors, forbid both locators.

After `actual.errorStepIndex !== null`, locate the runtime step before checking the configured locator:

```ts
const locatedStep = actual.steps.find((step) => step.index === actual.errorStepIndex)
if (!locatedStep)
  return { pass: false, detail: `diagnosed step ${actual.errorStepIndex} is absent from returned steps` }

if (expected.errorStepAnchor) {
  const match = matchStepAnchor(expected.errorStepAnchor, locatedStep)
  if (!match.pass)
    return {
      pass: false,
      detail: `selected step does not match anchor (missing: ${match.missing.join(', ') || 'none'}; forbidden: ${match.forbidden.join(', ') || 'none'})`,
    }
} else if (actual.errorStepIndex !== expected.errorStepIndex) {
  return { pass: false, detail: `flagged step ${actual.errorStepIndex}, expected ${expected.errorStepIndex}` }
}
```

Then preserve exact tag, verifier, and `wrong`-verdict checks.

- [ ] **Step 7: Extend sanitized audit expectations**

Change `GoldenAuditExpected` to pick `errorStepAnchor` and whitelist it in `serializableEntry`. Update the audit test with an anchored expected case and assert the anchor survives while existing secret/image exclusions remain green.

- [ ] **Step 8: Verify Task 1 GREEN and full no-cost gates**

Run:

```bash
npm run test:vitest -w server -- step-anchor.test.ts judge.test.ts golden-audit.test.ts
npm test
npm run typecheck
git diff --check
```

Expected: all focused and root gates pass; no golden command runs.

- [ ] **Step 9: Commit**

Commit message: `feat(server): judge golden steps semantically`

---

### Task 2: Migrate FERMAT cases and add the sanitized audit replay

**Files:**
- Modify: `server/golden/manifest.json`
- Modify: `server/test/fermat.test.ts`
- Create: `server/test/fixtures/fermat-audit-run2-selected.json`
- Create: `server/test/fermat-audit-replay.test.ts`

**Interfaces:**
- Consumes: `StepAnchor` and anchored `judge()` from Task 1.
- Produces: eight FERMAT anchors and a no-cost regression fixture derived from the paid run-2 audit.

- [ ] **Step 1: Add failing manifest-contract tests**

In `fermat.test.ts`, assert every FERMAT error has no `errorStepIndex` and exactly the spec-approved anchor/tag mapping:

```ts
const expectedAnchors = {
  'img_438_pert_3.1': { all: ['x^{-1}'] },
  'img_401_pert_3.1': { all: ['3x+2', '3x^2+4x+5'] },
  'img_414_pert_3.1': { all: ['\\frac{x+3}{x+1}'] },
  'img_415_pert_3.1': { all: ['\\sin x-\\sin x'] },
  'img_559_pert_3.1': { all: ['2x-4xy'], none: ['2x^2-4xy'] },
  'img_601_pert_3.1': { all: ['\\frac{n}{n-1}'] },
  'img_468_pert_3.1': { all: ['-3&4', '2&-1'] },
  'img_584_pert_3.2': { all: ['P(2)=2^2+2\\cdot2'] },
}
```

Keep provenance expectations at the manually audited visible indices; explicitly assert those source annotations did not change.

- [ ] **Step 2: Verify manifest RED**

Run: `npm run test:vitest -w server -- fermat.test.ts`

Expected: FAIL because FERMAT manifest cases still use numeric locators.

- [ ] **Step 3: Convert only the eight FERMAT error locators**

Replace `errorStepIndex` with the exact `errorStepAnchor` objects above. Do not change files, sources, source IDs, outcomes, tags, order, images, or provenance.

- [ ] **Step 4: Create the compact replay fixture**

Create `server/test/fixtures/fermat-audit-run2-selected.json` with one record per error case:

```json
{
  "sourceId": "img_438_pert_3.1",
  "actualIndex": 8,
  "latex": "\\tan^{-1}y=x^{-1}+C,",
  "plain": "Inverse tangent of y equals x to the power negative one plus C.",
  "actualTag": "formula-misapplied",
  "verifierAgreed": true,
  "verdict": "wrong"
}
```

Populate the remaining seven selected steps exactly from `/private/tmp/snap-a-mistake-fermat-audit-run2.json`. Store no explanations, follow-ups, prompts, image bytes, headers, keys, or environment data.

- [ ] **Step 5: Write failing replay tests**

In `fermat-audit-replay.test.ts`:

- load the parsed FERMAT manifest and replay fixture;
- assert `matchStepAnchor` matches the seven responses that selected the known erroneous text and rejects `img_559`'s correct selected line;
- build `AnalyzeResponse` values using each runtime index and the manifest's canonical tag, then assert `judge()` passes the seven semantic selections and rejects `img_559`;
- restore the run-2 actual tags and assert strict canonical tag mismatches still fail;
- scan serialized fixture text for forbidden fields/secret patterns.

- [ ] **Step 6: Verify replay RED then GREEN**

Run before fixture/test completion: `npm run test:vitest -w server -- fermat-audit-replay.test.ts`

Expected RED: missing fixture or semantic-locator behavior.

Run after implementation:

```bash
npm run test:vitest -w server -- fermat.test.ts fermat-audit-replay.test.ts
npm test
npm run typecheck
git diff --check
```

Expected GREEN: all focused and root gates pass; no paid call runs.

- [ ] **Step 7: Commit**

Commit message: `test(server): anchor FERMAT error steps`

---

### Task 3: Enforce canonical tag priorities in Stage 2

**Files:**
- Modify: `server/src/pipeline/stage2.ts`
- Modify: `server/test/stage2.test.ts`

**Interfaces:**
- Consumes: the existing thirteen-tag vocabulary.
- Produces: an explicit decision order and audited boundary examples in the Stage 2 system prompt.

- [ ] **Step 1: Write failing prompt-contract tests**

Extend `stage2.test.ts` to assert the rendered system prompt contains, in order:

```text
1. method-specific rule
2. formula-misapplied
3. sign-error
4. notation-error
5. equals-abuse
6. algebraic-slip
```

Also assert concrete boundaries:

- inverse-function notation versus reciprocal → `notation-error`;
- incorrect log-ratio recombination after correct integration → `algebraic-slip`;
- replacing the established cosine term in the final integration-by-parts answer → `integration-by-parts-error`;
- isolated `n+1` to `n-1` → `sign-error`;
- reordered adjugate template → `formula-misapplied`, not `equals-abuse`.

- [ ] **Step 2: Verify RED**

Run: `npm run test:vitest -w server -- stage2.test.ts`

Expected: FAIL because the prompt defines tags but has no ordered decision policy or audited examples.

- [ ] **Step 3: Implement the canonical decision guide**

Add a `TAG_DECISION_GUIDE` block immediately after `TAG_GUIDE`. Keep definitions and vocabulary unchanged. Phrase examples as general classification boundaries rather than answers keyed to filenames.

The guide must say `other` is last-resort and that the model must choose the first applicable category in the decision order.

- [ ] **Step 4: Verify GREEN and full no-cost gates**

Run:

```bash
npm run test:vitest -w server -- stage2.test.ts
npm test
npm run typecheck
git diff --check
```

Expected: all gates pass; no model call runs.

- [ ] **Step 5: Commit**

Commit message: `fix(server): canonicalize misconception tags`

---

### Task 4: Update handoff documentation and run final verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: final test output and reviewed behavior from Tasks 1-3.
- Produces: truthful golden-gate documentation and a paid-validation checkpoint.

- [ ] **Step 1: Update test and golden-gate documentation**

Replace brittle old test totals with wording that says root `npm test` runs all workspace Vitest suites plus four stock-Python importer tests. Update current status to record:

- two paid FERMAT diagnostic runs completed at 2/10 and 4/10;
- fixed numeric FERMAT indices were disproven by audited segmentation drift;
- the branch now judges FERMAT localization by semantic anchors and exact canonical tags;
- the semantic/canonical prompt has not yet received a paid validation run.

Keep the generated 15-case baseline status and on-device priority truthful.

- [ ] **Step 2: Run the complete no-cost gate**

Run:

```bash
npm test
npm run typecheck
git diff --check
git status --short
```

Expected: all tests and typechecks pass, diff check is silent, and only the intended README change is pending before commit.

- [ ] **Step 3: Run integrity and security checks**

Verify:

- manifest remains 25 cases with 10 FERMAT cases, 2 correct and 8 error;
- all eight FERMAT errors use anchors and all synthetic errors use indices;
- provenance/image hashes and source records are unchanged;
- no `.env`, token, parquet, audit output, partial, cache, or `.superpowers` file is tracked;
- the compact replay fixture contains none of the forbidden fields or secret patterns.

- [ ] **Step 4: Commit**

Commit message: `docs: document semantic FERMAT gate`

- [ ] **Step 5: Stop at the paid checkpoint**

Do not run `npm run golden:fermat -w server`. Report the final no-cost evidence and request separate user approval for one paid semantic/canonical validation run.
