# Final re-review fix D report: verdict and diagnosis consistency

Base: `bd38cfcdeb312236ea70baeacbfe6acbaba07401`

## Finding verified

`AnalysisResultSchema` validated diagnosis-field presence, unique step indexes, and diagnosed-step membership, but it did not validate any relationship between `errorStepIndex`, `verifierAgreed`, and step verdicts. A response could therefore parse while claiming all-correct work with a `wrong` step, placing `wrong` or `suspect` on unrelated steps, or disagreeing with the verifier at the diagnosed step.

The server and deterministic correction mappers also compared numeric index values. Unique step indexes are identifiers, not guaranteed sequence numbers, so valid sparse/non-monotonic indexes could receive verdicts in the wrong progression.

## TDD evidence

Before production changes:

- The shared parser suite failed 12 new contradictory cases because every contradiction parsed successfully. The 24 existing and new valid cases passed.
- The server pipeline probe for array indexes `[5, 2, 9]` diagnosed at index `2` failed with `downstream/wrong/downstream`; the required array-order result was `ok/wrong/downstream`.
- The deterministic correction mock failed the same sparse-index probe.

After the implementation:

- The shared schema suite passes 36/36, including all-correct, agreed, disputed, sparse/non-monotonic, and Unicode-math cases.
- Focused server pipeline, correction, mock, and route suites pass 42/42.
- Focused app fixture and persistence suites pass 142/142.

## Implementation

- `AnalysisResultSchema` locates the diagnosed step by its unique index, then validates verdict progression by array position:
  - all-correct: every step is `ok`;
  - before diagnosis: `ok`;
  - diagnosed step: `wrong` when verified, `suspect` when disputed;
  - after diagnosis: `downstream`.
- A missing diagnosed index still reports the existing membership error and does not manufacture a progression.
- `withVerdicts` now uses the same array-order rule, preserving sparse and non-monotonic identifiers.
- The deterministic correction server reuses `withVerdicts` instead of maintaining a second index-comparison implementation.
- Pipeline and correction tests parse their outputs through `AnalysisResultSchema`; mock tests parse correction output through `AnalyzeResponseSchema`.

## Fixture audit

The stricter contract exposed seven response fixtures that were meant to be valid but told structurally contradictory stories:

- one correction input left post-diagnosis steps `ok`;
- one route correction fake changed the diagnosis without remapping verdicts;
- two persisted app scan fixtures diagnosed an absent step;
- one agreed and one disputed presentation fixture diagnosed an absent step;
- one all-correct feedback fixture retained the prior `wrong` verdict.

Only those fixtures were corrected to match their stated diagnosis. Intentional malformed judge/replay inputs remain unchanged because those tests exercise defense-in-depth rejection paths rather than valid server or persisted responses.

## Verification

- `npm test` — PASS
  - shared: 36/36
  - server Vitest: 116/116
  - server importer: 4/4
  - app: 297/297
- `npm run typecheck` — PASS for shared, server, and app.
- `npm run lint -w app` — PASS.
- `git diff --check` — PASS.
- Paid golden gate intentionally not run, per brief.

The app test run retains the repository's pre-existing Vite CJS deprecation warning; there are no test, typecheck, or lint failures.
