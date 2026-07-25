# Complete UX Improvements Design

**Date:** July 24, 2026  
**Status:** Approved in conversation; awaiting written-spec review  
**Product:** Snap-a-Mistake mobile app and analysis server

## Purpose

Snap-a-Mistake already has a focused photo-first workflow and an established premium black-and-white visual system. This design improves the experience without changing that identity. The work concentrates on five user needs:

1. Control over which photograph is analyzed.
2. Honest feedback while analysis is running.
3. Confidence that the diagnosed first break is correct.
4. Continuity from diagnosis to follow-up practice.
5. Useful, private access to learning patterns and previous scans.

The work will be delivered as independently testable vertical slices. The app must remain usable after each slice, and a slice must pass its automated and on-device checks before the next begins.

## Product principles

- Keep the premium black-and-white visual direction. Use red and green only for semantic status and blue only for rare interaction emphasis.
- Keep the server stateless. It may process a submitted image and return a result, but it must not retain the image, analysis, or student history.
- Retain scans locally on the phone until the student deletes them.
- Never discard a usable photo merely because an analysis request was cancelled or failed.
- Do not present simulated timers as real backend progress.
- Treat the model's diagnosis as useful but correctable, not unquestionable.
- Prefer focused disclosure over adding a general-purpose tutor chat.
- Maintain a minimum 44-point touch target for interactive controls.

## End-to-end journey

### 1. Capture and review

The camera remains the home screen. It has one Insights entry, a gallery entry, the shutter, responsive framing guides, and the instruction to keep one problem inside the frame.

Taking a photo or choosing one from the library opens a review screen instead of immediately starting analysis. The review screen shows the entire image without cropping and supports pinch-to-zoom. It provides:

- **Analyze**
- **Retake** for camera captures
- **Choose another** for gallery selections and as a secondary option for camera captures

The first review shows a compact privacy disclosure:

> Your photo is sent to the AI service for analysis. The project server does not retain it. Completed scans are saved only on this phone until you delete them.

The disclosure is recorded locally after acknowledgement and remains available from Insights.

The shutter produces a subtle haptic. Gallery cancellation returns to the camera without an error. A gallery or camera failure produces a recoverable, specific message.

### 2. Analysis

The analysis screen shows the full photo under a dark scrim. It presents one honest active process rather than marking timed stages complete. Descriptive text may rotate among statements such as:

- Reading the handwriting
- Checking each step
- Verifying the diagnosis

These descriptions indicate the kind of work being performed; they do not claim that the server emitted a progress event. The screen also shows:

- Elapsed time
- A longer-wait message after a defined threshold
- **Cancel analysis**

Cancellation aborts the request and returns to photo review with the image intact. Meaningful state changes are announced to VoiceOver, and completion produces a subtle haptic.

Failures are classified into:

- Offline or unreachable service
- Request timeout
- Server failure
- Invalid server response
- Unreadable photograph
- Photograph that is not math

Every recoverable failure preserves the reviewed photo. Actions use the relevant combination of **Try again**, **Retake**, and **Choose another**. Error copy must not imply that a timeout is definitely a local connectivity problem.

### 3. Focused result

The initial result view focuses on the diagnosis instead of forcing the student through every transcribed step. It contains:

- The full photograph with pinch-to-zoom
- The highlighted error or suspect band
- Diagnosis label, headline, and explanation
- The immediately preceding step, diagnosed step, and immediate downstream consequence when those steps exist
- **Show all steps**

Expanding all steps reveals the complete timeline. Correct and downstream steps may be collapsed individually. Selecting a timeline step highlights its band on the photo. Selecting an overlay band moves to that step's explanation. Overlay-to-step linking applies only when a step has usable location data.

The current readable-math presentation remains the fallback for student-facing notation. Unsupported source markup must never be exposed as raw LaTeX control sequences.

### 4. Diagnosis feedback and correction

Every error diagnosis asks:

> Is this the right first break?

The choices are:

- **Yes**
- **Not quite**

**Yes** marks the active result as accepted.

**Not quite** opens a correction sheet containing:

- The extracted steps
- **All steps are correct**
- **The relevant step wasn't captured**

Selecting a different extracted step sends the photo, extracted work, original diagnosis, and selected step to a stateless correction endpoint. The endpoint returns a revised diagnosis, explanation, verdict mapping, misconception tag, and follow-up. The revised response must pass a shared schema before it replaces the active result.

The original result is marked rejected and retained inside the scan's local revision history. It does not contribute to Patterns. The revised result becomes active and contributes to Patterns unless it is later rejected.

