# FERMAT Handwriting Golden-Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reproducible ten-case FERMAT handwriting subset, expand the misconception vocabulary only where the selected cases require it, and make golden-set source/tag validation strict enough to protect the existing synthetic baseline.

**Architecture:** Keep `server/golden/manifest.json` as the executable expectation list, add source metadata to every case, and add a pinned one-off importer that downloads only two FERMAT shards and generates the ten committed JPEGs plus machine-readable provenance. The shared tag union remains the single API-contract source; server prompts and app labels derive from it. A source filter permits the paid FERMAT run before the combined 25-case run.

**Tech Stack:** Node 20+, TypeScript strict, zod 3, vitest, sharp, Expo/React Native, Python 3 one-off curation utility with pinned `requests`, `pyarrow`, and `Pillow` dependencies.

## Global Constraints

- Preserve all 15 existing synthetic cases and their filenames.
- Add exactly ten FERMAT cases: two correct and eight erroneous.
- Use FERMAT revision `80ff9934c38615bb8d3a33c24252db02e21774f0` and CC BY 4.0 attribution.
- Download only shards `train-00000-of-00010.parquet` and `train-00001-of-00010.parquet`, never the full 4.8 GB dataset.
- Never print or commit `HF_TOKEN`; read it from `server/.env` or the process environment.
- Add only `notation-error` and `formula-misapplied`; the other six selected error types map faithfully to existing tags.
- App workspace imports remain extensionless; server/shared relative imports remain `.js`-suffixed.
- Generated synthetic photos remain ignored; only `server/golden/photos/fermat-*.jpg` is committed.
- Do not run paid OpenAI golden calls until the user separately approves that checkpoint.
- Every code task follows red-green TDD and ends in a focused commit.

## Selected records

| Source ID | Shard/row | Output file | Outcome | First wrong step | Tag |
|---|---:|---|---|---:|---|
| `img_486_pert_5.1` | 0/0 | `fermat-img_486_pert_5_1.jpg` | correct | — | — |
| `img_400_pert_5.1` | 0/5 | `fermat-img_400_pert_5_1.jpg` | correct | — | — |
| `img_423_pert_3.1` | 1/117 | `fermat-img_423_pert_3_1.jpg` | error | 2 | `exponent-rule-error` |
| `img_401_pert_3.1` | 1/128 | `fermat-img_401_pert_3_1.jpg` | error | 4 | `algebraic-slip` |
| `img_384_pert_3.1` | 1/140 | `fermat-img_384_pert_3_1.jpg` | error | 1 | `notation-error` |
| `img_415_pert_3.1` | 1/164 | `fermat-img_415_pert_3_1.jpg` | error | 5 | `integration-by-parts-error` |
| `img_559_pert_3.1` | 1/180 | `fermat-img_559_pert_3_1.jpg` | error | 3 | `notation-error` |
| `img_583_pert_3.1` | 1/185 | `fermat-img_583_pert_3_1.jpg` | error | 2 | `distribution-error` |
| `img_479_pert_3.1` | 1/191 | `fermat-img_479_pert_3_1.jpg` | error | 2 | `formula-misapplied` |
| `img_584_pert_3.2` | 1/219 | `fermat-img_584_pert_3_2.jpg` | error | 2 | `sign-error` |

The row indices are zero-based within the named Parquet shard. The first-wrong-step indices count visible mathematical lines from top to bottom, matching the Stage 1 prompt. If a paid Stage 1 run segments lines differently, update only the manifest index after visually confirming the returned transcription; do not relabel the mathematical ground truth.

## File structure

**Create:**

- `server/scripts/import-fermat.py` — pinned selective downloader, image converter, and provenance generator.
- `server/scripts/requirements-fermat.txt` — isolated curation dependencies.
- `server/golden/fermat-provenance.json` — exact upstream annotations and local labeling rationale.
- `server/golden/FERMAT-ATTRIBUTION.md` — required CC BY 4.0 attribution and citation.
- `server/test/fermat.test.ts` — artifact/provenance/manifest integrity tests.
- `server/golden/photos/fermat-*.jpg` — ten selected, converted source images.

**Modify:**

