# Snap-a-Mistake

Snap a photo of handwritten algebra/calculus work → AI finds the exact step where the reasoning broke, names the misconception, explains why it broke, and generates an easier follow-up problem. Recurring mistake patterns are tracked locally over time.

Built for an educational-AI hackathon. **Submission deadline: July 30, 2026, 8:45 p.m. Pacific** (displayed deadline is 11:45 p.m. EDT; the rules page says 11:59 p.m. — submit by 8:45 p.m. PT to be safe). Judged 25 pts each: educational impact, creative AI/ML use, technical execution/UI/stability, 2-minute pitch/demo.

## Architecture (three workspaces, npm monorepo)

```
photo → app (Expo/RN) → POST /analyze → server (Fastify, stateless)
  → Stage 1: GPT-5.6-sol vision — transcribe handwriting into indexed steps + y-position bands
  → Stage 2: GPT-5.6-sol text — find FIRST wrong step, tag misconception, explain, follow-up problem
  → Verifier: GPT-5.6-luna — independent audit; disagreement softens "wrong" to "suspect"
  → typed AnalyzeResponse → app renders photo overlay + step cards → history saved to on-device SQLite
```

- **`shared/`** — the API contract: zod schemas (`AnalyzeResponse`, `Step`, `Stage1/2/Verifier` results) and the 11-tag misconception vocabulary. Both server and app import from here; never re-declare these types.
- **`server/`** — Fastify. One route that matters: `POST /analyze` (multipart `photo`) → sharp normalize → 3-stage LLM pipeline → JSON. Stateless by design: no DB, no accounts. All model calls flow through one wrapper (`src/llm/client.ts`: zod-validated JSON with one correction retry; transport errors propagate untouched). Provider swaps only touch this workspace.
- **`app/`** — Expo (expo-router, strict TS). Screens: camera home → analyzing (staged progress) → result (red-band photo overlay + ✓/⚠️/✗/↓ step cards) → follow-up loop → insights (weekly misconception trends). Pure logic lives in `app/src/lib/` (no RN imports — vitest-tested in node); screens are thin components over it. History is device-local SQLite.
- **Parked feature:** an AI video-generation lesson exists in the separate `midnight apps tutor` repo; the Result screen reserves a disabled "🎬 Video lesson — coming soon" slot for it. Deliberately untouched so far.

## Where the documentation lives

| What | Where |
|------|-------|
| Approved design spec (source of truth for scope/behavior) | `docs/superpowers/specs/2026-07-17-snap-a-mistake-design.md` |
| Backend implementation plan (executed, complete) | `docs/superpowers/plans/2026-07-17-snap-a-mistake-backend.md` |
| App implementation plan (executed, complete) | `docs/superpowers/plans/2026-07-18-snap-a-mistake-app.md` |
| Execution ledger: what was built, reviewed, fixed, deferred | `.superpowers/sdd/progress.md` (git-ignored scratch — read it before assuming anything is undone) |

Every task was implemented via fresh-agent TDD with a two-stage review (spec compliance + code quality) and a final whole-branch review per plan. Deferred minor findings are listed at the bottom of the ledger.

## Running things

```bash
npm install                  # root — installs all three workspaces
npm test                     # 54 tests: shared 9, server 26, app 19
npm run typecheck            # all workspaces

# Server (needs server/.env — copy server/.env.example, add OPENAI_API_KEY)
npm run dev -w server        # live pipeline on :3000
npm run mock -w server       # NO API key needed — canned fixtures, 4s delay
MOCK=correct npm run mock -w server   # fixtures: correct|error|suspect|unreadable|not-math

# Golden regression suite (the gate for ALL prompt tuning — run after any prompt change)
npm run gen-synthetic -w server   # regenerates the 15 synthetic test images
npm run golden -w server          # runs them through the REAL pipeline; exits 1 on failure

# App (device/simulator)
cd app && npx expo start     # Expo Go; phone needs EXPO_PUBLIC_API_URL=http://<Mac-LAN-IP>:3000
```

**Conventions that will bite you if you don't know them:** the `app` workspace uses extensionless relative imports (Metro can't resolve `.js`→`.ts`); `server`/`shared` use `.js`-suffixed imports (Node ESM requires them). Model IDs and the legibility threshold live in `server/src/config.ts`. OpenAI JSON mode requires the literal word "JSON" in prompts. Copy strings in the app are tuned demo copy — don't reword casually.

## Current status (as of July 20)

- Backend + app both complete, reviewed, merged to `main`. 54/54 tests, typecheck clean.
- Live smoke test passed against the real OpenAI pipeline (~9.5s/analysis).
- Golden suite: **15/15** on synthetic typed-math images (4 correct, 8 planted errors — right step AND right tag on all — 3 garbage). Photos are git-ignored; regenerate with `gen-synthetic`.
- API key: in `server/.env` (git-ignored). **It was shared in a chat session — rotate it before the demo.**

## Steps forward (rough priority order)

1. **Real-handwriting golden cases** — the 15/15 is on clean typed images; handwriting is strictly harder for Stage 1. Photograph ~8-10 real sheets (same recipe: one problem per page, known wrong step, known tag), add as `hw-*.jpg` cases in `server/golden/manifest.json`, tune prompts until green.
2. **On-device verification pass** (nobody has run the app on hardware yet): camera capture, overlay bands landing on the right lines, swipe-back behavior during snap→result→follow-up cycles, insights after several analyses. Use the mock server first, then the live one.
3. **Deploy server to Railway** (free tier), set `EXPO_PUBLIC_API_URL` to the deployed URL so the demo doesn't depend on a laptop.
4. **Demo video (≤2 min)** — the planned emotional arc: snap wrong work → error circled + explanation → follow-up problem → snap retry → green "All steps check out ✓" → insights screen. Record via device screen-capture.
5. **Optional stretch:** wire the parked video-lesson feature into the reserved Result-screen slot.
6. Deferred code minors (see ledger bottom): PhotoOverlay `Image.getSize` fallback → migrate to `expo-image`; `history.ts` init-race memoization; 413 status passthrough on oversized uploads; misc polish.

## Things intentionally NOT done

- No auth/accounts/server-side storage (stateless by design — nothing to break in a demo).
- No math-notation renderer in the app (plain-English + monospace LaTeX text was the deliberate YAGNI call).
- Screens/components have no unit tests by design — pure logic is fully tested; UI is verified via the mock-server manual scripts in the app plan's task steps.
