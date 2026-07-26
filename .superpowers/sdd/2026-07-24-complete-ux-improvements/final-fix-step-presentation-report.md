# Final review fix G report: step identity, optional bands, and zoom decoration

Base: `7f7ca1f`

## Findings verified

1. Focused-result neighbors were selected after sorting `step.index`, so sparse non-monotonic identities changed the intended response order.
2. The result headline, timeline cards, photo-overlay labels, correction options, and VoiceOver copy derived human step numbers from `step.index + 1`.
3. Shared transcription and analysis schemas required both photo-band endpoints, rejecting otherwise valid responses when a line could not be located reliably.
4. The photo overlay lived inside the animated zoom wrapper without inverse decoration metrics, so its borders and label typography grew with the image.
5. Server model prompts called opaque numeric identities “Step N,” which could invite ordinal interpretation at analysis, correction, and verification boundaries.

## TDD evidence

New tests were observed RED for the intended reasons:

- `[41, 7, 103, 2]` with diagnosis ID `7` focused `[2, 7, 41]` instead of response-order neighbors `[41, 7, 103]`.
- Result, feedback, overlay, card, and accessibility copy announced identity-derived numbers such as Step 8 or Step 42 instead of response ordinals.
- Shared, API, persisted-record, and server pipeline tests rejected steps with both band endpoints absent.
- Zoom probes had no production transform/decoration helpers and could not prove fixed visual metrics.
- Server prompts rendered sparse values as ordinal-looking `Step 41`/`Step 7` labels.

Focused green gates covered result focus, presentation/accessibility, diagnosis feedback, overlay geometry and decoration scaling, zoom transforms, API validation, persisted scan validation, shared schemas, server analysis/correction/verifier prompts, and deterministic fixtures.

## Implementation

- `step.index` remains the identity used for selection, expansion state, correction requests, keys, persistence, and verdict mapping.
- Response array order now drives focused neighbors and every human/VoiceOver step ordinal.
- Model-facing boundaries explicitly use `Step ID`, while stage-one array order is defined as top-to-bottom independently of identity.
- Both band endpoints are optional as a pair. Completely absent bands are preserved; half-present, out-of-range, non-numeric, zero-height, and inverted bands remain invalid.
- Unlocated steps remain in the timeline and correction sheet but produce no fake photo band.
- Photo content and band geometry share the production Reanimated pan/zoom transform.
- Animated inverse metrics counter-scale border widths, font size, line height, padding, and label inset so decoration remains visually fixed from 1× through 4× zoom.

## Verification

- `npm test` — PASS for shared, server Vitest/importer, and app workspaces.
- `npm run typecheck` — PASS for shared, server, and app.
- `npm run lint -w app` — PASS with no warnings.
- `git diff --check` — PASS.
- Paid golden tests were intentionally not run.
- Public test-count documentation was intentionally not changed.

## Independent review

- Independent read-only review found no Critical issues.
- Its Important zero-height-band finding was reproduced with RED shared/app tests, fixed with strict `top < bottom` validation, and included in the final full gates.
- Its production-wiring test gap and prompt/schema wording minor findings were also addressed.