- `server/scripts/judge.ts` — validated manifest schema, strict tag judging, source filtering.
- `server/scripts/golden.ts` — parse the manifest and honor `GOLDEN_SOURCE`.
- `server/test/judge.test.ts` — schema/filter/strict-tag coverage.
- `server/golden/manifest.json` — mark old cases synthetic and append the ten FERMAT expectations.
- `server/package.json` — add `golden:fermat` command.
- `shared/src/index.ts` and `shared/test/schemas.test.ts` — add the two controlled tags.
- `server/test/stage2.test.ts` — prove both new tags reach the model prompt.
- `app/src/lib/labels.ts` and `app/src/lib/labels.test.ts` — exhaustive display labels.
- `.gitignore` — keep generated photos ignored while allowing selected FERMAT JPEGs.
- `server/.env.example` — document optional `HF_TOKEN` without a secret.
- `README.md` — update vocabulary count and handwriting baseline status.

---

### Task 1: Validate and filter the golden manifest

**Files:**

- Modify: `server/scripts/judge.ts:1-29`
- Modify: `server/scripts/golden.ts:1-34`
- Modify: `server/test/judge.test.ts:1-38`
- Modify: `server/package.json:4-11`
- Modify: `server/golden/manifest.json:1-19`

**Interfaces:**

- Produces: `GoldenCaseSchema`, `GoldenManifestSchema`, `GoldenCase`, `GoldenSource`, and `selectCases(cases, source)` from `server/scripts/judge.ts`.
- Consumes later: Task 3 adds `source: "fermat"` and `sourceId` records that these schemas validate.

- [ ] **Step 1: Write failing schema, source-filter, and strict-tag tests**

Replace the tag-mismatch test and add validation/filter tests in `server/test/judge.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { AnalyzeResponse } from '@snap/shared'
import {
  GoldenCaseSchema,
  GoldenManifestSchema,
  judge,
  selectCases,
  type GoldenCase,
} from '../scripts/judge.js'

const analysis = (over: Partial<Extract<AnalyzeResponse, { kind: 'analysis' }>> = {}): AnalyzeResponse => ({
  kind: 'analysis', steps: [], errorStepIndex: null, misconceptionTag: null,
  explanation: null, followUp: null, verifierAgreed: true, ...over,
})

describe('GoldenCaseSchema', () => {
  it('requires an index and tag for error cases', () => {
    expect(() => GoldenCaseSchema.parse({ file: 'a.jpg', source: 'synthetic', expect: 'error' })).toThrow()
  })

  it('requires a source ID for FERMAT cases', () => {
    expect(() => GoldenCaseSchema.parse({ file: 'a.jpg', source: 'fermat', expect: 'correct' })).toThrow()
  })

  it('parses a complete manifest', () => {
    const parsed = GoldenManifestSchema.parse({
      cases: [{ file: 'a.jpg', source: 'synthetic', expect: 'correct' }],
    })
    expect(parsed.cases).toHaveLength(1)
  })
})

describe('selectCases', () => {
  const cases: GoldenCase[] = [
    { file: 'a.jpg', source: 'synthetic', expect: 'correct' },
    { file: 'b.jpg', source: 'fermat', sourceId: 'img_1', expect: 'correct' },
  ]

  it('returns all cases when no source is requested', () => {
    expect(selectCases(cases)).toEqual(cases)
  })

  it('filters cases by source', () => {
    expect(selectCases(cases, 'fermat').map((c) => c.file)).toEqual(['b.jpg'])
  })
})

describe('judge', () => {
  it('passes correct work with a null error index', () => {
    expect(judge({ file: 'a.jpg', source: 'synthetic', expect: 'correct' }, analysis()).pass).toBe(true)
  })

  it('fails a false accusation', () => {
    const actual = analysis({ errorStepIndex: 1, misconceptionTag: 'sign-error' })
    expect(judge({ file: 'a.jpg', source: 'synthetic', expect: 'correct' }, actual).pass).toBe(false)
  })

  it('passes only when error step and tag both match', () => {
    const expected: GoldenCase = {
      file: 'b.jpg', source: 'synthetic', expect: 'error', errorStepIndex: 2, tag: 'sign-error',
    }
    expect(judge(expected, analysis({ errorStepIndex: 2, misconceptionTag: 'sign-error' })).pass).toBe(true)
    expect(judge(expected, analysis({ errorStepIndex: 2, misconceptionTag: 'algebraic-slip' })).pass).toBe(false)
    expect(judge(expected, analysis({ errorStepIndex: 0, misconceptionTag: 'sign-error' })).pass).toBe(false)
  })

  it('matches unreadable and not-math kinds directly', () => {
    expect(judge({ file: 'c.jpg', source: 'synthetic', expect: 'not-math' }, { kind: 'not-math' }).pass).toBe(true)
    expect(judge({ file: 'd.jpg', source: 'synthetic', expect: 'unreadable' }, { kind: 'unreadable', tips: [] }).pass).toBe(true)
  })
})
```

