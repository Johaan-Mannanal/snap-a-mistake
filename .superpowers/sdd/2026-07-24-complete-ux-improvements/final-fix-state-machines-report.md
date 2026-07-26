# Final review fix B report: recovery, retry, follow-up, and Review state machines

Base: `e30a70369f450d79ba0b2394077ed77d76aa2964`

## Findings verified

1. `_layout.tsx` hydrated local state but never navigated to its persisted route intent. `hydrateSession()` rewrote an interrupted `analyze` intent to `review` only in `app_state`; it did not update the matching `scans.lifecycle`.
2. `review.tsx` always allocated a new scan ID and copied the photo on Analyze. A cancelled or terminated scan restored `pendingScanId`, but Review ignored it, creating a duplicate scan and owned image.
3. `setPendingPhoto()`, `replacePendingPhoto()`, and `setReviewedPhoto()` discarded `followUp`. The Follow-up screen kept accepted alternates, hint visibility, and previous-problem history only in React state. Parent status could be `in-progress` while the only durable route still pointed elsewhere.
4. Review had a copy lock for Analyze and a separate Retake lock. Choose another owned neither lock while awaiting the native picker, so Analyze/Retake/another picker could compete with the returned selection.
5. The stricter analysis consistency checks in the base commit exposed 22 invalid app test fixtures whose `errorStepIndex` referenced no step. The production schema was retained; fixtures now include their diagnosed step.

## TDD evidence

After repairing only the invalid baseline fixtures, the existing focused baseline passed: 96/96 tests across session, repository, Review transaction, follow-up, finalization, and async-fence suites.

New integration tests were then observed RED for the intended reasons:

- Missing `analysisEntry`, one-shot hydrated intent, atomic interruption, resumed Review transaction, and Review mutation coordinator.
- `PersistedSessionSchema` rejected follow-up practice across Review/Analyze.
- The repository did not persist an accepted alternate on its parent.
- Atomic follow-up return, follow-up Retake recovery, and reopening the accepted alternate were absent.
- Cold Result entry did not distinguish a restored terminal result, allowing unmount cleanup to treat it as an active analysis.

The final focused state-machine gate passed 99/99 tests across:

- `stateMachineIntegration.test.ts`
- `session.test.ts`
- `scanTypes.test.ts`
- `scanRepository.test.ts`
- `reviewTransaction.test.ts`

## Implementation

### Cold-start recovery

- Hydration now exposes a transient route intent that `_layout.tsx` consumes once, only after Expo Router reports a ready root navigation state.
- Persisted Review, Result, and Follow-up sessions restore to `/review`, `/analyze`, and `/followup`; capture produces no redirect.
- Terminated analysis recovery uses one repository transaction to set the scan lifecycle to `interrupted` and replace `active-session` with its Review state.
- If a revision committed before the Result session write, that same recovery transaction restores Result from the active revision and preserves the completed lifecycle.
- Result entry initializes from the persisted response and does not auto-run analysis. It reloads the active durable revision for feedback availability.
- A restored Result immediately marks analysis finalization as a successful handoff, so unmount cleanup cannot interrupt the completed scan or replace its Result session.
- `setPendingPhoto()` rejects a second unsolicited capture while a recoverable photo/session exists.

### Stable retry and image ownership

- Review initializes a resumed transaction from `pendingScanId` and the already-owned image.
- Analyze verifies the existing draft, re-persists the same reviewed scan, and does not copy the image or insert another scan.
- Resumed scan history is not deleted by Choose another or Retake. A replacement clears the active Review session’s scan ID so its next Analyze creates the correct new ownership transaction.
- Analyze still derives revision reason from the existing scan, so a completed same-scan retry appends a retry revision.

### Durable follow-up practice

- Persisted sessions now include the active problem, hint visibility, and bounded prior-problem history across Follow-up, camera, Review, Analyze, cancellation, termination, and restart.
- Starting or updating practice atomically writes the accepted active problem to the parent scan, marks it `in-progress`, and writes the resumable Follow-up session.
- Reopening practice reads the parent’s active top-level follow-up, so an accepted alternate is not replaced by the original revision’s problem.
- Back atomically restores the parent Result session and returns its status to `ready`.
- Follow-up Retake returns to the camera in follow-up mode with the same parent/problem instead of clearing practice.
- Child drafts retain `attemptKind: follow-up` and `parentScanId`; result persistence continues to resolve/unresolve the parent from that linkage.

### One Review mutation boundary

- Analyze, Choose another, Retake, and cleanup retry use one synchronous exclusive coordinator.
- The coordinator remains owned across the native picker await and all file, repository, session, state, and navigation effects.
- Transaction stages re-check coordinator ownership between awaits, preventing an invalidated Review action from continuing into later draft, session, cleanup, or navigation mutations.
- Competing actions no-op while owned.
- Unmount invalidates ownership; late picker results are checked before replacement persistence and later UI/navigation effects.
- Resumed transactions are marked as existing history so replacement/retake cannot delete the prior scan or owned image.

## Race-path self-review

- Interruption: scan lifecycle and Review app state roll back together if the state write fails.
- Hydration: route intent is cleared on first read; React effect re-runs cannot reuse it.
- Cold Result: analysis auto-run is false, finalization cleanup is terminal/no-op, and active-revision lookup is fenced by mount and scan ID.
- Same-photo retry: scan ID and URI are stable; no copy/create call occurs; replacement explicitly clears the active ID.
- Follow-up entry/update: ownership compares the original session before and after parent lookup and inside the exclusive repository transaction.
- Follow-up Back: invalidates pending practice/check ownership before the atomic parent/session return.
- Follow-up Back explicitly replaces the route with Result, so a cold-restored Follow-up does not depend on an Analyze entry existing in the navigation stack.
- Review picker: one lock is acquired before the native await; invalidation prevents a late result from continuing.
- Review replacement: session replacement commits before optional cleanup; an existing resumed scan is never cleanup-eligible.

## Verification

- `npm test` — PASS
  - shared: 23/23
  - server Vitest: 114/114
  - server importer: 4/4
  - app: 278/278
- `npm run typecheck` — PASS for shared, server, and app.
- `npm run lint -w app` — PASS.
- `git diff --check` — PASS (no output).
- Paid golden gate intentionally not run, per brief.

The Vitest runs retain the repository’s pre-existing Vite CJS deprecation warning; there are no test failures or lint/type errors.
