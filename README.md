# Snap-a-Mistake

Snap a photo of handwritten algebra or calculus work. Snap-a-Mistake finds the
first step where the reasoning broke, names the misconception, explains why it
broke, and creates an easier problem to try next. Recurring mistake patterns
are tracked locally over time.

<p align="center">
  <img src="docs/assets/readme/analysis-error.png" alt="Snap-a-Mistake locating the first broken step in handwritten calculus work" width="31%" />
  <img src="docs/assets/readme/follow-up.png" alt="Snap-a-Mistake generating a targeted follow-up problem" width="31%" />
  <img src="docs/assets/readme/insights.png" alt="Snap-a-Mistake showing a recurring misconception pattern" width="31%" />
</p>

<p align="center"><sub>Locate the first break · generate targeted practice · track recurring patterns locally</sub></p>

The screens above are captured from the iOS app. The analysis screen uses the
deterministic mock response so the public UI preview is reproducible; live-model
validation results are reported below.

## The learning loop

Students often learn only that a final answer is wrong. That does not tell them
which assumption or rule changed their reasoning. Snap-a-Mistake is built around
an exact-first-break loop: preserve the original work, identify the earliest
unsupported step, explain the misconception in context, then give the student a
smaller targeted problem. The next attempt can close the loop with a verified
correct state.

> **Current Prometheus submission:** the public package is this repository and
> a narrated video. Complete the required Google form, confirm eligibility,
> verify public signed-out video playback, and submit by July 29 operationally
> ahead of the official July 30, 2026, 8:45 p.m. PDT deadline. See the
> [Devpost checklist](docs/submission/DEVPOST.md) and
> [recording plan](docs/submission/DEMO-SCRIPT.md).

## Architecture (three workspaces, npm monorepo)

```
photo → app (Expo/RN) → POST /analyze → server (Fastify, stateless)
  → multimodal transcription — indexed handwritten steps + y-position bands
  → reasoning diagnosis — first wrong step, tag misconception, explanation, follow-up problem
  → independent verification — disagreement softens "wrong" to "suspect"
  → typed AnalyzeResponse → app renders photo overlay + step cards → history saved to on-device SQLite
```

- **`shared/`** — the API contract: Zod schemas (`AnalyzeResponse`, `Step`, stage results) and the 13-tag misconception vocabulary. Both server and app import from here; types are not re-declared.
- **`server/`** — Fastify. `POST /analyze` accepts a multipart photo, normalizes it, runs the three-stage model pipeline, and returns JSON. Stateless by design: no database and no accounts. All model calls flow through one wrapper (`src/llm/client.ts`: Zod-validated JSON with one correction retry; transport errors propagate untouched).
- **`app/`** — Expo (expo-router, strict TS). Screens: camera home → analyzing (staged progress) → result (red-band photo overlay + ✓/⚠️/✗/↓ step cards) → follow-up loop → insights (weekly misconception trends). Pure logic lives in `app/src/lib/` (no RN imports — vitest-tested in node); screens are thin components over it. History is device-local SQLite.

## Product AI and safeguards

The configured pipeline uses a multimodal transcription pass, a
reasoning diagnosis pass, and an independent verification pass. Current model
IDs live in `server/src/config.ts`. The verifier favors uncertainty over a false
accusation: when it disagrees with the diagnosis, the app renders a softer
“suspect” state.

Key product decisions:

- semantic math anchors instead of segmentation-dependent step numbers;
- one exact canonical misconception tag per error;
- a verifier that prefers uncertainty over a false accusation;
- a stateless backend and on-device-only learning history;
- a zero-cost mock path so the UI can be inspected without keys.

The server is stateless and learning history is stored only on the device. There
are no accounts or server-side student-history storage in the current product.
The mock path is for reproducible UI inspection and must be labeled as canned
whenever it is shown.

## Where the documentation lives

| What | Where |
|------|-------|
| Approved design spec (source of truth for scope/behavior) | `docs/superpowers/specs/2026-07-17-snap-a-mistake-design.md` |
| Backend implementation plan (executed, complete) | `docs/superpowers/plans/2026-07-17-snap-a-mistake-backend.md` |
| App implementation plan (executed, complete) | `docs/superpowers/plans/2026-07-18-snap-a-mistake-app.md` |
| FERMAT license, citation, and attribution | [`server/golden/FERMAT-ATTRIBUTION.md`](server/golden/FERMAT-ATTRIBUTION.md) |
| FERMAT source records, labels, pinned revision, and shard checksums | [`server/golden/fermat-provenance.json`](server/golden/fermat-provenance.json) |
| Optional FERMAT subset importer (requires accepted FERMAT access and `HF_TOKEN`) | [`server/scripts/import-fermat.py`](server/scripts/import-fermat.py) |

