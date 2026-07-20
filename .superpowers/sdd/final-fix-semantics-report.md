# Final semantics remediation report

## Status

Complete. Important findings 1 and 3 and Minor finding 2 from the final review are remediated without changing the API response shape, manifest contents, or source filtering. No golden command or paid OpenAI API call was run.

## Red

- `npm test -w server -- --run test/stage2.test.ts test/judge.test.ts` exited 1 with seven expected regression failures.
- The prompt test failed because the Stage 2 prompt named `notation-error` and `formula-misapplied` without defining their semantic boundaries.
- Four schema tests failed because synthetic `sourceId` and error-only fields on `correct`, `unreadable`, and `not-math` cases were accepted.
- Two judge tests failed because verifier disagreement and a `suspect` verdict still passed an expected-error case.

## Green

- The Stage 2 prompt now renders a concise, exhaustive definition for every controlled tag from a typed `Record<MisconceptionTag, string>`.
- The prompt explicitly distinguishes harmless notation quirks from meaning-changing `notation-error`, and formula selection/orientation/substitution errors from routine downstream `algebraic-slip` mistakes.
- Expected-error judging now requires matching index and tag, `verifierAgreed === true`, and a returned step with that index whose verdict is `wrong`.
- `GoldenCaseSchema` requires `sourceId` for FERMAT cases, forbids it for synthetic cases, requires index/tag for error outcomes, and forbids index/tag for every non-error outcome.
- The focused command passed 2 files / 16 tests after implementation.

## Results

- `npm test`: 14 files / 67 tests passed — shared 9, server 38, app 20.
- `npm run typecheck`: shared, server, and app typechecks exited 0.
- `server/test/fermat.test.ts` passed as part of the full suite, proving all current manifest entries still parse and remain aligned with provenance.
- Existing `selectCases` coverage passed, preserving source filtering.
- `git diff --check` exited 0.

## Commit

- `fix(server): tighten golden semantics` (this report is included in the same commit).

## Concerns

- No response-shape incompatibility was found: `AnalyzeResponse` already exposes `verifierAgreed` and per-step verdicts, so the stricter judge uses existing fields.
- The paid FERMAT and combined golden results remain intentionally unknown.
- App Vitest still emits its pre-existing Vite CJS deprecation warning; all app tests pass.
