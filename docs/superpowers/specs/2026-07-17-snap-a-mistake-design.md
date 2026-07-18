# Snap-a-Mistake — Design Spec

**Date:** 2026-07-17
**Author:** Johaan Mannanal (with Claude)
**Status:** Approved design, pre-implementation
**Deadline:** Hackathon submission July 30, 2026, 8:45 p.m. Pacific (safe deadline)

## What it is

A native mobile app for students: snap a photo of your handwritten algebra/calculus
work, and the AI finds the exact step where your reasoning broke, names the
misconception, explains why it broke, and gives you an easier follow-up problem to
close the loop. Recurring misconception patterns are tracked over time.

Judged categories (25 pts each): educational impact, creative use of AI/ML,
technical execution + UI + stability, quality of the 2-minute pitch/demo.

## Scope

- **In (MVP):** photo capture → error localization → photo overlay + step cards →
  misconception name + why-it-broke explanation → one easier follow-up problem →
  retry loop → local misconception history/insights screen.
- **Deferred:** AI video-lesson feature (already mostly built in the separate
  `midnight apps tutor` repo). The Result screen reserves a third action slot for
  it. **No work on it during MVP.**
- **Out:** accounts/auth, server-side storage, subjects beyond algebra/calculus,
  Android polish (iOS-first via Expo; Android is free if it works).

## Architecture

Three pieces:

1. **Mobile app** — Expo + React Native, TypeScript. Dev via Expo Go on Johaan's
   phone. Local storage via SQLite (`expo-sqlite`) for misconception history.
2. **Thin backend** — Node + TypeScript (Fastify). Receives a photo, orchestrates
   Claude calls, returns clean typed JSON. Holds the API key. Stateless. Runs
   locally during dev; deploys to Railway (free tier) for the demo. Shared
   TypeScript types between app and backend (monorepo) so the API contract can't
   drift.
3. **Claude API pipeline** — two stages plus a verifier:
   - **Stage 1 (vision, Sonnet):** transcribe handwriting into discrete steps with
     approximate line positions (for the overlay box). Also classifies "is this
     math work?" and emits a legibility confidence score.
   - **Stage 2 (text-only, Sonnet):** analyze transcribed steps → broken step
     index, misconception tag (from a small controlled vocabulary), why-it-broke
     explanation, one easier follow-up problem targeting the same concept.
   - **Verifier (Haiku, fast-follow after MVP pipeline works):** audits the
     diagnosis before display. On disagreement, the app softens to an unsure
     prompt instead of a confident red box.

### Data flow

```
snap photo → resize/compress on device → POST /analyze
  → Stage 1: image → [steps + positions + legibility + is-math]
  → Stage 2: steps → {errorStepIndex, misconceptionTag, explanation, followUp}
  → Verifier: confirm or soften
→ JSON → app renders overlay + step cards
→ misconception record saved to device SQLite
```

Backend is **stateless by design**: no accounts, no server DB, nothing to break
during the demo. History lives on-device only.

## Screens

1. **Home / Camera** — opens straight to camera with framing-guide overlay (good
   light, page flat, one problem per shot). Gallery picker fallback. History tab.
2. **Analyzing** — staged progress text mirroring the real pipeline ("Reading your
   handwriting…" → "Checking each step…" → "Verifying the diagnosis…"). Makes
   8–10s latency legible and shows the architecture to judges.
3. **Result** (money screen) — photo on top with a red full-width band over the
   broken line; transcribed step cards below (✓ ✓ ⚠️ ✗); flagged card expanded
   with misconception name + explanation. Actions: "Try a follow-up" + reserved
   slot for the future video-lesson feature. **Correct work** gets a green
   "All steps check out ✓" state with a brief what-you-did-well note — the app
   never invents an error.
4. **Follow-up** — generated easier problem shown big and clean. "I'm done —
   check it" reopens the camera and loops back through analysis. Correct-on-retry
   is the emotional beat of the demo video.
5. **Insights** — local misconception patterns: counts and trend arrows
   ("Sign errors: 3 this week", "Chain rule: improving ↗"). One glanceable
   screen.

## API contract (backend)

`POST /analyze` — multipart image upload → typed JSON:

```ts
type AnalyzeResponse =
  | { kind: 'analysis'; steps: Step[]; errorStepIndex: number | null; // null = correct
      misconceptionTag: string | null; explanation: string | null;
      followUp: { problem: string; concept: string } | null;
      verifierAgreed: boolean }
  | { kind: 'unreadable'; tips: string[] }
  | { kind: 'not-math' }

type Step = { index: number; latex: string; plain: string;
              yBandTopPct: number; yBandBottomPct: number; // overlay band, % of image height
              verdict: 'ok' | 'suspect' | 'wrong' | 'downstream' }
```

All Claude outputs validated with zod before returning; validation failure →
one retry with the validation error fed back, then a clean 502.

## Error handling (ranked by demo-day severity)

1. **False accusation** — verifier audits every diagnosis; on disagreement, app
   shows "I'm not fully sure about step 3 — want to walk through it?" instead of
   a red box. Uncertain beats wrong.
2. **Unreadable photo** — legibility score below threshold → friendly retake
   screen with specific tips, never a garbage analysis.
3. **Overlay box drift** — the box is a full-width *line band*, not a tight
   rectangle; step cards carry the real diagnosis, so a slightly-off band never
   breaks comprehension.
4. **API failure/timeout** — 30s cap, one auto-retry, then clean error screen
   with retry; photo retained locally so the student never re-snaps.
5. **Off-scope input** — Stage 1 is-math gate → polite "I only speak math for
   now 📐".

## Testing

- **Golden set:** ~15 real handwritten photos — 4 correct solutions, ~8 with
  planted errors across misconception types (sign error, chain rule, u-sub
  bounds, algebra slip), 3 garbage inputs (blurry, non-math, multi-problem).
- **Regression script:** runs the pipeline over the golden set and reports:
  right step flagged, right misconception tag, correct work passed clean. Every
  prompt tweak reruns it — prompts tuned with evidence, not vibes.
- **Backend unit tests** on Claude-output parsing/validation (zod schemas).
- **Final week:** on-device runs with fresh Calc III homework (doubles as
  authentic demo-video material).

## Milestones (loose)

1. Repo + monorepo scaffold (Expo app + Fastify backend + shared types).
2. Backend pipeline working against golden-set photos via script (no app yet).
3. App camera → analyze → Result screen happy path.
4. Follow-up loop + correct-work state.
5. Verifier + Insights screen + SQLite history.
6. Polish, golden-set hardening, demo video.
