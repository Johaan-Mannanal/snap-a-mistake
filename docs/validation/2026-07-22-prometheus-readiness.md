# Prometheus readiness and final verification record — July 28, 2026

This record separates repository-reproducible evidence from paid, device, and rehearsal work that still needs a human operator. It does not contain API keys, private photos, raw provider responses, device identifiers, or recording artifacts.

## Automated evidence recorded on this branch

The following commands completed on July 28, 2026:

```bash
npm test
npm run typecheck
npm run lint -w app
(cd app && npx expo export --platform ios --output-dir /tmp/snap-a-mistake-prometheus-final)
git diff --check
```

- `npm test`: **571 tests passed** — 42 shared Vitest, 146 server Vitest, 4 stock-Python importer tests, and 379 app Vitest tests.
- `npm run typecheck`: shared, server, and app each completed `tsc --noEmit`.
- `npm run lint -w app`: Expo lint completed with zero warnings and zero errors.
- `(cd app && npx expo export --platform ios --output-dir /tmp/snap-a-mistake-prometheus-final)`: completed successfully.
- `git diff --check`: completed successfully with no whitespace errors.
- The app’s lint setup uses SDK 57-compatible `eslint` and `eslint-config-expo`. Its only targeted configuration exceptions are for React Native object-ref forwarding and Reanimated shared-value mutation; ordinary Expo lint rules remain enabled.

The final repository-readiness audit also confirmed that every required tracked submission asset resolves, including the MIT license, FERMAT attribution and provenance, and the three README screenshots at 1206×2622. All local Markdown links in the README, submission documents, and this record resolved. The tracked-tree credential scan returned no matches (exit 1 as expected), and `git ls-files server/.env .env` returned no tracked credential files.

The committed golden manifest still contains 25 inspectable cases: 15 synthetic cases and 10 CC BY 4.0 FERMAT handwriting photographs (2 correct and 8 intentional-error cases). Attribution and provenance are in [FERMAT-ATTRIBUTION.md](../../server/golden/FERMAT-ATTRIBUTION.md) and [fermat-provenance.json](../../server/golden/fermat-provenance.json).

## Focused live-model regression

Two paid, single-case checks completed on July 27, 2026 after adding the image-to-transcript fidelity gate:

- A deliberately blurred copy of `parts-error.jpg` returned `unreadable`.
- The clear `parts-error.jpg` control returned an analysis with step 1 marked wrong and the `integration-by-parts-error` tag. Its transcript preserved the incorrect remaining integral instead of repairing it.

These focused checks cover the reported blur/reconstruction failure mode. They are not a substitute for the full 25-case golden run below.

The recovery-specific focused live recheck was not run during this final verification because this worktree has no configured approved `OPENAI_API_KEY`. Consequently, no new claim is made here about the forced blurred request; the acceptable live outcome remains a schema-valid analysis preserving visible work, or `unreadable` only when zero steps were transcribed.

## Unreadable-photo recovery behavior

The retake screen is now deliberately rare. Non-math and zero-step inputs remain blocked, while ordinary uncertainty continues into diagnosis. A nonempty transcript reaches that screen only when stage-one legibility is at or below `0.15` and the independent image check rejects both faithfulness and legibility. **Proceed anyway** sends `allowUncertainTranscript=true` for that request only; a forced request still cannot bypass a zero-step result.

**Take a new photo** is deliberately destructive for the unreadable attempt: it permanently deletes the unreadable scan and its owned image from device-local history and Patterns, then opens capture. It is not a retry of the same stored photo.

## Paid golden gate

```bash
npm run golden -w server
```

This is a paid live-model gate, not a mock check. It requires `OPENAI_API_KEY` in `server/.env` and makes external model calls. It was not run in this environment because no API key was available. No paid-pass rate is claimed here.

## Physical-phone checklist — pending, not automated

Start a clean mock phone run for deterministic states:

```bash
MOCK=error npm run mock -w server
cd app && EXPO_PUBLIC_API_URL=http://<MAC-LAN-IP>:3000 npx expo start --go
```

Use `MOCK=timeout`, `server-error`, `unreadable`, `not-math`, `correction`, and `alternate-follow-up` as needed. The phone and Mac must share a network; do not use the phone’s `localhost`.

Start a clean live phone run only with an approved API key:

```bash
npm run dev -w server
cd app && EXPO_PUBLIC_API_URL=http://<MAC-LAN-IP>:3000 npx expo start --go
```

- [ ] Camera and gallery both reach review.
- [ ] Cancel returns to review with the photo intact.
- [ ] Offline, timeout, server, unreadable, and not-math states offer the correct actions.
- [ ] With `MOCK=unreadable`, submit a photo and confirm the default unreadable result presents the warning plus both **Take a new photo** and **Proceed anyway**.
- [ ] Select **Take a new photo**, confirm capture opens, restart the app, and confirm the deleted unreadable attempt is absent from both Previous scans and Patterns.
- [ ] From the unreadable recovery screen, select **Proceed anyway** and confirm progress appears without automatically returning to camera.
- [ ] Force a network failure while using **Proceed anyway** and confirm the retry keeps the forced mode.
- [ ] Make a forced request return unreadable a second time and confirm the app remains on the recovery screen.
- [ ] Rapidly tap either recovery action and confirm busy states prevent a double submission.
- [ ] With VoiceOver enabled, confirm it announces the unreadable warning before **Proceed anyway**.
- [ ] Submit a clear handwritten page that receives a low Stage 1 confidence score and confirm the strict verifier can continue without **Proceed anyway** when it confirms the transcript.
- [ ] Correction replaces the active diagnosis and does not add a Pattern attempt.
- [ ] Follow-up remains visible on camera and links to its parent.
- [ ] Use both a normal and deliberately long press on **Try a similar problem**, confirm the problem remains visible, and confirm capture opens only after a new **Check my work** activation.
- [ ] Confirm VoiceOver/TalkBack activation of **Check my work** still works.
- [ ] App restart restores review, result, and follow-up states.
- [ ] Previous scan opens, deletes individually, and clear-all removes every owned image.
- [ ] VoiceOver and maximum Dynamic Type complete the core journey.

## Two-minute demo rehearsal and security checklist — pending, not automated

- [ ] Record one uninterrupted rehearsal: capture and review, a real live-model analysis, first-break explanation, diagnosis acceptance or correction, a similar follow-up, Patterns, and a Previous scan.
- [ ] Keep any mock footage visually labeled throughout as “DETERMINISTIC MOCK MODE — CANNED RESPONSE (NOT LIVE MODEL).”
- [ ] If a real analysis is cut or sped up, keep “REAL LIVE-MODEL RUN” and “Analysis time condensed” visible through that segment.
- [ ] Check the entire recording for API keys, terminal windows, personal notifications, account information, and unrelated photos.
- [ ] Check audio, captions, vertical framing, and public or permitted-unlisted playback in a signed-out browser.
- [ ] Confirm the final export stays within the competition’s permitted duration.

These unchecked items deliberately remain pending. They require a physical phone, a live API key for the real-model portion, and a human recording review.