- [ ] **Step 2: Run the focused tests and verify red**

Run: `npm test -w server -- --run test/judge.test.ts`

Expected: FAIL because the schemas and `selectCases` do not exist and tag mismatch still passes.

- [ ] **Step 3: Implement the validated schema, filter, and strict tag result**

Replace `server/scripts/judge.ts` with:

```ts
import { z } from 'zod'
import { MISCONCEPTION_TAGS, type AnalyzeResponse } from '@snap/shared'

export const GoldenSourceSchema = z.enum(['synthetic', 'fermat'])
export type GoldenSource = z.infer<typeof GoldenSourceSchema>

export const GoldenCaseSchema = z.object({
  file: z.string().min(1),
  source: GoldenSourceSchema,
  sourceId: z.string().min(1).optional(),
  expect: z.enum(['correct', 'error', 'unreadable', 'not-math']),
  errorStepIndex: z.number().int().min(0).optional(),
  tag: z.enum(MISCONCEPTION_TAGS).optional(),
}).superRefine((value, ctx) => {
  if (value.source === 'fermat' && !value.sourceId)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'FERMAT cases require sourceId' })
  if (value.expect === 'error' && (value.errorStepIndex === undefined || value.tag === undefined))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'error cases require errorStepIndex and tag' })
})
export type GoldenCase = z.infer<typeof GoldenCaseSchema>

export const GoldenManifestSchema = z.object({ cases: z.array(GoldenCaseSchema).min(1) })

export function selectCases(cases: GoldenCase[], source?: GoldenSource): GoldenCase[] {
  return source ? cases.filter((c) => c.source === source) : cases
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
  if (actual.errorStepIndex === null) return { pass: false, detail: 'missed the error entirely' }
  if (actual.errorStepIndex !== expected.errorStepIndex)
    return { pass: false, detail: `flagged step ${actual.errorStepIndex}, expected ${expected.errorStepIndex}` }
  if (actual.misconceptionTag !== expected.tag)
    return { pass: false, detail: `right step; tag mismatch (${actual.misconceptionTag} vs ${expected.tag})` }
  return { pass: true, detail: 'ok' }
}
```

In `server/scripts/golden.ts`, parse instead of casting and filter before the loop:

```ts
import { GoldenManifestSchema, GoldenSourceSchema, judge, selectCases } from './judge.js'

const parsed = GoldenManifestSchema.parse(JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8')))
const requestedSource = process.env.GOLDEN_SOURCE
const source = requestedSource ? GoldenSourceSchema.parse(requestedSource) : undefined
const cases = selectCases(parsed.cases, source)
```

Change the loop and summary to use `cases` rather than `manifest.cases`. Add to `server/package.json`:

```json
"golden:fermat": "GOLDEN_SOURCE=fermat tsx scripts/golden.ts"
```

Add `"source": "synthetic"` to every existing object in `server/golden/manifest.json`.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm test -w server -- --run test/judge.test.ts && npm run typecheck -w server`

Expected: all judge tests PASS; server typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add server/scripts/judge.ts server/scripts/golden.ts server/test/judge.test.ts server/package.json server/golden/manifest.json
git commit -m "test(server): validate and filter golden cases"
```

---

### Task 2: Expand the controlled misconception vocabulary

**Files:**

- Modify: `shared/src/index.ts:3-7`
- Modify: `shared/test/schemas.test.ts:20-57`
- Modify: `server/test/stage2.test.ts:17-27`
- Modify: `app/src/lib/labels.ts:3-16`
- Modify: `app/src/lib/labels.test.ts:5-11`
- Modify: `README.md:17-21`

**Interfaces:**

- Produces: `MisconceptionTag` additionally accepts `notation-error` and `formula-misapplied`.
- Consumers: Stage 2 automatically interpolates the expanded `MISCONCEPTION_TAGS`; app history/trends remain generic over the shared union.

