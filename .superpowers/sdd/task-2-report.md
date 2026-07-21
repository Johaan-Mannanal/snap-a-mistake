# Task 2 report — FERMAT anchors and audit replay

## Scope

- Replaced only the eight FERMAT manifest error indices with the approved semantic anchors.
- Enforced source-specific error locators: FERMAT requires an anchor; synthetic cases require a numeric index.
- Added the compact, sanitized run-2 replay fixture and its no-cost regression suite.
- Preserved FERMAT files, source IDs, tags, order, images, and provenance's manually audited visible indices.

## RED → GREEN

1. fermat.test.ts was changed first and failed because all eight FERMAT errors still used errorStepIndex.
2. judge.test.ts was changed first and failed because the transitional schema still accepted FERMAT numeric locators and synthetic anchors.
3. fermat-audit-replay.test.ts was created before its fixture and failed with the expected missing-fixture error.
4. After the manifest/schema migration and fixture creation, the focused suites passed.

## Replay fixture

server/test/fixtures/fermat-audit-run2-selected.json contains exactly eight records, one per FERMAT error case, with only:

- sourceId
- actualIndex
- latex
- plain
- actualTag
- verifierAgreed
- verdict

The records were field-for-field compared with the selected steps in /private/tmp/snap-a-mistake-fermat-audit-run2.json. No explanations, follow-ups, prompts, images, headers, keys, or environment data were copied.

## Verification

- Focused: npm run test:vitest -w server -- fermat.test.ts fermat-audit-replay.test.ts
- Schema: npm run test:vitest -w server -- judge.test.ts
- Full: npm test — 9 shared, 67 server Vitest, 4 server importer, and 20 app tests passed.
- Type check: npm run typecheck
- Integrity: git diff --check, JSON parsing, fixture-field whitelist, source-specific manifest locator scans, and fixture forbidden-term scan all passed.

No golden, paid, or networked calls were run.

## Concerns

None. The img_559_pert_3.1 audit response intentionally remains a negative replay case: its selected runtime step does not match the canonical manifest anchor, so both anchor matching and judge() reject it.

## Review follow-up — audit locator preservation

The review found that golden.ts omitted errorStepAnchor when it constructed future audit entries. The runner now delegates both response and pipeline-error construction to buildGoldenAuditEntry(), which preserves errorStepAnchor alongside the existing index and tag fields. The audit serializer continues to sanitize all output.

RED: golden-audit.test.ts failed because buildGoldenAuditEntry did not exist.

GREEN: the no-cost unit test now constructs both FERMAT response and pipeline-error entries through the same helper used by the runner, writes them through the sanitizer, and confirms each emitted audit record retains the semantic anchor.
