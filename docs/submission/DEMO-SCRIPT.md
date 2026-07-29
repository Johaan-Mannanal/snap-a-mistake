# Snap-a-Mistake — final two-minute demo package

**Format:** Edited portrait footage with recorded voiceover
**Target:** 1:52–1:58, never over 2:00
**Core evidence:** One genuine live-model capture-to-result run
**Optional support:** Visibly labeled deterministic UI footage only

## Exact phone setup

Use the existing development build on the physical phone. Keep the phone and Mac on the same Wi-Fi network.

Terminal 1 — live server:

```bash
cd /Users/johaanmannanal/Documents/GitHub/snap-a-mistake
test -f server/.env || cp server/.env.example server/.env
npm run dev -w server
```

Confirm `server/.env` contains the approved `OPENAI_API_KEY` without printing it.

Terminal 2 — development client:

```bash
cd /Users/johaanmannanal/Documents/GitHub/snap-a-mistake/app
SNAP_MAC_IP=$(ipconfig getifaddr en0)
echo "Mac IP: $SNAP_MAC_IP"
EXPO_PUBLIC_API_URL="http://${SNAP_MAC_IP}:3000" npx expo start --dev-client --clear
```

Before recording, enable Do Not Disturb, close private apps and terminals, remove unrelated photos from the picker, clean the camera lens, use one high-contrast handwritten integration-by-parts example, and complete one successful rehearsal.

## Shot list

| Edit time | Capture | Editing direction |
| --- | --- | --- |
| 0:00–0:05 | Camera screen with the handwritten page ready | Start immediately; no terminal footage. |
| 0:05–0:14 | Capture, review, and tap the analysis action | Keep the page large and readable. |
| 0:14–0:36 | Real progress states through the returned result | Show **REAL LIVE-MODEL RUN** throughout. Cut waiting time; add **Analysis time condensed** over every shortened portion. |
| 0:36–1:05 | First-break overlay, misconception heading, explanation, and one selected timeline step | Pause long enough to read the highlighted line. |
| 1:05–1:28 | Tap **Try a similar problem**, reveal the hint, then leave the problem visible beside **Check my work** | Do not open capture automatically; the deliberate next action is part of the story. |
| 1:28–1:49 | Open **Patterns**, switch to **Previous scans**, and open one retained scan | Use real device-local history from the rehearsal. |
| 1:49–1:58 | Return to the first-break result or follow-up problem | End on the product, then fade to the project name and GitHub URL. |

Do not include the diagnosis-correction flow in the required timeline. It may be kept as optional B-roll only if the final cut remains below 2:00.

## Final voiceover

**0:00–0:14**
“Most math tools stop at ‘wrong answer.’ But students need to know where their reasoning first changed. I built Snap-a-Mistake to photograph handwritten work, locate the first unsupported step, explain the misconception, and create a useful next attempt.”

**0:14–0:36**
“I review the photo, then start a real live-model analysis. The server transcribes the visible lines, checks that transcript against the ink, reasons across the full solution, and independently verifies the diagnosis. If the checks disagree, the app softens the result instead of pretending to be certain.”

**0:36–1:05**
“Here, the first break is attached directly to the student’s line on the original page. The timeline keeps earlier correct work in context, names the integration-by-parts error, and explains what changed. The math is shown as readable symbols, not raw model formatting, and I can zoom the photo or select another line.”

**1:05–1:28**
“The feedback closes the loop with a similar problem and an optional hint. The problem stays visible until I am ready to check my new work. A student can also accept, reject, or correct the diagnosis, so one uncertain model result does not become permanent.”

**1:28–1:49**
“Patterns and Previous scans are stored locally on the phone. They connect recurring misconceptions, corrections, and follow-up attempts without requiring an account. The Fastify server itself is stateless: it has no user database or history store.”

**1:49–1:58**
“Snap-a-Mistake turns a wrong answer into a learning sequence: find the first break, understand it in context, and practice the idea again.”

## If the live run fails

1. Retry the genuine live request once.
2. If recording-day latency is poor, use previously recorded genuine footage from the same final build.
3. Use `MOCK=error npm run mock -w server` only for optional interface B-roll.
4. Keep **DETERMINISTIC MOCK MODE — CANNED RESPONSE (NOT LIVE MODEL)** visible for the entire mock clip.
5. Never use an unlabeled mock result in the core live-analysis sequence.

## Required edit overlays

- Genuine request/result: **REAL LIVE-MODEL RUN**
- Any shortened genuine wait: **Analysis time condensed**
- Any deterministic response: **DETERMINISTIC MOCK MODE — CANNED RESPONSE (NOT LIVE MODEL)**

## Edit checklist

- [ ] Final duration is between 1:52 and 1:58.
- [ ] Voiceover is clear, normalized, and synchronized with each shot.
- [ ] Captions match the voiceover and stay inside mobile-safe margins.
- [ ] Portrait footage is centered without exposing terminal windows.
- [ ] Every shortened live segment has both required live/condensed labels.
- [ ] Every mock frame has the persistent canned-response label.
- [ ] No API key, notification, account data, unrelated photo, device identifier, or private browser tab is visible.
- [ ] The final frame shows `github.com/Johaan-Mannanal/snap-a-mistake`.
- [ ] Uploaded playback works while signed out and the Devpost video field accepts the URL.
