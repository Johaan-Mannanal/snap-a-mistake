# Final review fix F report: retry lifecycle and Result-save fencing

Base: `9775e77e61e9e45ef397eaa34d603a10f7665852`

## Findings verified

1. Cancelling analysis always wrote lifecycle `interrupted` and restored Review, even when a retry scan still had a valid active revision. Cold recovery rebuilt Result in that case but left the scan lifecycle `analyzing`.
2. Analyze exposed `result` before `saveRevision()` and Result-session persistence settled. Its Snap another callback reset the session without invalidating or awaiting the analysis run, so a late session write could resurrect Result after reset.
3. Revision reason used only `activeRevision`; a scan with excluded historical revisions therefore mislabeled its next analysis `initial`.
4. A failed local `setFeedback(..., 'accepted')` write was presented as a tutor/network failure.

## TDD evidence

New tests were observed RED for the intended reasons:

- Retry cancellation/cold recovery left lifecycle `analyzing` or `interrupted` instead of restoring the valid active Result as `complete`.
- The production persistence/reset orchestration module was absent, so a controlled actual repository/session write could not be fenced and awaited before reset.
- Excluded history was not considered by revision-reason selection.
- Storage feedback failure fell through to incomplete-response/network-oriented copy.

The final focused lifecycle gate passed 98/98 tests across:

- `scanRepository.test.ts`
- `session.test.ts`
- `analysisAsync.test.ts`
- `analysisFinalization.test.ts`
- `diagnosisFeedback.test.ts`
- `DiagnosisFeedback.test.ts`

## Implementation

### Retry cancellation and cold recovery

- Interrupted-analysis recovery now atomically writes lifecycle `complete` and a canonical Result session whenever an active revision exists.
- With no active revision, the same transaction writes lifecycle `interrupted` and Review session state.
- The live cancel path uses the same session/repository recovery operation as cold hydration, preserving the last valid revision for Previous scans and Patterns.
- Tests cover live retry cancellation, live initial cancellation, original cold retry recovery, and follow-up-child recovery.

### Result persistence and Snap another

- The Result view is no longer exposed while revision and Result-session persistence are still pending.
- Production `persistAnalysisRun()` fences each persistence boundary and verifies that the saved revision is active.
- Production `beginAnalysisReset()` synchronously invalidates the analysis run, aborts its request, marks the transition terminal, invalidates corrections, awaits all active work, and only then resets/navigates.
- A controlled integration test uses the actual repository, session module, run fence, and a deferred `active-session` database write. It proves reset waits for the late write and removes it, leaving capture state with no resurrected Result.

### Audit reason and feedback copy

- Revision reason is `retry` whenever revision history is non-empty, including after exclusion clears `activeRevision`; history and feedback remain unchanged.
- Local acceptance persistence failures now use storage-specific copy: “We couldn’t save your feedback,” with an accessible “Retry saving” action.

## Race-path self-review

- Cancellation invalidates the run before recovery; finalization waits for tracked persistence before atomically selecting Result/complete or Review/interrupted.
- Snap another invalidates synchronously even if invoked programmatically while Result controls are stale.
- If Result-session persistence has already begun, reset awaits it and deletes the resulting state afterward.
- Stale persistence cannot update Result UI because every boundary checks run ownership.
- Successful persistence sets Result only after the durable session write returns.

## Verification

- `npm test` — PASS: 467 automated tests
  - shared Vitest: 36/36
  - server Vitest: 116/116
  - server importer: 4/4
  - app Vitest: 311/311
- `npm run typecheck` — PASS for shared, server, and app.
- `npm run lint -w app` — PASS.
- `git diff --check` — PASS.
- Paid golden gate not run; physical-phone checks and demo rehearsal remain pending.
