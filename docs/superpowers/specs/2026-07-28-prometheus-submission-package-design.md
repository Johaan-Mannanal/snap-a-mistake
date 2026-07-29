# Prometheus Submission Package Design

**Date:** July 28, 2026
**Submission target:** Prometheus July AI Challenge
**Demo format:** Edited portrait phone footage with recorded voiceover
**Direction:** Judge-first, technically honest, real-first hybrid

## Goal

Prepare the public Snap-a-Mistake repository and its submission materials so a judge can understand the educational problem, see the product working, inspect credible technical evidence, and reproduce the project without encountering stale claims or missing instructions.

The package must remain honest about the distinction between automated tests, focused paid checks, the unrun full paid golden gate, and physical-phone checks that still require a human operator.

## Audience and first impression

The primary audience is a hackathon judge with limited time. In the first screenful of the README, the judge should learn:

1. Snap-a-Mistake finds the first unsupported step in photographed handwritten math.
2. It explains the likely misconception and creates a similar follow-up problem.
3. The product is a polished mobile workflow rather than a general tutor chat.
4. The source, demo instructions, evidence, and limitations are inspectable.

The secondary audience is a technical reviewer who wants architecture, local setup, privacy boundaries, tests, provenance, and licensing.

## README design

Keep the existing first-person opening and uncertainty disclaimer. Add a compact visual sequence immediately after the introduction using the three already committed screenshots:

- `docs/assets/readme/analysis-error.png`
- `docs/assets/readme/follow-up.png`
- `docs/assets/readme/insights.png`

Each image receives a short descriptive caption. The layout must render reliably on GitHub without custom HTML that becomes cramped on mobile. A simple Markdown table or individually centered images is acceptable only after checking the rendered dimensions and readability.

Add a compact navigation line linking to:

- the two-minute demo script;
- ready-to-paste Devpost copy;
- the Prometheus story;
- the validation record;
- the MIT license.

Preserve the existing architecture, privacy, local-run, mock/live distinction, verification, and attribution sections. Tighten repetition where the screenshots or quick links make it unnecessary, but do not remove safeguards or limitations.

The README must state the final verified automated count rather than a historical count. It must not imply that the full paid 25-image golden gate or the pending phone checklist passed.

## Submission-copy design

Update both submission documents so they agree with the final repository:

- `docs/submission/DEVPOST.md`
- `docs/submission/PROMETHEUS-ABOUT.md`

Required corrections:

- replace the stale 521-test evidence with the final count printed by a fresh verification run;
- keep the component totals consistent with that run;
- describe the image-to-transcript fidelity check and request-scoped **Proceed anyway** behavior accurately;
- avoid saying a blurry image is always rejected when a nonempty transcript can be independently verified;
- preserve the solo-builder, first-person voice;
- preserve the distinction between repository-reproducible evidence and paid/model/device evidence;
- retain the public repository link.

The copy should sound natural and concise, not like a generated feature inventory. Claims must be traceable to source, tests, validation evidence, or a clearly pending checklist.

## Demo package design

Rewrite `docs/submission/DEMO-SCRIPT.md` for an edited two-minute video with recorded voiceover.

### Recording strategy

Use a real-first hybrid:

- The core capture, live-model analysis, and first-break result come from a genuine live server run.
- Dead analysis time may be cut or sped up.
- A persistent **REAL LIVE-MODEL RUN** label remains visible through the live segment.
- Any cut or speed-up also displays **Analysis time condensed**.
- Deterministic mock footage is optional and used only when a specific state cannot be captured reliably in the recording window.
- Every mock segment carries a persistent **DETERMINISTIC MOCK MODE — CANNED RESPONSE (NOT LIVE MODEL)** label.
- Mock footage must never be presented as model evidence.

### Script structure

The document will separate four concerns:

1. **Before recording:** exact terminal commands, phone/network preparation, sample-work preparation, notification/privacy cleanup, and overlay text.
2. **Shot list:** what to capture on the phone, in order, with target clip lengths and transition notes.
3. **Voiceover:** a polished continuous narration with timing checkpoints and a target duration below 120 seconds.
4. **Edit and upload checklist:** required labels, captioning, framing, audio, security review, duration, and signed-out playback.

### Story arc

The final video follows this judge-oriented sequence:

1. **Problem:** final-answer checkers do not identify where reasoning first broke.
2. **Capture:** photograph one handwritten problem and review the page.
3. **AI pipeline:** show the real analysis progress and briefly explain transcript fidelity plus diagnosis verification.
4. **Learning feedback:** show the exact step on the original image, misconception, and readable explanation.
5. **Learning loop:** show the similar problem and hint; do not automatically open the camera before the student selects **Check my work**.
6. **Continuity:** briefly show Patterns and Previous scans as device-local history.
7. **Close:** restate the educational outcome: find the first break, explain it in context, and practice the same idea again.

The correction feature may appear if it can be shown cleanly without crowding the two-minute story. It is secondary to the core first-break and follow-up loop.

### Capture fallback

Prepare the live result before the final recording session. If a live request fails during capture:

1. retry the genuine run once;
2. if necessary, use previously recorded genuine live footage from the same build;
3. use deterministic footage only as a visibly labeled UI demonstration;
4. never remove or obscure the mode label to make a mock result appear live.

## Repository-readiness audit

The final pass must verify:

- root README, MIT license, tracked `server/.env.example`, screenshots, app icons, golden attribution, and provenance are present;
- no tracked API key, private key, credential, private photo, or recording artifact is exposed;
- all README and submission links resolve within the repository;
- local setup commands match current scripts and workspace paths;
- test totals match fresh output everywhere they are quoted;
- automated tests, all-workspace typecheck, Expo lint, iOS export, and `git diff --check` pass;
- only intended files are changed;
- user-owned untracked `.expo/` and root `tsconfig.json` are not silently committed or deleted.

## Public-repository synchronization

Local `main` is currently ahead of `origin/main`, so the public repository is not yet the submission source of truth.

After the submission-package changes are reviewed, committed, and verified:

1. restore valid GitHub authentication or otherwise confirm push access;
2. push local `main` to `origin/main`;
3. verify the repository is public;
4. open the public README and check screenshots and internal links;
5. confirm the public head matches the final local commit;
6. perform a tracked-secret scan on the final committed tree.

Pushing is an external mutation and requires the user's explicit approval if it has not already been given for the final package.

## Out of scope

- Hosting the Fastify server for judge use.
- Publishing an App Store or Play Store build.
- Claiming the unrun full paid golden gate passed.
- Marking phone, accessibility, rehearsal, or signed-out video checks complete without a human performing them.
- Adding new product features or redesigning the app.
- Committing the user-owned root `.expo/` directory or root `tsconfig.json`.

## Acceptance criteria

The submission package is ready for the user’s final human recording and upload steps when:

- a judge can understand the product and see the key workflow from the README’s opening section;
- README, Devpost copy, Prometheus story, demo script, and validation record agree on current behavior and evidence;
- the demo document contains executable commands, a shot list, a timed voiceover, fallback rules, and a final security/upload checklist;
- all repository-reproducible verification commands pass on the final commit;
- pending paid/device/rehearsal work remains explicitly unchecked;
- the tracked tree contains no credential;
- the public repository is synchronized and renders correctly after an approved push.
