# Task 10 report — complete the follow-up learning loop

## Delivered

- Added a shared-schema client for `POST /follow-up`, with the existing typed API failures, cancellation behaviour, 180-second timeout, and cleanup path.
- Added pure follow-up practice state: progressive hints, a bounded five-problem alternate context, and rejection of repeated or wrong-concept replacements.
- Rebuilt the follow-up route with an explicit Back action, progressive hint, alternate-problem retry, independent alternate/check locks, and cancellation when leaving the screen.
- Added a 44-point Current problem camera control that expands above the shutter and announces the problem only from the student’s expansion action.
- Preserved the parent relationship from follow-up camera capture through review and analysis, then update the parent atomically during child save/correction/exclusion. Correct or changed-misconception child work resolves the parent; unreadable, non-math, retained misconception, and excluded work leave it unresolved.
- Removed the legacy session wrappers and renamed the unrelated Review state setter so the required `rg` check shows only the persisted `startFollowUp(parentScanId, followUp)` contract.
- Follow-up photo replacement now uses an explicit review-state transition that retains its existing parent only for a persisted linked review. Ordinary review replacements remain unlinked.
- Check my work now owns a fence token through one atomic follow-up handoff. Back waits for an invalidated operation to settle, and stale/unmounted work cannot navigate or mutate the active session or parent status.
- Replaced the follow-up session’s write-then-compensate path with a repository-owned exclusive SQLite transaction that validates the parent and session, writes the parent `in-progress` status and active session together, and rechecks ownership before, between, and after those writes so invalidation rolls back both.
- Back is now a single coalesced leave operation with a busy/disabled accessible control; a persistence failure leaves the screen in place and offers a Back retry.
- Unmount cleanup now consumes a rejected fence-invalidation promise after invalidating, so the stale continuation is still prevented without producing an unhandled rejection.

## Verification

- Focused app tests: 47 tests across follow-up, session, and scan repository files.
- Full app suite: 206 tests passed.
- Workspace suite: shared 18, server 105 plus 4 Python importer tests, app 206 passed.
- App and workspace TypeScript typechecks passed.
- `git diff --check` passed.

## Self-review

- The alternate response never replaces the shown problem until shared-schema validation and distinctness checks succeed.
- Parent-status writes are in the same exclusive transaction as child revision writes and skip a no-op replay.
- Existing analysis/correction ownership fences are preserved; child scan retries continue to use their stable scan ID.
- Follow-up replacement and check-work race regressions use controlled-await tests at both durable-operation boundaries.
- Controlled fake-DB tests prove the atomic follow-up handoff does not write before a rejected/queued ownership check, rolls back parent status and session if Back occurs between writes or after `app_state` before commit, and leaves both unchanged on database failure for retry.

## Concerns

- The existing project does not have a React Native component rendering test harness, so the visible Back control and Current problem card are typechecked and covered indirectly by the pure state/session contracts rather than mounted UI tests.
