# Snap-a-Mistake demo script — two-minute rehearsal

This is a rehearsal plan, not evidence that a phone recording has been completed. The pending rehearsal and security checklist is in the [validation record](../validation/2026-07-22-prometheus-readiness.md).

## Before recording

- Use a physical phone in portrait orientation.
- Record the core diagnosis through the live server only. Create `server/.env` from `server/.env.example`, set `OPENAI_API_KEY`, then run `npm run dev -w server`.
- For a phone, run Expo with `EXPO_PUBLIC_API_URL=http://<MAC-LAN-IP>:3000`; the phone and Mac must be on the same network.
- If deterministic UI footage is needed, run `MOCK=<mode> npm run mock -w server`. Add the persistent edit overlay **“DETERMINISTIC MOCK MODE — CANNED RESPONSE (NOT LIVE MODEL)”**. The app itself does not add that video label.
- Before opening the recorder, close terminals, hide notifications, remove unrelated photos, and verify no secret is visible.

## 0:00–0:14 — The problem and capture

**On screen:** A single handwritten problem, then camera capture and the review screen.

**Say:** “A wrong answer does not tell a student where their reasoning changed. I built Snap-a-Mistake to keep the original page in view, identify the first unsupported step, and give the student a similar problem to try next.”

## 0:14–0:42 — Live analysis

**On screen:** Start a real live-model analysis. Keep a visible **“REAL LIVE-MODEL RUN”** overlay until its result is shown. If the segment is cut or sped up, keep **“Analysis time condensed”** visible too.

**Say:** “This is a real live-model run. The server reads the handwritten steps, diagnoses the earliest break, and sends the result through an independent verification pass. If that verifier disagrees, the app shows a softer suspect state rather than treating the diagnosis as certain.”

## 0:42–1:05 — First-break feedback

**On screen:** The original photo overlay, selected step, misconception label, and explanation. Expand a timeline card and use the linked overlay once.

**Say:** “The feedback is attached to the student’s actual line, not just the final answer. I use readable Unicode math in the mobile UI so the explanation and follow-up are legible without exposing raw LaTeX.”

## 1:05–1:27 — Correction and similar follow-up

**On screen:** Accept the diagnosis or select a corrected step, then show the saved revision and the similar follow-up with hint. If showing deterministic correction or alternate-problem UI, keep the canned-response label visible.

**Say:** “A student can accept, reject, or correct the diagnosis. Corrections replace the active diagnosis for the same saved scan. Then the app offers a similar problem and a hint, and a new attempt stays linked to the original scan.”

## 1:27–1:46 — Patterns and Previous scans

**On screen:** Open Patterns, then Previous scans; open one saved scan and show its retained active revision.

**Say:** “Patterns and scan history stay on the device. The server has no database or account store, and saved photos, revisions, and follow-up links remain local until the student deletes them.”

## 1:46–2:00 — Close

**On screen:** Return to the photo and a concise architecture card.

**Say:** “Snap-a-Mistake is my attempt to turn ‘wrong answer’ into a useful next step: find the first break, explain it in context, and let the student practice the same idea again.”

## After recording — pending checklist

- [ ] Rewatch the whole recording for keys, terminals, notifications, account data, and unrelated photos.
- [ ] Verify every mock segment has the persistent canned-response label.
- [ ] Verify every cut or speed-up in a live-analysis segment has both required live/condensed labels.
- [ ] Verify audio, captions, portrait framing, and final duration.
- [ ] Upload as the rules permit and check signed-out playback before submitting.