- [ ] **Step 1: Write failing schema, prompt, and label assertions**

Update the shared vocabulary test:

```ts
it('vocabulary matches the approved controlled set', () => {
  expect(MISCONCEPTION_TAGS).toContain('equals-abuse')
  expect(MISCONCEPTION_TAGS).toContain('notation-error')
  expect(MISCONCEPTION_TAGS).toContain('formula-misapplied')
  expect(MISCONCEPTION_TAGS).toHaveLength(13)
})
```

In `server/test/stage2.test.ts`, after obtaining `text`, add:

```ts
expect(text).toContain('notation-error')
expect(text).toContain('formula-misapplied')
```

In `app/src/lib/labels.test.ts`, add:

```ts
it('uses student-facing labels for the handwriting additions', () => {
  expect(tagLabel('notation-error')).toBe('Notation error')
  expect(tagLabel('formula-misapplied')).toBe('Formula misapplied')
})
```

- [ ] **Step 2: Run the three focused tests and verify red**

Run:

```bash
npm test -w shared -- --run test/schemas.test.ts
npm test -w server -- --run test/stage2.test.ts
npm test -w app -- --run src/lib/labels.test.ts
```

Expected: shared/app compilation or assertions fail because the two tags are absent; server prompt assertions fail.

- [ ] **Step 3: Add the minimum two tags and labels**

Change the tail of `MISCONCEPTION_TAGS` in `shared/src/index.ts` to:

```ts
  'algebraic-slip', 'exponent-rule-error', 'equals-abuse',
  'notation-error', 'formula-misapplied', 'other',
```

Add to `LABELS` in `app/src/lib/labels.ts`:

```ts
  'notation-error': 'Notation error',
  'formula-misapplied': 'Formula misapplied',
```

Change “11-tag misconception vocabulary” to “13-tag misconception vocabulary” in `README.md`.

- [ ] **Step 4: Run focused and workspace verification**

Run:

```bash
npm test -w shared -- --run test/schemas.test.ts
npm test -w server -- --run test/stage2.test.ts
npm test -w app -- --run src/lib/labels.test.ts
npm run typecheck
```

Expected: all focused tests PASS and root typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add shared/src/index.ts shared/test/schemas.test.ts server/test/stage2.test.ts app/src/lib/labels.ts app/src/lib/labels.test.ts README.md
git commit -m "feat: add notation and formula misconception tags"
```

---

### Task 3: Import the pinned FERMAT subset with provenance

**Files:**

- Create: `server/scripts/import-fermat.py`
- Create: `server/scripts/requirements-fermat.txt`
- Create: `server/test/fermat.test.ts`
- Create: `server/golden/fermat-provenance.json` (generated)
- Create: `server/golden/FERMAT-ATTRIBUTION.md`
- Create: ten `server/golden/photos/fermat-*.jpg` files (generated)
- Modify: `.gitignore:5`
- Modify: `server/.env.example:1-2`
- Modify: `server/golden/manifest.json`

**Interfaces:**

- Consumes: Task 1 `GoldenManifestSchema`; Task 2 expanded `MisconceptionTag` union.
- Produces: ten reproducible JPEG fixtures and aligned provenance/manifest data.

- [ ] **Step 1: Write the failing artifact integrity test**

Create `server/test/fermat.test.ts`:

```ts
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { GoldenManifestSchema } from '../scripts/judge.js'

const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const goldenDir = path.join(serverDir, 'golden')
const manifest = GoldenManifestSchema.parse(
  JSON.parse(await readFile(path.join(goldenDir, 'manifest.json'), 'utf8')),
)
const provenance = JSON.parse(
  await readFile(path.join(goldenDir, 'fermat-provenance.json'), 'utf8'),
) as {
  dataset: string
  revision: string
  license: string
  transformation: string
  cases: Array<{
    file: string
    sourceId: string
    hasError: boolean
    originalQuestion: string
    correctSolution: string
    perturbedSolution: string
    perturbationReasoning: string
    expected: { kind: 'correct' } | { kind: 'error'; errorStepIndex: number; tag: string }
    labelRationale: string
  }>
}