## Submission kit

The [ready-to-paste Devpost form copy](docs/submission/DEVPOST.md) and
[1:50–1:55 recording plan](docs/submission/DEMO-SCRIPT.md) are prepared for the
current submission. The demo leads with a real live-model diagnosis; any mock
footage is explicitly labeled as canned UI coverage.

## Running things

### Judge quickstart — no API key

```bash
npm install
npm run mock -w server
# In a second terminal, use localhost only for an iOS simulator or web target:
cd app && EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start
```

Press `i` for the iOS simulator or `w` for web. A physical phone must be on the
same network as the Mac and use the Mac's LAN address instead—its `localhost`
points to the phone, not this server:

```bash
cd app && EXPO_PUBLIC_API_URL=http://<Mac-LAN-IP>:3000 npx expo start
```

Use `MOCK=correct npm run mock -w server` or replace `correct` with `error`,
`suspect`, `unreadable`, or `not-math` to exercise every response state.

```bash
npm install                  # root — installs all three workspaces
npm test                     # all workspace Vitest suites + 4 stock-Python importer tests
npm run typecheck            # all workspaces

# Server (needs server/.env — copy server/.env.example, add OPENAI_API_KEY)
npm run dev -w server        # live pipeline on :3000
npm run mock -w server       # NO API key needed — canned fixtures, 4s delay
MOCK=correct npm run mock -w server   # fixtures: correct|error|suspect|unreadable|not-math

# Paid golden regression suite (the gate for ALL prompt tuning — run after any prompt change)
npm run gen-synthetic -w server   # regenerates the 15 synthetic test images
npm run golden -w server          # paid combined 25-case gate; exits 1 on failure
npm run golden:fermat -w server   # paid ten-case handwriting-only gate

# App (device/simulator)
cd app && npx expo start     # Expo Go; phone needs EXPO_PUBLIC_API_URL=http://<Mac-LAN-IP>:3000
```

The root `npm test` command runs both the workspace Vitest suites and the four
stock-`python3` importer regression tests; no third-party Python packages are
needed for the importer tests.

**Conventions that matter:** the `app` workspace uses extensionless relative
imports (Metro cannot resolve `.js` to `.ts`); `server` and `shared` use
`.js`-suffixed imports (Node ESM requires them). Model IDs and the legibility
threshold live in `server/src/config.ts`. JSON-mode prompts must include the
literal word “JSON.”

## Current evidence (as of July 22)

- As of July 22, **150 automated tests** were passing, workspace typechecking was clean, and Expo Doctor reported **20/20 checks passed**.
- A physical-device development-build check exercised camera and gallery input, staged analysis, result overlays, follow-up practice, local insights, non-math and unreadable responses, and network recovery. A live smoke test processed real handwritten math after the long-running request path was hardened.
- Golden manifest: **25 cases** — 15 generated baseline cases plus 10 curated FERMAT photographs (2 correct, 8 intentional errors across algebra/calculus). The generated baseline last passed 15/15. Audited segmentation drift disproved fixed numeric FERMAT indices, so this branch now judges FERMAT localization by semantic anchors and exact canonical tags.
- Latest paid FERMAT validation: **8/10**. Eight real-handwriting cases passed end-to-end; one selected the correct error step but disagreed with the strict canonical tag, and one returned truncated JSON after retry.

These are engineering validation results, not claims about a deployed service,
users, or learning outcomes.

## Next submission actions

1. Record the narrated demo using [`docs/submission/DEMO-SCRIPT.md`](docs/submission/DEMO-SCRIPT.md): real diagnosis first, then clearly labeled mock footage only for reproducible UI states the live run does not show.
2. Upload the video and verify full playback, audio, and captions in a signed-out browser.
3. Complete the required Google form and Devpost entry, confirm eligibility and the public repository, then submit by July 29 ahead of the official deadline.

## Things intentionally NOT done

- No auth/accounts/server-side storage (stateless by design — nothing to break in a demo).
- No math-notation renderer in the app (plain-English + monospace LaTeX text was the deliberate YAGNI call).
- Screens/components have no unit tests by design — pure logic is fully tested; UI is verified via the mock-server manual scripts in the app plan's task steps.

## License and data attribution

Original Snap-a-Mistake code is available under the [MIT License](LICENSE).
The curated FERMAT photographs remain under CC BY 4.0; see
[FERMAT attribution](server/golden/FERMAT-ATTRIBUTION.md) and
[provenance](server/golden/fermat-provenance.json). The Expo-derived app
template retains its notice in [app/LICENSE](app/LICENSE).
