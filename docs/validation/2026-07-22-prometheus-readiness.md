# Prometheus readiness and final verification record — July 26, 2026

This record separates repository-reproducible evidence from paid, device, and rehearsal work that still needs a human operator. It does not contain API keys, private photos, raw provider responses, device identifiers, or recording artifacts.

## Automated evidence recorded on this branch

The following commands completed on July 26, 2026:

```bash
npm test
npm run typecheck
npm run lint -w app
```

- `npm test`: **498 tests passed** — 42 shared Vitest, 120 server Vitest, 4 stock-Python importer tests, and 332 app Vitest tests.
- `npm run typecheck`: shared, server, and app each completed `tsc --noEmit`.
- `npm run lint -w app`: Expo lint completed with zero warnings and zero errors.
- The app’s lint setup uses SDK 57-compatible `eslint` and `eslint-config-expo`. Its only targeted configuration exceptions are for React Native object-ref forwarding and Reanimated shared-value mutation; ordinary Expo lint rules remain enabled.

The committed golden manifest still contains 25 inspectable cases: 15 synthetic cases and 10 CC BY 4.0 FERMAT handwriting photographs (2 correct and 8 intentional-error cases). Attribution and provenance are in [FERMAT-ATTRIBUTION.md](../../server/golden/FERMAT-ATTRIBUTION.md) and [fermat-provenance.json](../../server/golden/fermat-provenance.json).

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
- [ ] Correction replaces the active diagnosis and does not add a Pattern attempt.
- [ ] Follow-up remains visible on camera and links to its parent.
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