describe('FERMAT curated subset', () => {
  const cases = manifest.cases.filter((c) => c.source === 'fermat')

  it('contains exactly two correct and eight error cases', () => {
    expect(cases).toHaveLength(10)
    expect(cases.filter((c) => c.expect === 'correct')).toHaveLength(2)
    expect(cases.filter((c) => c.expect === 'error')).toHaveLength(8)
  })

  it('pins the licensed upstream revision and aligns provenance one-to-one', () => {
    expect(provenance.dataset).toBe('ai4bharat/FERMAT')
    expect(provenance.revision).toBe('80ff9934c38615bb8d3a33c24252db02e21774f0')
    expect(provenance.license).toBe('CC BY 4.0')
    expect(provenance.cases.map((c) => c.file).sort()).toEqual(cases.map((c) => c.file).sort())
    expect(new Set(provenance.cases.map((c) => c.sourceId)).size).toBe(10)
    for (const record of provenance.cases) {
      expect(record.originalQuestion).not.toBe('')
      expect(record.correctSolution).not.toBe('')
      expect(record.perturbedSolution).not.toBe('')
      expect(record.perturbationReasoning).not.toBe('')
      expect(record.labelRationale).not.toBe('')
    }
  })

  it('stores every selected image as a decodable JPEG', async () => {
    for (const c of cases) {
      expect(c.file).toMatch(/^fermat-.+\.jpg$/)
      const metadata = await sharp(path.join(goldenDir, 'photos', c.file)).metadata()
      expect(metadata.format).toBe('jpeg')
      expect(metadata.width).toBeGreaterThan(500)
      expect(metadata.height).toBeGreaterThan(300)
    }
  })
})
```

- [ ] **Step 2: Run the focused test and verify red**

Run: `npm test -w server -- --run test/fermat.test.ts`

Expected: FAIL because the provenance file and selected images do not exist.

- [ ] **Step 3: Create the pinned importer and dependency file**

Create `server/scripts/requirements-fermat.txt`:

```text
Pillow==11.3.0
pyarrow==25.0.0
requests==2.32.5
```

Create `server/scripts/import-fermat.py` with constants for the two shard names and the exact selection table above. Each selection object must contain `source_id`, `shard`, `row`, `file`, `expected`, and `label_rationale`. The rationales are:

```text
img_486_pert_5.1: Consistent variable renaming leaves the age equation correct.
img_400_pert_5.1: Consistent y-to-z renaming leaves d(a^x)/dx correct.
img_423_pert_3.1: sqrt(t) is rewritten as t^2 at the first transformed integral.
img_401_pert_3.1: A previously correct (6x+4) numerator is halved during an algebraic rewrite.
img_384_pert_3.1: The derivative term 6x is changed to the nonequivalent notation 6^x.
img_415_pert_3.1: The final integration-by-parts line replaces cos(x) with sin(x).
img_559_pert_3.1: The result drops the exponent from 2x^2 to 2x.
img_583_pert_3.1: The product expansion changes the cross-term sum 5+6 into 5*6.
img_479_pert_3.1: The Celsius conversion substitutes reciprocal factor 9/5 for 5/9.
img_584_pert_3.2: Evaluating p(2) replaces subtraction with addition.
```

The complete importer behavior is:

```python
from __future__ import annotations

import io
import json
import os
import tempfile
from pathlib import Path

import pyarrow.parquet as pq
import requests
from PIL import Image, ImageOps