Selecting **All steps are correct** creates a locally corrected active result with no misconception and no follow-up. Selecting **The relevant step wasn't captured** preserves the scan but excludes it from Patterns and offers a new analysis using another photograph.

An unreviewed active result contributes to Patterns. Explicit rejection removes only that revision from trend calculations.

### 5. Follow-up practice

An error result may offer a similar practice problem for the diagnosed concept. The follow-up screen includes:

- Concept label
- Similar problem
- One progressive hint, initially hidden
- **Try another similar problem**
- **Check my work**
- A visible back action

Requesting another problem uses a stateless server request and replaces only the active follow-up problem after schema validation. It does not create a scan record until the student submits work.

Tapping **Check my work** returns to the camera in follow-up mode. A collapsible **Current problem** card keeps the problem and hint accessible while the student prepares and photographs the solution.

The resulting scan records a parent scan ID and follow-up relationship. If the follow-up no longer contains the original misconception, it is recorded as resolved. Otherwise it remains unresolved with the new active diagnosis. This relationship powers positive progress in Patterns.

## Local persistence

### Durable images

Camera and image-picker URIs may refer to temporary storage. Once the student taps **Analyze**, the app copies the reviewed image into an app-owned document directory using a generated scan ID. The app analyzes that durable copy.

Deleting a scan removes its database records and owned image. Clearing all history removes all scan-owned images and records. Cleanup must not delete unrelated files or an image still referenced by another record.

### Scan records

Each complete or recoverable analysis becomes a local `ScanRecord` with:

- Stable scan ID
- Creation and update timestamps
- Durable local image URI
- Origin: camera or library
- Attempt kind: original or follow-up
- Optional parent scan ID
- Current lifecycle status
- Active analysis revision
- Previous analysis revisions
- Feedback state: unreviewed, accepted, corrected, rejected, or excluded
- Analysis duration
- Active follow-up and follow-up completion state

Analysis revisions store the complete validated response, the reason for the revision, and the creation timestamp. A correction updates the existing scan instead of inserting a new attempt.

### Deduplication

Retries of the same reviewed photo update the existing scan record. They do not add a new attempt to Patterns. Deduplication is based on the stable scan ID assigned at review, not on probabilistic image matching.

Starting over from the camera creates a new scan ID, even if the student photographs the same sheet again. A linked follow-up always creates a distinct scan record because it represents a new learning attempt.

### Session recovery

The active reviewed photo, pending scan ID, active analysis, current follow-up, parent relationship, and current route intent are persisted locally. On a normal app restart, the student can resume review, inspect a completed result, or continue a follow-up.

An analysis interrupted by process termination is restored as interrupted rather than shown as still running. The student can retry it from review.

### Existing-history migration

The existing `analyses` table contains only misconception tag, correctness, and timestamp. Migration preserves those rows as legacy aggregate records:

- They continue to contribute to Patterns.
- They cannot appear as complete Previous scans because their photograph and full response were never retained.
- Clearing all history removes both legacy aggregate rows and full scan records.

Migration is transactional and idempotent.

## Insights

Insights contains two sections within one destination.

### Patterns

Each misconception may show:

- Human-readable label
- Attempts this week
- Comparison with the previous seven-day period
- Follow-up resolution count
- A positive progress message when follow-up work resolves the misconception

The trend state remains neutral as **Not enough data yet** until the current and comparison periods contain enough distinct attempts to justify a directional label. The exact minimum is a product constant covered by unit tests; the initial value is two distinct relevant attempts across the compared periods.

Only the active non-rejected revision of a distinct attempt contributes. Results marked excluded do not contribute. Correct original work may contribute to an overall successful-scan count but not to a misconception row.

### Previous scans

Previous scans are shown newest first. Each row contains:

- Thumbnail
- Date and time
- Correct, needs attention, corrected, interrupted, or excluded status
- Misconception label when applicable
- Follow-up completion state

Opening a row restores the photograph, active result, full steps, overlay, explanation, revision state, and follow-up. The scan detail screen offers deletion with confirmation.

Insights offers **Clear all history** behind a destructive confirmation that states that photographs, analyses, follow-ups, corrections, and Patterns will be removed from the phone and cannot be recovered.

Loading, empty, database-error, and successful states are distinct. A database error must never be presented as an empty history.

### Data and privacy

Insights includes a compact Data and privacy section explaining:

- Photos are transmitted for AI analysis.
- The project server does not retain them.
- Completed scans and trends are stored locally.
- Local history remains until the student deletes it.

