# Final review fix C report — deletion safety and historical truth

Base: `b3956915736c430895ae14bdb95e8a1b26763f13`

## Findings verified

1. Per-scan deletion queued every URI before deleting the scan subtree and did not check for references outside that subtree. Shared URIs could therefore be physically deleted while a surviving scan still referenced them.
2. Per-scan deletion used a non-idempotent cleanup-queue insert. Duplicate URIs in one cascade, or an already queued URI, could roll back the database deletion.
3. Clear-all returned duplicate URIs when multiple records referenced one owned image. The file flusher also trusted duplicate queue reads.
4. Physical cleanup trusted the queue snapshot and never re-checked live scan references. A URI re-referenced after queueing could be deleted.
5. Historical detail loaded the complete `ScanRecord` but rendered only the photo, active revision, and timeline; saved follow-up problem, concept, hint, and status were omitted.
6. Scan-list feedback used durable scan-level feedback, while historical active-revision detail used revision-level feedback. Accepted or rejected scans therefore appeared inconsistent after reload.
7. The approved diagnosis prompt, “Is this the right first break?”, had been replaced by different copy.

## TDD evidence

The focused red run failed for the intended reasons:

- Shared individual deletion still queued the referenced image.
- Clear-all returned the same shared URI twice.
- The repository had no defensive cleanup transaction for a re-referenced URI.
- Duplicate cleanup rows were settled more than once.
- Physical cleanup had not converted its exclusive transaction into a write transaction before the live-reference check, leaving a write race before deletion.
- Historical follow-up presentation did not exist.
- Accepted/rejected detail ignored scan-level feedback.
- The approved prompt constant did not exist.

The focused green gate passed 79/79 tests across:

- `scanRepository.test.ts`
- `scanFiles.test.ts`
- `scanDetail.test.ts`
- `diagnosisFeedback.test.ts`

## Implementation

### Shared-image deletion safety

- Scan deletion now removes the selected cascade inside an exclusive transaction, checks each distinct candidate URI against the surviving `scans` table, and queues only unreferenced URIs.
- Review discard applies the same surviving-reference rule, including orphaned owned-photo cleanup after a draft creation failure.
- Clear-all deduplicates owned URIs and queues each image once after every scan row is removed.
- Cleanup inserts are idempotent, so an existing cleanup obligation cannot roll back a committed scan deletion.

### Defensive physical cleanup

- Queue flushing deduplicates queue snapshots.
- Each queued URI is settled through one exclusive repository transaction that:
  1. acquires the cleanup write lock before the reference check;
  2. re-checks the live `scans` table;
  3. retains the file and clears the stale marker when the URI is referenced again; or
  4. physically deletes the unreferenced owned file and acknowledges the marker.
- Holding the reference check, file deletion, and acknowledgement under the same write boundary prevents a scan reference from committing between the check and deletion.
- A file failure rolls the transaction back and retains the marker. If physical deletion succeeds but a later database step fails, the retained marker retries idempotently against the now-missing file.

### Historical truth and feedback

- Saved scan detail now renders a static premium black-and-white follow-up card containing the persisted concept, problem, hint, and current status.
- The card has a complete accessibility label and explicitly says “Saved practice history · read only”; it has no resumable action.
- Active revision detail now treats scan-level feedback as the durable source for accepted/rejected state, matching the scan list after reload while retaining revision-level state for correction audit history.
- The approved prompt and choices are restored to “Is this the right first break?”, “Yes”, and “Not quite”.

## Transaction and cascade self-review

- Individual shared URI: deleting a non-final reference does not queue the image.
- Final shared URI: deleting the final reference queues one cleanup obligation.
- Cascades: descendant IDs are captured before the foreign-key cascade, then distinct subtree URIs are checked against survivors after deletion.
- Clear-all: existing queue obligations survive; newly orphaned URIs are added once; duplicate scan references yield one physical deletion.
- Re-reference race: cleanup re-checks within an exclusive transaction and never calls the file deletion callback for a live URI.
- Concurrent/retried flushes: queue snapshots are deduplicated; owned-file deletion is idempotent; a stale marker is harmless.
- Rollback: scan deletion and queueing remain atomic; file failure leaves the queue marker; post-file database failure leaves an idempotent retry.
- Follow-up cascades: existing parent-status recomputation and active-session clearing still run inside the same deletion transaction after the subtree is removed.

## Verification

- Focused app gate: 79/79 tests passed.
- Full workspace tests:
  - shared: 23/23
  - server Vitest: 114/114
  - server importer: 4/4
  - app: 294/294
- `npm run typecheck` — passed for shared, server, and app.
- `npm run lint -w app` — passed.
- `git diff --check` — passed.
- The paid golden gate was intentionally not run, per brief.

The app test run retains the repository’s pre-existing Vite CJS deprecation warning; there are no test, lint, or type failures.
