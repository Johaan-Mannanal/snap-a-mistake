# Golden Audit and Index Calibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture paid golden responses safely and use their actual Stage 1 step text to test and calibrate FERMAT error indices.

**Architecture:** A small `golden-audit.ts` module owns versioned, atomic JSON output. `golden.ts` records one entry after each case while preserving its existing judging and exit behavior. Manifest indices are seeded from the first paid run, then accepted only after inspecting the audited transcription.

**Tech Stack:** TypeScript, Node.js filesystem APIs, Zod-backed project types, Vitest, npm workspaces.

## Global Constraints

- Run only the ten `source=fermat` cases during paid validation.
- Never persist base64 image data, API keys, authorization headers, or environment values.
- Do not change prompts, models, retry/timeout policy, images, tags, or provenance.
- Treat a changed index for the same erroneous text as evidence against fixed numeric expectations; do not chase it with another blind update.

---

### Task 1: Add opt-in atomic audit capture

**Files:**
- Create: `server/scripts/golden-audit.ts`
- Create: `server/test/golden-audit.test.ts`
- Modify: `server/scripts/golden.ts`

**Interfaces:**
- Produces: `GoldenAuditEntry`, `appendGoldenAudit(auditPath, entries)`.
- Consumes: `GoldenCase`, `AnalyzeResponse`, and `judge()` results.

- [ ] **Step 1: Write failing audit tests**

Test that a pass entry and a pipeline-error entry are written as valid version-1 JSON, preserve returned `steps`, and do not contain `base64`, `apiKey`, or `Authorization`. Test that the requested file does not exist before the first append and that a second append yields two ordered entries.

- [ ] **Step 2: Verify RED**

Run: `npm test -w server -- golden-audit.test.ts`

Expected: FAIL because `../scripts/golden-audit.js` does not exist.

- [ ] **Step 3: Implement the audit writer**

Define a discriminated entry with common `file`, optional `sourceId`, and `expected`; success entries include `actual` and `judgment`, while error entries include `pipelineError`. Write `{ version: 1, generatedAt, entries }` to `<auditPath>.partial`, then rename it to `auditPath`. Create only the parent directory.

- [ ] **Step 4: Integrate after each case**

Read `process.env.GOLDEN_AUDIT_PATH`. After judging or catching a pipeline exception, append the entry to an in-memory array and atomically rewrite the audit when the path is present. Keep fixture preflight and dynamic module loading order unchanged.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -w server -- golden-audit.test.ts golden-fixtures.test.ts`

Expected: both focused files pass.

- [ ] **Step 6: Commit**

Commit message: `feat(server): capture golden audit responses`

---

### Task 2: Seed and test first-run calibration

**Files:**
- Modify: `server/golden/manifest.json`
- Modify: `server/test/fermat.test.ts`

**Interfaces:**
- Consumes: first paid-run observations for seven non-timeout error cases.
- Produces: a manifest ready for one audited hypothesis-test run.

- [ ] **Step 1: Add a failing expected-index mapping test**

Assert these source-ID/index pairs: `img_438_pert_3.1: 9`, `img_401_pert_3.1: 8`, `img_415_pert_3.1: 12`, `img_559_pert_3.1: 1`, `img_601_pert_3.1: 7`, `img_468_pert_3.1: 5`, and `img_584_pert_3.2: 5`. Keep `img_414_pert_3.1: 7` because its first run timed out and produced no contrary evidence.

- [ ] **Step 2: Verify RED**

Run: `npm test -w server -- fermat.test.ts`

Expected: FAIL on the seven old indices.

- [ ] **Step 3: Update only those seven manifest indices**

Do not change tags, source IDs, outcomes, files, provenance, or the timed-out case.

- [ ] **Step 4: Verify GREEN and the full no-cost gate**

Run: `npm test`

Expected: 76 Vitest tests plus 4 Python importer tests pass after adding two audit tests.

Run: `npm run typecheck`

Expected: all three workspaces pass.

- [ ] **Step 5: Commit**

Commit message: `test(server): seed FERMAT stage indices`

---

### Task 3: Run and inspect the paid audit

**Files:**
- Runtime artifact only: `/private/tmp/snap-a-mistake-fermat-audit.json`
- Modify `server/golden/manifest.json` only if the audit proves a stable, correct different index.

- [ ] **Step 1: Run exactly the FERMAT gate with audit enabled**

Run the existing `npm run golden:fermat -w server` command with `GOLDEN_AUDIT_PATH=/private/tmp/snap-a-mistake-fermat-audit.json` and the ignored local environment loaded.

- [ ] **Step 2: Inspect every entry**

For each error case, confirm the selected step's `plain`/`latex` contains the independently audited first error, the tag matches, `verifierAgreed` is true, and the selected step verdict is `wrong`. Keep pipeline errors separate.

- [ ] **Step 3: Decide from evidence**

If indices and text are stable, retain the calibration. If indices move for the same text, stop and report that semantic anchors are required. If text is wrong, report a model-quality failure. Do not make another paid call automatically.

- [ ] **Step 4: Run final no-cost verification**

Run: `npm test`, `npm run typecheck`, `git diff --check`, and the existing manifest/provenance integrity checks.

- [ ] **Step 5: Commit any evidence-backed manifest correction**

Commit message, only if needed: `test(server): calibrate FERMAT stage indices`
