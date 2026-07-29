# Low-Sensitivity Unreadable Gate Design

## Goal

Make the “This photo is too hard to read” result rare. Ordinary blur, faint writing, or one uncertain symbol should continue into analysis when the transcription still contains visible math steps. The unreadable result should remain only for images that are overwhelmingly unusable.

## Root cause

The transcription verifier is deliberately conservative: it marks `faithful` or `legible` false whenever a symbol is ambiguous. The pipeline currently returns `unreadable` when either boolean is false, regardless of the first transcription pass’s numeric legibility score. A minor verifier doubt therefore behaves like a blank or catastrophically blurred image.

## Decision

Keep the existing absolute safeguards:

- `isMath: false` returns `not-math`.
- A transcript with zero steps returns `unreadable`, even when **Proceed anyway** was requested.

For a nonempty math transcript, return `unreadable` only when all three conditions are true:

1. Stage-one legibility is at or below `0.15`.
2. The independent verifier reports `faithful: false`.
3. The independent verifier reports `legible: false`.

Any nonempty transcript outside that combined condition continues automatically into diagnosis. The existing request-scoped `allowUncertainTranscript` option still bypasses this rare rejection when the student taps **Proceed anyway**.

The `0.15` cutoff is intentionally much lower than the model prompt’s `0.4` “unusable” guidance. This implements the product decision that the retake screen should appear only for exceptionally poor images, while the independent diagnosis verifier still softens uncertain mathematical conclusions later in the pipeline.

## Alternatives considered

### Reject whenever both verifier booleans are false

This is simpler than the selected rule, but the conservative verifier may set both false for an otherwise usable, slightly blurred image. It would remain more sensitive than requested.

### Never reject a nonempty transcript

This guarantees the fewest interruptions, but it allows analysis when a severely blurred image caused the model to invent plausible-looking steps. The selected rule retains a narrow safeguard for that case.

### Change only the verifier prompt

Prompt changes are less deterministic and harder to protect with unit tests. The selected pipeline rule makes the intended product behavior explicit and testable.

## Testing

Update `server/test/run.test.ts` before production code:

- A nonempty transcript with legibility `0.30` continues even when the verifier reports both booleans false.
- A nonempty transcript with legibility `0.15` remains unreadable when the verifier reports both booleans false, and diagnosis is not called.
- At the boundary, legibility just above `0.15` continues.
- A severely low-confidence transcript continues if either verifier boolean is true, because the evidence is not unanimously catastrophic.
- Zero-step and non-math behavior remains unchanged.
- **Proceed anyway** still bypasses the rare combined rejection.

After the focused red/green cycle, run all server tests, the complete repository test suite, typecheck, lint, and whitespace checks before merging and pushing.

## Scope

Change the pipeline decision and its focused tests. Reconcile only the factual sentences in `README.md`, `docs/submission/DEVPOST.md`, `docs/submission/PROMETHEUS-ABOUT.md`, and `docs/validation/2026-07-22-prometheus-readiness.md` that describe when the retake screen appears. Do not otherwise rewrite submission messaging, and do not alter the app UI, verifier prompt, response schemas, model configuration, unrelated thresholds, or demo artifacts.