## Server and shared contracts

The existing `POST /analyze` endpoint remains the primary stateless analysis endpoint.

The design adds stateless operations for:

1. Revising a diagnosis after the student selects a different step.
2. Generating another similar follow-up problem.

Request and response bodies use shared Zod schemas. Correction requests include the original validated analysis and a bounded correction selection; the server does not accept arbitrary prompt text from the client. The server reuses the existing model-client timeout and structured-output protections.

Follow-up data expands to include a progressive hint. Student-facing problem, hint, diagnosis, and explanation fields must use readable plain text with polished Unicode math rather than raw LaTeX commands.

The server logs operational timing and errors but not image data, full student work, or model responses.

## Error handling and recovery

- File-copy failure leaves the source photo in review and explains that it could not be saved.
- Database-write failure does not hide an otherwise valid result. The result remains visible, is marked unsaved, and offers a retry-save action.
- Database-read failure shows a recoverable Insights error, not an empty state.
- Image deletion is coordinated with record deletion. A failed image deletion leaves a cleanup marker for a later retry without resurrecting the scan.
- Invalid correction and follow-up responses leave the prior active data unchanged.
- Request cancellation is not reported as a network failure.
- A stale or missing local image displays the saved textual analysis and a clear unavailable-photo placeholder.
- Session recovery validates persisted data before using it. Invalid persisted state is discarded safely and returns the student to the camera.

## Accessibility and responsive behavior

The work must support:

- VoiceOver reading order that follows the visual hierarchy
- Concise accessibility summaries for the overall result and each step
- Announcements for analysis start, longer wait, completion, cancellation, and failures
- Maximum supported Dynamic Type without clipping controls or core explanations
- At least 44-point touch targets
- Labels and hints for icon-only actions
- Sufficient semantic-color contrast, with status also conveyed by text and symbols
- Reduced-motion settings
- Responsive framing guides on supported iPhone sizes and orientations used by the app

Equation presentation may wrap vertically. It must not force horizontal page scrolling or reveal raw unsupported notation.

## Delivery phases

### Phase 1: Persistence foundation

Build durable image storage, full scan records, legacy migration, deduplication, session recovery, per-scan deletion, and clear-all behavior.

### Phase 2: Capture and analysis

Build photo review, zoom, privacy disclosure, honest progress, cancellation, specific errors, responsive framing, and capture/completion haptics.

### Phase 3: Result trust

Build the focused result, expandable timeline, linked overlay navigation, diagnosis feedback, correction selection, and revised AI analysis.

### Phase 4: Follow-up loop

Build the current-problem camera card, progressive hint, alternate similar problem, linked follow-up attempts, and resolution tracking.

### Phase 5: Insights and previous scans

Build the two-section Insights destination, trend evidence threshold, positive progress, scan history, scan restoration, deletion controls, privacy information, and database recovery states.

### Phase 6: Accessibility and final polish

Complete Dynamic Type, VoiceOver, announcements, touch-target, responsive-layout, reduced-motion, copy consistency, and public-documentation work.

Each phase is reviewed, tested, and committed independently.

## Verification

Automated verification includes:

- Shared request and response schema tests
- Database migration and repository tests
- Durable-file lifecycle tests
- Deduplication tests
- Trend and follow-up-resolution tests
- Session restoration and invalid-state tests
- API cancellation, timeout, server, and invalid-response tests
- Correction-pipeline tests
- Follow-up-generation tests
- Presentation-state and accessibility-label tests
- Full workspace test and typecheck gates after every phase

On-device verification includes:

- Camera capture and gallery selection
- Photo review, zoom, retake, and replacement
- Analysis cancellation and retry
- Offline, timeout, and server-failure recovery
- Long-running real analysis
- Correct, error, suspect, unreadable, and not-math results
- Step-to-overlay and overlay-to-step navigation
- Accepted and corrected diagnoses
- Similar-problem, hint, alternate-problem, and follow-up-check flows
- App restart during review, after result, and during follow-up
- Previous-scan restoration and deletion
- Clear-all history
- VoiceOver and maximum Dynamic Type
- Supported iPhone layouts

The final gate includes a real-model regression run against the golden handwriting set and a clean two-minute demo rehearsal on a physical phone.

## Non-goals

- User accounts or cloud synchronization
- Server-side photo or history retention
- Social sharing or public profiles
- General-purpose tutor chat
- Video lessons
- A second visual redesign
- Claiming backend progress events that the server does not emit
- Recovering full details for legacy aggregate records that never stored them