DATASET = "ai4bharat/FERMAT"
REVISION = "80ff9934c38615bb8d3a33c24252db02e21774f0"
SHARDS = {
    0: "train-00000-of-00010.parquet",
    1: "train-00001-of-00010.parquet",
}
SELECTIONS = [
    {"source_id": "img_486_pert_5.1", "shard": 0, "row": 0, "file": "fermat-img_486_pert_5_1.jpg", "expected": {"kind": "correct"}, "label_rationale": "Consistent variable renaming leaves the age equation correct."},
    {"source_id": "img_400_pert_5.1", "shard": 0, "row": 5, "file": "fermat-img_400_pert_5_1.jpg", "expected": {"kind": "correct"}, "label_rationale": "Consistent y-to-z renaming leaves d(a^x)/dx correct."},
    {"source_id": "img_423_pert_3.1", "shard": 1, "row": 117, "file": "fermat-img_423_pert_3_1.jpg", "expected": {"kind": "error", "errorStepIndex": 2, "tag": "exponent-rule-error"}, "label_rationale": "sqrt(t) is rewritten as t^2 at the first transformed integral."},
    {"source_id": "img_401_pert_3.1", "shard": 1, "row": 128, "file": "fermat-img_401_pert_3_1.jpg", "expected": {"kind": "error", "errorStepIndex": 4, "tag": "algebraic-slip"}, "label_rationale": "A previously correct (6x+4) numerator is halved during an algebraic rewrite."},
    {"source_id": "img_384_pert_3.1", "shard": 1, "row": 140, "file": "fermat-img_384_pert_3_1.jpg", "expected": {"kind": "error", "errorStepIndex": 1, "tag": "notation-error"}, "label_rationale": "The derivative term 6x is changed to the nonequivalent notation 6^x."},
    {"source_id": "img_415_pert_3.1", "shard": 1, "row": 164, "file": "fermat-img_415_pert_3_1.jpg", "expected": {"kind": "error", "errorStepIndex": 5, "tag": "integration-by-parts-error"}, "label_rationale": "The final integration-by-parts line replaces cos(x) with sin(x)."},
    {"source_id": "img_559_pert_3.1", "shard": 1, "row": 180, "file": "fermat-img_559_pert_3_1.jpg", "expected": {"kind": "error", "errorStepIndex": 3, "tag": "notation-error"}, "label_rationale": "The result drops the exponent from 2x^2 to 2x."},
    {"source_id": "img_583_pert_3.1", "shard": 1, "row": 185, "file": "fermat-img_583_pert_3_1.jpg", "expected": {"kind": "error", "errorStepIndex": 2, "tag": "distribution-error"}, "label_rationale": "The product expansion changes the cross-term sum 5+6 into 5*6."},
    {"source_id": "img_479_pert_3.1", "shard": 1, "row": 191, "file": "fermat-img_479_pert_3_1.jpg", "expected": {"kind": "error", "errorStepIndex": 2, "tag": "formula-misapplied"}, "label_rationale": "The Celsius conversion substitutes reciprocal factor 9/5 for 5/9."},
    {"source_id": "img_584_pert_3.2", "shard": 1, "row": 219, "file": "fermat-img_584_pert_3_2.jpg", "expected": {"kind": "error", "errorStepIndex": 2, "tag": "sign-error"}, "label_rationale": "Evaluating p(2) replaces subtraction with addition."},
]

SERVER_DIR = Path(__file__).resolve().parents[1]
GOLDEN_DIR = SERVER_DIR / "golden"
PHOTO_DIR = GOLDEN_DIR / "photos"


