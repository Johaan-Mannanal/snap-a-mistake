# Snap-a-Mistake Demo Script — 2:30 Target

Record vertically from the phone when showing the app. The primary app take uses
the deterministic mock server, so it must carry a persistent, unmistakable
on-screen label: **“DETERMINISTIC MOCK MODE — CANNED RESPONSE (NOT LIVE GPT-5.6).”**
Show separately labeled **“REAL GPT-5.6 RUN EVIDENCE — PAID FERMAT
GATE: 8/10”** in the repository cutaway; this is evidence, not part of the mock
take.

## 0:00–0:15 — Problem

**On screen:** Handwritten work, then Snap-a-Mistake home screen.

**Say:** “A wrong answer tells a student almost nothing. Snap-a-Mistake finds
the first handwritten step where the reasoning broke, explains the
misconception, and gives the student a smaller problem to try next.”

## 0:15–0:45 — Capture and analysis

**On screen:** Keep the persistent **“DETERMINISTIC MOCK MODE — CANNED RESPONSE
(NOT LIVE GPT-5.6)”** banner visible while capturing an intentionally
incorrect problem; show Reading, Checking, and Verifying progress stages.

**Say:** “This primary take is deterministic mock mode, so the displayed
response is canned—not a live model call. In the live pipeline, GPT-5.6 vision
transcribes the page into positioned steps, a reasoning pass finds the earliest
error, and a separate verifier checks the diagnosis before the app displays it.”

## 0:45–1:15 — Exact-step feedback

**On screen:** Result overlay, wrong step card, misconception, explanation.

**Say:** “The app preserves the student’s page, highlights the exact line, and
labels the underlying misconception—not merely the final answer. If the
verifier disagrees, the red error becomes a softer uncertain state.”

## 1:15–1:40 — Close the learning loop

**On screen:** Follow-up problem, retry action, then correct state.

**Say:** “Feedback immediately becomes targeted practice. The student tries an
easier version, snaps again, and closes the loop with a verified correct state.”

## 1:40–1:55 — Insights

**On screen:** Insights screen with local trend cards.

**Say:** “Recurring misconception tags become private on-device trends, so a
student can see whether sign errors or rule mistakes are improving over time.”

## 1:55–2:20 — Codex build story

**On screen:** Repository architecture, tests, semantic-anchor test, and a
separate card labeled **“REAL GPT-5.6 RUN EVIDENCE — PAID FERMAT GATE: 8/10.”**

**Say:** “I built this with Codex as an engineering partner. It helped turn the
idea into design specs, drive test-first implementation and independent reviews,
curate a licensed handwriting set, and diagnose paid evaluations. When model
segmentation shifted, Codex replaced brittle line numbers with semantic math
anchors. Separately, the paid real GPT-5.6 FERMAT gate is eight of ten: one
canonical-tag mismatch and one truncated-JSON failure.”

## 2:20–2:30 — Close

**On screen:** Product name and Education category.

**Say:** “Snap-a-Mistake helps students understand where their thinking changed,
then gives them the next achievable step. That is feedback built for learning.”

## Recording safety

- Start `npm run mock -w server` before recording; use `MOCK=correct` for the retry payoff.
- Record one clean continuous app take, then add the repository cutaway.
- Keep the final export below 2:50 to preserve upload-platform margin.
- Listen once with the screen off to confirm Codex and GPT-5.6 are both audible.
- Upload publicly to YouTube and verify playback in a signed-out browser.
