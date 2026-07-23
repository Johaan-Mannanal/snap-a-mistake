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
smaller targeted problem. The next attempt can close the loop when all steps
check out.

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

Misconception trend records remain on-device in SQLite. Each photo and its
transcribed work are transiently processed by the backend and the configured
external model API. The app server has no database and does not persist those
photos or transcriptions. Provider handling is governed by the provider's
applicable data terms; this repository does not promise provider retention
behavior. HTTPS is required before any hosted use. The mock path is for
reproducible UI inspection and must be labeled as canned whenever it is shown.

## Data and validation references

| What | Where |
|------|-------|
| Dated readiness evidence and reproducibility boundary | [`docs/validation/2026-07-22-prometheus-readiness.md`](docs/validation/2026-07-22-prometheus-readiness.md) |
| FERMAT license, citation, and attribution | [`server/golden/FERMAT-ATTRIBUTION.md`](server/golden/FERMAT-ATTRIBUTION.md) |
| FERMAT source records, labels, pinned revision, and shard checksums | [`server/golden/fermat-provenance.json`](server/golden/fermat-provenance.json) |
| Optional FERMAT subset importer (requires accepted FERMAT access and `HF_TOKEN`) | [`server/scripts/import-fermat.py`](server/scripts/import-fermat.py) |

## Submission kit

The [ready-to-paste Devpost form copy](docs/submission/DEVPOST.md) and
[1:50–1:55 recording plan](docs/submission/DEMO-SCRIPT.md) are prepared for the
current submission. The demo leads with a real live-model diagnosis; any mock
footage is explicitly labeled as canned UI coverage.

## Running things

### Judge quickstart — no API key (iOS)

```bash
npm install
npm run mock -w server
# In a second terminal, use localhost for the iOS simulator:
cd app && EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --go
```

Press `i` for the iOS simulator. For a physical iPhone, keep the phone and Mac
on the same network and use the Mac's LAN address instead—its `localhost` points
to the phone, not this server:

```bash
cd app && EXPO_PUBLIC_API_URL=http://<Mac-LAN-IP>:3000 npx expo start --go
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
cd app && npx expo start --go   # Expo Go; phone needs EXPO_PUBLIC_API_URL=http://<Mac-LAN-IP>:3000
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

- Reproducible on this branch: **150 automated tests** (12 shared, 85 server
  Vitest, 4 Python importer, and 49 app), clean workspace typechecking, Expo
  Doctor **20/20**, and a 25-case manifest with 15 synthetic cases plus 10
  licensed FERMAT photographs (2 correct and 8 intentional-error cases).
- Owner-observed: a physical-iPhone development-build workflow and a live-model
  smoke run with real handwritten math.
- Owner-reported paid FERMAT validation: **8/10**. The raw provider artifact was
  not committed; the two reported misses were one strict canonical-tag mismatch
  and one truncated JSON response.

These are engineering validation results, not claims about a deployed service,
users, or learning outcomes. See the
[dated validation summary](docs/validation/2026-07-22-prometheus-readiness.md)
for commands, provenance, and the boundary between reproducible and
owner-reported evidence.

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