def env_token() -> str:
    if token := os.environ.get("HF_TOKEN"):
        return token
    env_path = SERVER_DIR / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("HF_TOKEN="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("HF_TOKEN is required; accept FERMAT access and set it in server/.env")


def download_shard(number: int, cache_dir: Path, token: str) -> Path:
    filename = SHARDS[number]
    target = cache_dir / filename
    if target.exists():
        return target
    url = f"https://huggingface.co/datasets/{DATASET}/resolve/{REVISION}/data/{filename}"
    with requests.get(url, headers={"Authorization": f"Bearer {token}"}, stream=True, timeout=60) as response:
        response.raise_for_status()
        partial = target.with_suffix(".partial")
        with partial.open("wb") as output:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                output.write(chunk)
        partial.replace(target)
    return target


def main() -> None:
    token = env_token()
    cache_dir = Path(os.environ.get("FERMAT_CACHE_DIR", Path(tempfile.gettempdir()) / "snap-a-mistake-fermat"))
    cache_dir.mkdir(parents=True, exist_ok=True)
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    tables = {
        number: pq.read_table(download_shard(number, cache_dir, token))
        for number in sorted({item["shard"] for item in SELECTIONS})
    }
    records = []
    for selected in SELECTIONS:
        row = tables[selected["shard"]].slice(selected["row"], 1).to_pylist()[0]
        if row["new_custom_id"] != selected["source_id"]:
            raise RuntimeError(f"source mismatch at shard {selected['shard']} row {selected['row']}")
        expected_error = selected["expected"]["kind"] == "error"
        if bool(row["has_error"]) != expected_error:
            raise RuntimeError(f"has_error mismatch for {selected['source_id']}")
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(row["image"]["bytes"]))).convert("RGB")
        image.save(PHOTO_DIR / selected["file"], "JPEG", quality=88, optimize=True)
        records.append({
            "file": selected["file"],
            "sourceId": selected["source_id"],
            "shard": SHARDS[selected["shard"]],
            "rowIndex": selected["row"],
            "grade": row["grade"],
            "domain": row["domain_code"],
            "subdomain": row["subdomain_code"],
            "handwritingStyle": "legible" if row["handwriting_style"] else "challenging",
            "imageQuality": "good" if row["image_quality"] else "challenging",
            "rotation": row["rotation"],
            "annotatorId": row["annot_id"],
            "imageId": row["img_id"],
            "hasError": bool(row["has_error"]),
            "originalQuestion": row["orig_q"],
            "correctSolution": row["orig_a"],
            "perturbedSolution": row["pert_a"],
            "perturbationReasoning": row["pert_reasoning"],
            "expected": selected["expected"],
            "labelRationale": selected["label_rationale"],
        })
    provenance = {
        "dataset": DATASET,
        "revision": REVISION,
        "license": "CC BY 4.0",
        "sourceUrl": f"https://huggingface.co/datasets/{DATASET}",
        "transformation": "Embedded source PNG converted to JPEG quality 88 with EXIF orientation applied; no crop or resize.",
        "cases": records,
    }
    (GOLDEN_DIR / "fermat-provenance.json").write_text(json.dumps(provenance, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {len(records)} FERMAT cases")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Permit only curated JPEGs and document the optional token**

Replace `server/golden/photos/` in `.gitignore` with:

```gitignore
server/golden/photos/*
!server/golden/photos/fermat-*.jpg
```

Change `server/.env.example` to:

```dotenv
OPENAI_API_KEY=sk-...
# Optional: only required to reproduce the curated FERMAT golden images.
HF_TOKEN=
PORT=3000
```

- [ ] **Step 5: Install the isolated importer dependencies and generate artifacts**

Run:

```bash
python3 -m venv /private/tmp/snap-a-mistake-fermat-import
/private/tmp/snap-a-mistake-fermat-import/bin/pip install -r server/scripts/requirements-fermat.txt
FERMAT_CACHE_DIR=/private/tmp/snap-a-mistake-fermat /private/tmp/snap-a-mistake-fermat-import/bin/python server/scripts/import-fermat.py
```

Expected: `wrote 10 FERMAT cases`; ten JPEGs and `fermat-provenance.json` exist under `server/golden/`.

- [ ] **Step 6: Append the exact ten manifest cases**

Append these objects to `server/golden/manifest.json`:

```json
{ "file": "fermat-img_486_pert_5_1.jpg", "source": "fermat", "sourceId": "img_486_pert_5.1", "expect": "correct" },
{ "file": "fermat-img_400_pert_5_1.jpg", "source": "fermat", "sourceId": "img_400_pert_5.1", "expect": "correct" },
{ "file": "fermat-img_423_pert_3_1.jpg", "source": "fermat", "sourceId": "img_423_pert_3.1", "expect": "error", "errorStepIndex": 2, "tag": "exponent-rule-error" },
{ "file": "fermat-img_401_pert_3_1.jpg", "source": "fermat", "sourceId": "img_401_pert_3.1", "expect": "error", "errorStepIndex": 4, "tag": "algebraic-slip" },
{ "file": "fermat-img_384_pert_3_1.jpg", "source": "fermat", "sourceId": "img_384_pert_3.1", "expect": "error", "errorStepIndex": 1, "tag": "notation-error" },
{ "file": "fermat-img_415_pert_3_1.jpg", "source": "fermat", "sourceId": "img_415_pert_3.1", "expect": "error", "errorStepIndex": 5, "tag": "integration-by-parts-error" },
{ "file": "fermat-img_559_pert_3_1.jpg", "source": "fermat", "sourceId": "img_559_pert_3.1", "expect": "error", "errorStepIndex": 3, "tag": "notation-error" },
{ "file": "fermat-img_583_pert_3_1.jpg", "source": "fermat", "sourceId": "img_583_pert_3.1", "expect": "error", "errorStepIndex": 2, "tag": "distribution-error" },
{ "file": "fermat-img_479_pert_3_1.jpg", "source": "fermat", "sourceId": "img_479_pert_3.1", "expect": "error", "errorStepIndex": 2, "tag": "formula-misapplied" },
{ "file": "fermat-img_584_pert_3_2.jpg", "source": "fermat", "sourceId": "img_584_pert_3.2", "expect": "error", "errorStepIndex": 2, "tag": "sign-error" }
```

- [ ] **Step 7: Add attribution**

Create `server/golden/FERMAT-ATTRIBUTION.md`:

```markdown
# FERMAT attribution

The files named `fermat-*.jpg` in `server/golden/photos/` are selected records from
[AI4Bharat FERMAT](https://huggingface.co/datasets/ai4bharat/FERMAT), revision
`80ff9934c38615bb8d3a33c24252db02e21774f0`, licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Local modifications: embedded source PNGs were converted to JPEG quality 88 with
EXIF orientation applied. They were not cropped or resized. Exact record identifiers,
upstream annotations, transformations, and Snap-a-Mistake labels are recorded in
`fermat-provenance.json`.

Please cite:

> Oikantik Nath, Hanani Bathina, Mohammed Safi Ur Rahman Khan, and Mitesh M. Khapra.
> “Can Vision-Language Models Evaluate Handwritten Math?” ACL 2025.
```

- [ ] **Step 8: Run artifact tests and inspect repository size**

Run:

```bash
npm test -w server -- --run test/fermat.test.ts
du -sh server/golden/photos
git status --short
```

Expected: artifact tests PASS; only ten `fermat-*.jpg` files are visible to Git; temporary Parquet shards remain outside the repository.

- [ ] **Step 9: Commit**

```bash
git add .gitignore server/.env.example server/scripts/import-fermat.py server/scripts/requirements-fermat.txt server/golden/manifest.json server/golden/fermat-provenance.json server/golden/FERMAT-ATTRIBUTION.md server/golden/photos/fermat-*.jpg server/test/fermat.test.ts
git commit -m "test(server): add curated FERMAT handwriting set"
```

---

### Task 4: Full no-cost verification and handoff

**Files:**

- Modify: `README.md:46-75`

**Interfaces:**

- Consumes: all prior tasks.
- Produces: verified 25-case manifest and clear paid-run instructions.

- [ ] **Step 1: Update current status and commands in README**

Add `npm run golden:fermat -w server` below the golden commands, describing it as the paid ten-case handwriting-only gate. Replace the current golden status with:

```markdown
- Golden manifest: **25 cases** — 15 generated baseline cases plus 10 curated FERMAT photographs (2 correct, 8 intentional errors across algebra/calculus). The generated baseline last passed 15/15; the FERMAT subset is committed and ready for its first paid pipeline run.
```

Keep the on-device photo pass as the next priority because FERMAT does not exercise this app's exact camera hardware.

- [ ] **Step 2: Run the complete no-cost verification gate**

Run:

```bash
npm test
npm run typecheck
git diff --check
git status --short
```

Expected:  all tests PASS, typecheck exits 0, diff check is clean, and only intended files appear.

- [ ] **Step 3: Confirm secrets and large source shards are absent**

Run:

```bash
git check-ignore server/.env
git ls-files 'server/golden/*.parquet' 'server/golden/**/*.parquet' 'server/.env'
git ls-files 'server/golden/photos/fermat-*.jpg'
```

Expected: `server/.env` is ignored; the second command prints nothing; the final command prints exactly ten filenames.

- [ ] **Step 4: Commit the handoff documentation**

```bash
git add README.md
git commit -m "docs: document FERMAT handwriting gate"
```

- [ ] **Step 5: Stop before paid model calls**

Report the no-cost test/typecheck results, selected image count and size, new tags, and the exact next command:

```bash
npm run golden:fermat -w server
```

Do not execute it until the user explicitly approves spending API credits. After the FERMAT-only run passes or has been tuned without regressing the generated baseline, run the combined suite with `npm run golden -w server`.

## Plan self-review

- **Spec coverage:** source licensing, pinned revision, two-correct/eight-error balance, visual/manual selection, minimal vocabulary expansion, app labels, prompt propagation, reproducible import, committed images, manifest/provenance alignment, separate paid gate, and preservation of the synthetic baseline all have explicit tasks.
- **Completeness scan:** every code-facing change has exact paths, commands, assertions, or complete implementation text.
- **Type consistency:** `GoldenSource`, `GoldenCase`, `GoldenManifestSchema`, `source`, `sourceId`, `errorStepIndex`, and the two new tag identifiers use the same spellings in schemas, tests, manifest, importer, app labels, and provenance.
