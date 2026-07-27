# Unreadable photo recovery design

**Date:** July 27, 2026  
**Status:** Approved for planning

## Goal

Make an unreadable result recoverable without trapping the student between false rejection and accidental reanalysis of the same photo.

The app will keep conservative image-to-transcript verification as the default. From an unreadable result, the student can either permanently discard the attempt and take a new photo or explicitly accept lower confidence and analyze the same photo once more.

## User experience

The unreadable-result screen will show the existing heading, retake tips, and two actions:

1. **Take a new photo** is the primary action. It deletes the current unreadable scan, all revisions belonging to that scan, its locally owned photo, and the active session. It then opens the capture screen. The discarded attempt will not appear in Previous scans or Patterns.
2. **Proceed anyway** is the secondary action. Supporting copy says, “Results may be less accurate.” It reruns the same photo with an explicit override that applies only to that request.

While either action is active, both buttons are disabled and use progress labels. If an action fails, the screen keeps the photo and offers the same action again with a clear error message.

## Analysis behavior

Normal analysis remains conservative:

- Non-math input returns `not-math`.
- A transcript with no steps returns `unreadable`.
- Low transcription confidence returns `unreadable`.
- A failed image-to-transcript fidelity check returns `unreadable`.

“Proceed anyway” sends an `allowUncertainTranscript` flag with the multipart analysis request. For that request only:

- `isMath: false` still returns `not-math`.
- Zero transcribed steps still returns `unreadable`, because there is nothing to diagnose.
- Low self-reported legibility and a failed fidelity check do not stop the pipeline when at least one step exists.
- The diagnosis pass and independent diagnosis verifier still run normally.

The server remains stateless. The override is not stored as a preference and does not weaken later scans.

## App and server boundaries

- The app API client accepts an optional per-request analysis mode and serializes the override as one validated multipart field.
- The Fastify `/analyze` route accepts only the photo plus the optional exact override field. Unknown, duplicate, malformed, or truncated fields return a client error.
- The analysis pipeline receives explicit options rather than reading global state.
- The unreadable screen owns the retry interaction and progress/error state.
- A focused scan-discard transition coordinates repository deletion, active-session clearing, owned-photo cleanup, and navigation.

## Persistence and deletion

Unreadable results are initially saved exactly as they are today so app restoration remains reliable.

When “Take a new photo” succeeds:

1. Delete the scan transactionally. Any follow-up descendants are deleted by the repository’s existing cascade behavior.
2. Clear the persisted active session as part of the repository transaction.
3. Clear the matching in-memory session.
4. Flush the committed owned-photo cleanup queue.
5. Navigate to capture.

If cleanup of the physical image file fails after the database transaction commits, the existing cleanup queue retains the deletion for the next launch. The deleted scan is not restored to the UI.

When “Proceed anyway” succeeds, the new result is saved as a retry revision of the same scan. The previous unreadable revision remains in that scan’s revision history, while the forced result becomes active.

## Failure handling

- If forced analysis still returns unreadable because no steps were found, remain on the unreadable screen and explain that the app could not find enough math to analyze.
- Network, timeout, server, and invalid-response failures preserve the scan and photo and use the existing recovery presentation.
- A failed scan deletion preserves the current result and shows a retryable deletion error.
- Concurrent taps are coalesced or blocked so deletion and forced reanalysis cannot run together.

## Accessibility

- Both actions have explicit button labels and disabled/busy states.
- The accuracy warning is visible text and part of the screen-reader flow.
- Completion and failure use the existing announcements and haptic gates without repeating announcements on rerender.

## Testing

Automated tests will cover:

- Default analysis still rejects low-confidence or unfaithful transcripts.
- The override continues only when math and at least one step were found.
- The override never changes subsequent default requests.
- Multipart parsing accepts the exact override and rejects malformed or unexpected fields.
- “Take a new photo” deletes the scan/session and queues or removes its photo.
- Failed deletion keeps the current result recoverable.
- Forced analysis persists a retry revision and renders the resulting analysis.
- A second unreadable result remains recoverable and does not loop automatically.
- Presentation copy, action priority, busy states, and accessibility labels.

Final verification includes the full test suite, workspace typechecking, Expo lint, an iOS export, and physical-phone checks for both actions.
