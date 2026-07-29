# Prometheus Submission Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the local Snap-a-Mistake repository into a judge-first, internally consistent Prometheus submission package with a polished two-minute edited demo script and reproducible final evidence.

**Architecture:** Keep product code unchanged. Improve the public entry point, align the two ready-to-paste submission documents with current behavior and evidence, replace the rehearsal outline with an executable shot/voiceover/edit package, then run repository-wide verification before synchronizing the approved result to the public GitHub repository.

**Tech Stack:** GitHub-flavored Markdown, TypeScript npm workspaces, Expo/React Native, Fastify, Vitest, Expo CLI, Git/GitHub CLI.

## Global Constraints

- Preserve the first-person solo-builder voice.
- Use the judge-first, technically honest, real-first hybrid direction approved in `docs/superpowers/specs/2026-07-28-prometheus-submission-package-design.md`.
- Do not change application or server behavior.
- Do not claim the full paid 25-image golden gate passed.
- Do not mark physical-phone, accessibility, rehearsal, upload, or signed-out playback checks complete without human evidence.
- Deterministic footage must always carry **DETERMINISTIC MOCK MODE — CANNED RESPONSE (NOT LIVE MODEL)**.
- Genuine live footage must carry **REAL LIVE-MODEL RUN**; condensed live footage must also carry **Analysis time condensed**.
- Preserve the MIT and FERMAT attribution/provenance links.
- Do not stage, commit, delete, or rewrite the user-owned root `.expo/` directory or root `tsconfig.json`.
- Do not push until the final local package is verified and the user explicitly approves the external mutation.

---

## File structure

- `README.md` — judge-first public landing page, screenshots, navigation, architecture, setup, evidence, limitations.
- `docs/submission/DEVPOST.md` — concise ready-to-paste Devpost project copy and honest technical evidence.
- `docs/submission/PROMETHEUS-ABOUT.md` — longer first-person project story required by the About field.
- `docs/submission/DEMO-SCRIPT.md` — exact phone setup, shot list, voiceover, editing, fallback, and upload checklist.
- `docs/validation/2026-07-22-prometheus-readiness.md` — final repository-reproducible command evidence and still-pending human gates.
- `docs/assets/readme/*.png` — existing 1206×2622 phone screenshots; no new image is required.

---

### Task 1: Make the README judge-first

**Files:**
- Modify: `README.md`
- Reuse: `docs/assets/readme/analysis-error.png`
- Reuse: `docs/assets/readme/follow-up.png`
- Reuse: `docs/assets/readme/insights.png`

**Interfaces:**
- Consumes: the approved screenshot order and existing README architecture/setup/privacy content.
- Produces: a GitHub landing page whose opening screenful contains the pitch, evidence navigation, and visible product workflow.

- [ ] **Step 1: Run a failing README-package assertion**

Run:

```bash
node -e 'const s=require("fs").readFileSync("README.md","utf8"); const required=["docs/assets/readme/analysis-error.png","docs/assets/readme/follow-up.png","docs/assets/readme/insights.png","docs/submission/DEMO-SCRIPT.md","docs/submission/DEVPOST.md","docs/submission/PROMETHEUS-ABOUT.md"]; const missing=required.filter(x=>!s.includes(x)); if(missing.length) throw new Error(`missing README links: ${missing.join(", ")}`)'
```

Expected: FAIL because the current README does not reference the three screenshots or compact submission links.

- [ ] **Step 2: Add the compact navigation and visual sequence**

Immediately after the uncertainty disclaimer, add:

```md
[Demo script](docs/submission/DEMO-SCRIPT.md) · [Devpost copy](docs/submission/DEVPOST.md) · [Project story](docs/submission/PROMETHEUS-ABOUT.md) · [Validation record](docs/validation/2026-07-22-prometheus-readiness.md) · [MIT license](LICENSE)

## See the learning loop

| Find the first break | Try the idea again | See private progress |
| --- | --- | --- |
| ![Snap-a-Mistake highlights the first unsupported handwritten step and explains the misconception.](docs/assets/readme/analysis-error.png) | ![Snap-a-Mistake presents a similar follow-up problem with a hint and a deliberate Check my work action.](docs/assets/readme/follow-up.png) | ![Snap-a-Mistake shows device-local misconception patterns and previous scans.](docs/assets/readme/insights.png) |
| Keep the original page connected to the diagnosis. | Close the loop with targeted practice. | Review local history without creating an account. |
```

