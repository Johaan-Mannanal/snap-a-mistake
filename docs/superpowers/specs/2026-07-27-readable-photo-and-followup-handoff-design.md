# Readable Photo and Follow-up Handoff Design

## Goal

Fix two physical-device regressions:

1. A clear math photo can be rejected as unreadable when the transcription
   model assigns itself a low confidence score despite extracting usable
   steps.
2. The tap that opens a similar problem can carry through the navigation
   transition and immediately activate “Check my work,” opening the camera
   before the student is ready.

## Readability decision

The transcription model’s numeric legibility score is preliminary evidence,
not a final verdict when it extracted one or more steps.

- Non-math remains an absolute rejection.
- A transcript with zero steps remains unreadable.
- A transcript with one or more steps always reaches the existing independent
  transcription verifier.
- The normal strict path continues only when the verifier reports both
  `faithful` and `legible`.
- The request-scoped “Proceed anyway” override still permits diagnosis after a
  negative verifier result; it does not affect later requests.

This trades one additional verifier call only for low-confidence transcripts
that contain work. It avoids lowering the global threshold or admitting work
solely because several lines were detected.

## Follow-up navigation handoff

The follow-up screen must not rely on elapsed time alone. A long navigation
transition can outlast a fixed timer while the original finger is still down.

“Check my work” becomes eligible only for a press that begins after the
follow-up route is focused and its transition has completed:

- The route gate starts disarmed on focus and while navigation interactions
  settle.
- `onPressIn` records eligibility only when the gate is armed.
- `onPress` consumes that recorded eligibility once.
- A press that started before the screen was ready is ignored even if its
  release arrives later.
- Blur/unmount clears both route readiness and any pending press.
- Accessibility activation remains supported through the same Pressable event
  lifecycle and existing labels.

The problem, hint, and alternate-problem controls remain visible until the
student deliberately activates “Check my work.”

## Testing

- Pipeline tests prove a low-score, nonempty transcript proceeds when the
  verifier confirms it and remains unreadable when the verifier rejects it.
- Existing non-math, zero-step, strict verifier, and explicit-override tests
  remain green.
- Route-gate tests reproduce a press beginning before activation and prove its
  later release cannot start checking.
- Tests prove a fresh post-activation press works exactly once and blur clears
  pending eligibility.
- App source/integration checks preserve the problem screen and explicit
  “Check my work” action.
- Final verification includes focused tests, full tests, typechecks, lint, and
  an iOS Expo export. Physical-phone confirmation remains the final manual
  gate.