Do not replace the existing first-person introduction, uncertainty disclaimer, architecture, privacy boundary, mock/live warning, verification, or attribution.

- [ ] **Step 3: Tighten only opening-section repetition**

Read from the title through `## Architecture and data flow`. Remove only sentences that repeat the new table captions word-for-word. Keep all six numbered capabilities because they document behavior not visible in the screenshots.

- [ ] **Step 4: Run the README assertion and structural checks**

Run:

```bash
node -e 'const fs=require("fs"); const s=fs.readFileSync("README.md","utf8"); const required=["docs/assets/readme/analysis-error.png","docs/assets/readme/follow-up.png","docs/assets/readme/insights.png","docs/submission/DEMO-SCRIPT.md","docs/submission/DEVPOST.md","docs/submission/PROMETHEUS-ABOUT.md","docs/validation/2026-07-22-prometheus-readiness.md","LICENSE"]; const missing=required.filter(x=>!s.includes(x)); if(missing.length) throw new Error(`missing README links: ${missing.join(", ")}`); for(const p of required.filter(x=>!x.startsWith("docs/submission")||x.endsWith(".md"))) if(!fs.existsSync(p)) throw new Error(`missing target: ${p}`)'
git diff --check -- README.md
```

Expected: PASS with every asset/target present and no whitespace errors.

- [ ] **Step 5: Commit the README**

```bash
git add README.md
git commit -m "docs: make README judge-first"
```

---

### Task 2: Reconcile the Devpost and Prometheus story

**Files:**
- Modify: `docs/submission/DEVPOST.md`
- Modify: `docs/submission/PROMETHEUS-ABOUT.md`
- Reference: `README.md`
- Reference: `docs/validation/2026-07-22-prometheus-readiness.md`
- Reference: `server/src/pipeline/run.ts`

**Interfaces:**
- Consumes: final automated evidence, the strict transcript decision order, and the request-scoped recovery behavior.
- Produces: two ready-to-paste documents that agree with the tracked repository and retain a natural solo-builder voice.

- [ ] **Step 1: Run the stale-evidence assertion**

Run:

```bash
node -e 'const fs=require("fs"); const files=["docs/submission/DEVPOST.md","docs/submission/PROMETHEUS-ABOUT.md"]; const text=files.map(f=>fs.readFileSync(f,"utf8")); if(text.some(s=>s.includes("521"))) throw new Error("stale 521-test evidence remains"); if(text.some(s=>!s.includes("567"))) throw new Error("a submission document lacks the final 567-test evidence")'
```

Expected: FAIL because both documents still quote 521 tests and neither quotes 567.

- [ ] **Step 2: Correct Devpost technical evidence and fidelity wording**

In `docs/submission/DEVPOST.md`, replace the stale automated-evidence bullets with:

```md
- 567 automated tests passed in the final repository run: 42 shared Vitest, 142 server Vitest, 4 stock-Python importer, and 379 app Vitest tests.
- All three workspaces typechecked, Expo lint completed with zero warnings and zero errors, and the final iOS Expo export completed successfully.
```

Replace the transcription-fidelity step with copy that matches the actual strict path:

```md
3. A second image check compares every nonempty transcript with the visible ink. The strict path continues only when that check considers the transcript faithful and legible; blank or non-math work remains blocked. If the check rejects a nonempty transcript, the student can retake the photo or choose a clearly warned, request-scoped **Proceed anyway** attempt.
```

Keep the public repository link, stateless-server explanation, golden-manifest count, and unrun paid-gate disclosure.

- [ ] **Step 3: Correct the first-person Prometheus story**

In `docs/submission/PROMETHEUS-ABOUT.md`, change the automated-evidence sentence to:

```md
I created a 25-case validation set with 15 synthetic cases and 10 licensed FERMAT handwriting images, and the final repository run has 567 passing automated tests across the app, server, shared schemas, and dataset importer. That process taught me to treat model behavior as something that needs evaluation, not something I should assume will stay consistent.
```

Adjust the handwriting/fidelity paragraph so it says:

```md
A second image pass compares each nonempty transcript with the visible ink before strict grading continues. Blank or non-math work stays blocked. When that fidelity check rejects a nonempty transcript, the app asks for a new photo but also offers a clearly warned **Proceed anyway** attempt that applies to that request only.
```

Blend this into the surrounding prose rather than adding a detached feature bullet. Preserve the existing Inspiration, What it does, How I built it, Challenges, What I learned, and What’s next headings.

- [ ] **Step 4: Run evidence and tone assertions**

Run:

```bash
node -e 'const fs=require("fs"); const files=["docs/submission/DEVPOST.md","docs/submission/PROMETHEUS-ABOUT.md"]; for(const f of files){const s=fs.readFileSync(f,"utf8"); if(s.includes("521")) throw new Error(`${f}: stale count`); if(!s.includes("567")) throw new Error(`${f}: missing final count`); if(!/first|I built|I created/.test(s)) throw new Error(`${f}: solo-builder voice missing`)} const d=fs.readFileSync(files[0],"utf8"); if(!d.includes("42 shared Vitest")||!d.includes("379 app Vitest")) throw new Error("Devpost component totals missing");'
git diff --check -- docs/submission/DEVPOST.md docs/submission/PROMETHEUS-ABOUT.md
```

Expected: PASS.

- [ ] **Step 5: Commit the reconciled submission copy**

```bash
git add docs/submission/DEVPOST.md docs/submission/PROMETHEUS-ABOUT.md
git commit -m "docs: reconcile Prometheus submission copy"
```

---

### Task 3: Replace the rehearsal outline with the final demo package

**Files:**
- Modify: `docs/submission/DEMO-SCRIPT.md`
- Reference: `docs/validation/2026-07-22-prometheus-readiness.md`
- Reference: `app/app/analyze.tsx`
- Reference: `app/app/followup.tsx`
- Reference: `app/app/insights.tsx`

**Interfaces:**
- Consumes: edited portrait footage, recorded voiceover, one real live-model core run, optional visibly labeled deterministic footage.
- Produces: exact terminal setup, capture order, 120-second edit timeline, final narration, fallback rules, and upload/security checklist.

- [ ] **Step 1: Run a failing demo-package assertion**

Run:

```bash
node -e 'const s=require("fs").readFileSync("docs/submission/DEMO-SCRIPT.md","utf8"); const required=["Edited portrait footage","## Exact phone setup","## Shot list","## Final voiceover","## Edit checklist","## If the live run fails","--dev-client"]; const missing=required.filter(x=>!s.includes(x)); if(missing.length) throw new Error(`missing demo sections: ${missing.join(", ")}`)'
```

Expected: FAIL because the current document is a rehearsal outline rather than the final edited-video package.

- [ ] **Step 2: Replace the pre-recording section with exact setup**

Start the document with:

````md
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
````

Preserve Markdown fence nesting correctly by using four-backtick outer fences while editing the actual file.

- [ ] **Step 3: Add the exact shot list**

Add:

```md
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
```

Do not include the diagnosis-correction flow in the required timeline. It may be kept as optional B-roll only if the final cut remains below 2:00.

- [ ] **Step 4: Add the final voiceover verbatim**

Add:

```md
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
```

At normal narration pace this is below two minutes and leaves short visual pauses. Do not add extra technical narration during editing.

- [ ] **Step 5: Add fallback, overlay, and upload rules**

Add:

```md
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
```

- [ ] **Step 6: Run demo-package assertions**

Run:

```bash
node -e 'const fs=require("fs"); const s=fs.readFileSync("docs/submission/DEMO-SCRIPT.md","utf8"); const required=["Edited portrait footage","## Exact phone setup","## Shot list","## Final voiceover","## Edit checklist","## If the live run fails","--dev-client","REAL LIVE-MODEL RUN","Analysis time condensed","DETERMINISTIC MOCK MODE — CANNED RESPONSE (NOT LIVE MODEL)"]; const missing=required.filter(x=>!s.includes(x)); if(missing.length) throw new Error(`missing demo sections: ${missing.join(", ")}`); const voice=s.split("## Final voiceover")[1].split("## If the live run fails")[0]; const words=(voice.match(/[A-Za-zÀ-ÿ0-9’'-]+/g)||[]).length; if(words>280) throw new Error(`voiceover too long: ${words} words`); console.log(`voiceover section: ${words} words`)'
git diff --check -- docs/submission/DEMO-SCRIPT.md
```

Expected: PASS with no missing disclosure and no more than 280 words in the voiceover section.

- [ ] **Step 7: Commit the final demo package**

```bash
git add docs/submission/DEMO-SCRIPT.md
git commit -m "docs: finalize two-minute demo package"
```

---

### Task 4: Run and record the final repository-readiness audit

**Files:**
- Modify: `README.md`
- Modify: `docs/validation/2026-07-22-prometheus-readiness.md`
- Inspect: `LICENSE`
- Inspect: `server/.env.example`
- Inspect: `server/golden/FERMAT-ATTRIBUTION.md`
- Inspect: `server/golden/fermat-provenance.json`
- Inspect: `app/assets/images/*`
- Inspect: `app/assets/expo.icon/*`

**Interfaces:**
- Consumes: final tracked documentation from Tasks 1–3 and the existing application source.
- Produces: fresh automated evidence, verified local links/assets, tracked-secret results, and an honestly pending human checklist.

- [ ] **Step 1: Verify required tracked submission assets**

Run:

```bash
git ls-files --error-unmatch README.md LICENSE server/.env.example docs/submission/DEMO-SCRIPT.md docs/submission/DEVPOST.md docs/submission/PROMETHEUS-ABOUT.md docs/validation/2026-07-22-prometheus-readiness.md docs/assets/readme/analysis-error.png docs/assets/readme/follow-up.png docs/assets/readme/insights.png server/golden/FERMAT-ATTRIBUTION.md server/golden/fermat-provenance.json app/assets/images/icon.png app/assets/images/favicon.png app/assets/images/splash-icon.png
sips -g pixelWidth -g pixelHeight docs/assets/readme/analysis-error.png docs/assets/readme/follow-up.png docs/assets/readme/insights.png
```

Expected: every tracked path resolves; each screenshot reports 1206×2622.

- [ ] **Step 2: Validate local Markdown links**

Run:

```bash
node -e 'const fs=require("fs"),path=require("path"); const files=["README.md","docs/submission/DEMO-SCRIPT.md","docs/submission/DEVPOST.md","docs/submission/PROMETHEUS-ABOUT.md","docs/validation/2026-07-22-prometheus-readiness.md"]; const failures=[]; for(const file of files){const text=fs.readFileSync(file,"utf8"); for(const match of text.matchAll(/\[[^\]]*\]\((?!https?:|mailto:|#)([^)#]+)(?:#[^)]+)?\)/g)){const target=path.resolve(path.dirname(file),decodeURIComponent(match[1])); if(!fs.existsSync(target)) failures.push(`${file} -> ${match[1]}`)}} if(failures.length) throw new Error(`broken local links:\n${failures.join("\n")}`); console.log("local Markdown links resolve")'
```

Expected: PASS.

- [ ] **Step 3: Scan the tracked tree for credentials**

Run:

```bash
git grep -nE 'sk-[A-Za-z0-9_-]{20,}|-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----' -- . ':!package-lock.json'
```

Expected: exit 1 with no matches. The placeholders `OPENAI_API_KEY=sk-...` in `server/.env.example` and the historical plan are acceptable because they are not real key-shaped values.

Also run:

```bash
git ls-files server/.env .env
```

Expected: no output.

- [ ] **Step 4: Run the complete automated gate**

Run:

```bash
npm test
npm run typecheck
npm run lint -w app
(cd app && npx expo export --platform ios --output-dir /tmp/snap-a-mistake-prometheus-final)
git diff --check
```

Expected: every command exits 0. Record the exact totals printed by `npm test`; do not assume 567 if the test set changed.

- [ ] **Step 5: Reconcile the final evidence date and totals**

Update `README.md` and `docs/validation/2026-07-22-prometheus-readiness.md` to say the final run occurred on July 28, 2026 and to quote the exact test total/component breakdown from Step 4. Record the final export path as:

```text
/tmp/snap-a-mistake-prometheus-final
```

Do not change the focused live-model claims, the unrun paid-golden disclosure, or any unchecked phone/rehearsal box.

- [ ] **Step 6: Re-run evidence-only checks after documentation changes**

Run:

```bash
node -e 'const fs=require("fs"); const files=["README.md","docs/submission/DEVPOST.md","docs/submission/PROMETHEUS-ABOUT.md","docs/validation/2026-07-22-prometheus-readiness.md"]; const joined=files.map(f=>fs.readFileSync(f,"utf8")).join("\n"); if(joined.includes("521")) throw new Error("stale 521 total remains"); if(!joined.includes("July 28, 2026")) throw new Error("final evidence date missing");'
git diff --check
git status --short
```

Expected: no stale count, no whitespace errors, and only the intended tracked documentation plus the user-owned untracked `.expo/` and `tsconfig.json`.

- [ ] **Step 7: Commit the final audit evidence**

```bash
git add README.md docs/validation/2026-07-22-prometheus-readiness.md
git commit -m "docs: record final Prometheus verification"
```

---

### Task 5: Synchronize and verify the public repository

**Files:**
- No source files should change.
- Inspect: local `main`, `origin/main`, and the public GitHub repository.

**Interfaces:**
- Consumes: the fully verified local submission commit and explicit user approval to push.
- Produces: a public repository whose head, README, screenshots, license, and internal links match the verified local package.

- [ ] **Step 1: Confirm the local synchronization candidate**

Run:

```bash
git status --short
git branch --show-current
git log --oneline origin/main..main
git rev-parse main
```

Expected: branch `main`; only the known untracked `.expo/` and `tsconfig.json`; a visible list of commits not yet public.

- [ ] **Step 2: Check GitHub authentication and repository metadata**

Run:

```bash
gh auth status
gh repo view Johaan-Mannanal/snap-a-mistake --json nameWithOwner,visibility,url,defaultBranchRef,licenseInfo
```

Expected: valid authentication, `visibility: PUBLIC`, default branch `main`, and MIT license metadata. If authentication is invalid, pause and ask the user to complete:

```bash
gh auth login -h github.com -p https -w
```

- [ ] **Step 3: Request final push approval**

Show the user:

- local head SHA;
- remote head SHA;
- commit count to push;
- verification summary;
- statement that no app hosting or API key is included.

Do not run `git push` until the user explicitly approves this external mutation.

- [ ] **Step 4: Push verified local main**

After approval, run:

```bash
git push origin main
git fetch origin main
test "$(git rev-parse main)" = "$(git rev-parse origin/main)"
```

Expected: push succeeds and both SHAs match.

- [ ] **Step 5: Verify the public presentation**

Run:

```bash
gh repo view Johaan-Mannanal/snap-a-mistake --web
gh api repos/Johaan-Mannanal/snap-a-mistake/readme --jq '.html_url'
```

In a signed-out browser, confirm:

- repository visibility is public;
- the opening pitch and all three screenshots render;
- Demo script, Devpost copy, Project story, Validation record, and MIT license links open;
- the displayed default-branch commit matches local `main`;
- no secret, local `.env`, private photo, or recording artifact is visible.

- [ ] **Step 6: Record the final handoff**

Report:

- public repository URL;
- final commit SHA;
- fresh automated totals;
- iOS export result;
- remaining human-only actions: record/edit video, run the phone checklist, upload, verify signed-out playback, complete the Google form, and submit on Devpost.
