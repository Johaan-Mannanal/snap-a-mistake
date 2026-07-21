# Submission Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a judge-ready, openly licensed Snap-a-Mistake repository with accurate setup documentation, ready-to-paste Devpost copy, and a narrated demo script.

**Architecture:** Treat the repository as the submission artifact: the root README is the judge entry point, focused files under `docs/submission/` contain form copy and the timed video plan, and the root license establishes the code’s reuse terms while preserving the FERMAT dataset’s separate license. Publication happens only after a complete no-cost test, provenance, secret, and artifact gate.

**Tech Stack:** Markdown, MIT License, Git, GitHub CLI, npm workspaces, Vitest, TypeScript, Python unittest.

## Global Constraints

- Target OpenAI Build Week’s Education category and July 21, 2026, 5:00 p.m. PDT deadline.
- License original Snap-a-Mistake code under MIT with `Copyright (c) 2026 Johaan Mannanal`.
- Keep FERMAT photographs under CC BY 4.0 and preserve `server/golden/FERMAT-ATTRIBUTION.md` and provenance.
- Preserve `app/LICENSE` as the Expo-derived template license.
- Do not claim a deployment, user study, device pass, YouTube URL, or `/feedback` ID that does not exist.
- Report the latest FERMAT gate truthfully as 8/10: one correct-step/canonical-tag mismatch and one truncated-JSON pipeline failure.
- Do not run another paid model or golden command.
- Do not track `.env`, credentials, audit JSON, Parquet shards, caches, `.superpowers`, or temporary artifacts.
- Publish the reviewed HEAD to the new public repository’s `main` branch without force-pushing or overwriting unrelated history.

---

### Task 1: License the project and make the README judge-ready

**Files:**
- Create: `LICENSE`
- Modify: `README.md`

**Interfaces:**
- Consumes: existing setup commands, architecture, and FERMAT attribution.
- Produces: the public entry point and licensing links consumed by Task 2 and GitHub’s repository renderer.

- [ ] **Step 1: Record the pre-change documentation contract failures**

Run:

```bash
test -f LICENSE
rg -q '^## Built with Codex and GPT-5.6$' README.md
rg -q 'July 21, 2026.*5:00 p.m. PDT' README.md
rg -q '8/10' README.md
rg -q '^## License and data attribution$' README.md
```

Expected: at least `test -f LICENSE` and the Codex-section check fail, proving the public package is incomplete.

- [ ] **Step 2: Add the root MIT license**

Create `LICENSE` with the standard MIT text and this exact heading:

```text
MIT License

Copyright (c) 2026 Johaan Mannanal
```

Include the standard permission grant, copyright-notice inclusion condition, and warranty/liability disclaimer without modifying their legal wording.

- [ ] **Step 3: Correct the README opening and challenge facts**

Keep the product title and one-paragraph pitch, then replace the obsolete hackathon paragraph with:

```markdown
Built for **OpenAI Build Week** in the **Education** category. The submission
deadline is July 21, 2026 at 5:00 p.m. PDT. The project is evaluated on
technological implementation, coherent product design, potential impact, and
quality of the idea.
```

Do not retain the July 30 deadline, 25-point rubric, or two-minute requirement.

- [ ] **Step 4: Add the Codex and GPT-5.6 build story**

Add this section after the architecture overview, preserving the existing model-specific diagram:

```markdown
## Built with Codex and GPT-5.6

Codex was the engineering partner across the project: it helped turn the idea
into reviewed design specs, execute the backend and mobile plans with test-driven
development, curate and provenance-check a real-handwriting regression set, and
run independent task and whole-branch reviews. When paid golden runs exposed
brittle line-number expectations, Codex analyzed sanitized audits and replaced
them with semantic math anchors.

GPT-5.6 powers the product itself. A vision pass transcribes handwriting into
positioned steps, a reasoning pass finds the first broken step and creates
targeted feedback, and an independent verifier softens the UI when the diagnosis
is uncertain.

Key decisions made during that workflow:

- semantic math anchors instead of segmentation-dependent step numbers;
- one exact canonical misconception tag per error;
- a verifier that prefers uncertainty over a false accusation;
- a stateless backend and on-device-only learning history;
- a zero-cost mock path so judges can experience every UI state without keys.
```

- [ ] **Step 5: Add a zero-cost judge quickstart**

Before the full development commands, add:

````markdown
### Judge quickstart — no API key

```bash
npm install
npm run mock -w server
# In a second terminal:
cd app && EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start
```

Use `MOCK=correct npm run mock -w server` or replace `correct` with `error`,
`suspect`, `unreadable`, or `not-math` to exercise every response state.
````

Keep the live server, test, typecheck, golden, and Expo instructions, but label golden commands as paid.

- [ ] **Step 6: Make status and next steps truthful**

State that the reviewed branch is ready for publication, not already merged. Record:

```markdown
- Latest paid FERMAT validation: **8/10**. Eight real-handwriting cases passed
  end-to-end; one selected the correct error step but disagreed with the strict
  canonical tag, and one returned truncated JSON after retry.
```

Keep on-device verification, stable demo hosting, video recording, and form submission as remaining work. Describe the video as public, narrated, and under three minutes.

- [ ] **Step 7: Add the license and attribution boundary**

End with:

```markdown
## License and data attribution

Original Snap-a-Mistake code is available under the [MIT License](LICENSE).
The curated FERMAT photographs remain under CC BY 4.0; see
[FERMAT attribution](server/golden/FERMAT-ATTRIBUTION.md) and
[provenance](server/golden/fermat-provenance.json). The Expo-derived app
template retains its notice in [app/LICENSE](app/LICENSE).
```

- [ ] **Step 8: Verify the README contract**

Run:

```bash
test -f LICENSE
rg -q '^## Built with Codex and GPT-5.6$' README.md
rg -q 'July 21, 2026.*5:00 p.m. PDT' README.md
rg -q '8/10' README.md
rg -q '^### Judge quickstart — no API key$' README.md
rg -q '^## License and data attribution$' README.md
! rg -n 'July 30|25 pts|≤2 min|merged to `main`|has not yet received a paid validation' README.md
git diff --check
```

Expected: all commands exit successfully and the prohibited-copy scan has no output.

- [ ] **Step 9: Commit Task 1**

```bash
git add LICENSE README.md
git commit -m "docs: make README judge-ready"
```

---

### Task 2: Prepare Devpost copy and the narrated demo script

**Files:**
- Create: `docs/submission/DEVPOST.md`
- Create: `docs/submission/DEMO-SCRIPT.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: the README’s verified product, architecture, testing, and licensing claims.
- Produces: paste-ready submission copy and a recording plan that the owner can execute without inventing missing external links.

- [ ] **Step 1: Write the Devpost content contract before the files exist**

Run:

```bash
test -f docs/submission/DEVPOST.md
test -f docs/submission/DEMO-SCRIPT.md
rg -q 'Codex' docs/submission/DEVPOST.md
rg -q 'GPT-5.6' docs/submission/DEVPOST.md
rg -q '2:30' docs/submission/DEMO-SCRIPT.md
```

Expected: the missing-file checks fail.

- [ ] **Step 2: Create the Devpost submission copy**

Create `docs/submission/DEVPOST.md` with these exact facts and sections:

```markdown
# Devpost Submission Copy

## Project

**Title:** Snap-a-Mistake

**Tagline:** Photograph handwritten math and find the first step where the reasoning broke—not just the final wrong answer.

**Category:** Education

## What it does

Snap-a-Mistake turns a photo of handwritten algebra or calculus into step-level
feedback. It transcribes the work, identifies the first incorrect step, names
the misconception, explains why it failed, and creates an easier follow-up
problem. The mobile app overlays the diagnosis on the original page and tracks
recurring misconception patterns locally on the student’s device.

## The problem

Students often learn that an answer is wrong without learning where their
reasoning diverged. A final-answer checker cannot distinguish a sign slip from
a misunderstood rule, and generic explanations do not create a focused next
practice step.

## How it works

1. GPT-5.6 vision converts the page into ordered steps and vertical positions.
2. GPT-5.6 reasoning finds the first broken step, applies a controlled
   misconception label, and generates a targeted explanation and follow-up.
3. An independent verifier checks the diagnosis; disagreement becomes a softer
   “suspect” state instead of a confident accusation.
4. The Expo app renders the line overlay, step cards, retry loop, and local
   misconception insights.

## Built with Codex

Codex helped move the project from concept to a reviewed implementation. It
developed design specs and execution plans, drove test-first backend and mobile
tasks, performed independent code reviews, curated a licensed handwriting
regression set, and diagnosed failures from sanitized paid-run audits. That
audit work led to a key improvement: semantic math anchors replaced brittle
line indices when page segmentation changed between model runs.

## Why it is different

The product focuses on the earliest reasoning failure and closes the learning
loop with easier targeted practice. It combines the original handwritten
context, a controlled misconception vocabulary, independent verification, and
private on-device trend tracking rather than acting as another answer generator.

## Technical evidence

- TypeScript monorepo with Expo, Fastify, Zod, SQLite, and shared API schemas.
- Three-stage GPT-5.6 pipeline with structured-output validation and correction retry.
- More than 100 Vitest checks plus four stock-Python importer regressions.
- Twenty-five golden cases, including ten licensed FERMAT handwriting images.
- Latest paid FERMAT gate: 8/10; the two remaining misses are documented rather
  than hidden.
- Public repository: https://github.com/Johaan-Mannanal/snap-a-mistake

## Potential impact

Snap-a-Mistake gives students actionable feedback while the reasoning is still
fresh and gives recurring mistakes a visible pattern. The same workflow could
support teachers reviewing common misconceptions without requiring student
accounts or server-side storage of learning history.

## Manual submission checklist

- Record and upload the narrated public YouTube demo using `DEMO-SCRIPT.md`.
- Put the resulting YouTube URL in Devpost.
- Run `/feedback` in the primary Codex task and put that session ID in Devpost.
- Confirm age, territory, and all Official Rules eligibility requirements.
- Confirm the repository is public and submit under Education before 5:00 p.m. PDT.
```

- [ ] **Step 3: Create the 2:30 demo script**

Create `docs/submission/DEMO-SCRIPT.md` with this timed structure:

```markdown
# Snap-a-Mistake Demo Script — 2:30 Target

Record vertically from the phone when showing the app. Use the mock server for
the primary take so every state is deterministic; show the real-handwriting
8/10 result as an evidence card or repository cutaway.

## 0:00–0:15 — Problem

**On screen:** Handwritten work, then Snap-a-Mistake home screen.

**Say:** “A wrong answer tells a student almost nothing. Snap-a-Mistake finds
the first handwritten step where the reasoning broke, explains the
misconception, and gives the student a smaller problem to try next.”

## 0:15–0:45 — Capture and analysis

**On screen:** Capture an intentionally incorrect problem; show Reading,
Checking, and Verifying progress stages.

**Say:** “I take one photo. GPT-5.6 vision transcribes the page into positioned
steps, a reasoning pass finds the earliest error, and a separate verifier checks
the diagnosis before the app displays it.”

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

**On screen:** Repository architecture, tests, semantic-anchor test, 8/10 result.

**Say:** “I built this with Codex as an engineering partner. It helped turn the
idea into design specs, drive test-first implementation and independent reviews,
curate a licensed handwriting set, and diagnose paid evaluations. When model
segmentation shifted, Codex replaced brittle line numbers with semantic math
anchors. The repository now has over one hundred automated checks, and eight of
ten real-handwriting cases pass the strict end-to-end gate.”

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
```

- [ ] **Step 4: Link the completed submission kit from the README**

Add a short `Submission kit` paragraph that links
`docs/submission/DEVPOST.md` as ready-to-paste form copy and
`docs/submission/DEMO-SCRIPT.md` as the timed recording plan. Do this only after
both target files exist so every committed README link resolves.

- [ ] **Step 5: Verify submission-copy claims and timing**

Run:

```bash
rg -q '^\*\*Category:\*\* Education$' docs/submission/DEVPOST.md
rg -q 'Codex' docs/submission/DEVPOST.md
rg -q 'GPT-5.6' docs/submission/DEVPOST.md
rg -q '8/10' docs/submission/DEVPOST.md
rg -q 'https://github.com/Johaan-Mannanal/snap-a-mistake' docs/submission/DEVPOST.md
rg -q '^## 2:20–2:30 — Close$' docs/submission/DEMO-SCRIPT.md
rg -q 'Codex' docs/submission/DEMO-SCRIPT.md
rg -q 'GPT-5.6' docs/submission/DEMO-SCRIPT.md
! rg -n 'insert URL|user study|deployed at|fill this in' docs/submission
git diff --check
```

Expected: all positive checks pass and the unsupported-claim scan has no output.

- [ ] **Step 6: Commit Task 2**

```bash
git add README.md docs/submission/DEVPOST.md docs/submission/DEMO-SCRIPT.md
git commit -m "docs: prepare Devpost submission kit"
```

---

### Task 3: Run the public-artifact and no-cost release gate

**Files:**
- Review: `README.md`
- Review: `LICENSE`
- Review: `docs/submission/DEVPOST.md`
- Review: `docs/submission/DEMO-SCRIPT.md`
- Review: `server/golden/FERMAT-ATTRIBUTION.md`
- Review: `server/golden/fermat-provenance.json`

**Interfaces:**
- Consumes: Tasks 1–2’s public artifacts and the complete reviewed application branch.
- Produces: a clean, evidence-backed commit ready to publish without another paid call.

- [ ] **Step 1: Run all automated tests and typechecks**

Run:

```bash
npm test
npm run typecheck
```

Expected: shared, server, importer, and app tests pass with zero failures; all three TypeScript workspaces typecheck.

- [ ] **Step 2: Run documentation and licensing checks**

Run every contract command from Tasks 1 and 2, then:

```bash
head -n 3 LICENSE
rg -n 'MIT|CC BY 4.0|app/LICENSE' README.md
test -f server/golden/FERMAT-ATTRIBUTION.md
jq -e '.cases | length == 10' server/golden/fermat-provenance.json
```

Expected: MIT heading and Johaan copyright are visible; all three license boundaries are documented; attribution exists; provenance contains ten records.

- [ ] **Step 3: Run secret and tracked-artifact scans**

Run:

```bash
git ls-files .superpowers
git ls-files | awk '/(^|\/)\.env$/ || /\.parquet$/ || /\.partial$/ || /__pycache__/ || /\.py[co]$/ || /golden-audit.*\.json$/ { print }'
rg -l --hidden -g '!node_modules/**' -g '!.git/**' 'sk-(proj-)?[A-Za-z0-9_-]{20,}|hf_[A-Za-z0-9]{20,}' .
```

Expected: all three commands produce no output. `server/.env.example` remains the intentional tracked template.

- [ ] **Step 4: Run branch and provenance integrity checks**

Run:

```bash
git diff --check ee1310a..HEAD
npm run test:vitest -w server -- fermat.test.ts fermat-audit-replay.test.ts
git status --short
```

Expected: full-range diff check is silent, focused integrity/privacy tests pass, and status is clean.

- [ ] **Step 5: Conduct independent final review**

Review the complete range from the submission-package design commit through Task 2. Reject publication for any Critical or Important finding, unsupported claim, missing license boundary, broken command, secret, or tracked internal artifact. Fix all findings, repeat Tasks 3.1–3.4, and commit fixes with:

```bash
git commit -m "docs: close submission review findings"
```

Expected: final reviewer returns ready to publish with no Critical or Important findings.

---

### Task 4: Create and verify the public GitHub repository

**Files:**
- External: `https://github.com/Johaan-Mannanal/snap-a-mistake`
- Modify repository configuration: Git remote `origin`

**Interfaces:**
- Consumes: Task 3’s clean reviewed HEAD.
- Produces: a public GitHub repository whose default `main` branch exactly matches that HEAD.

- [ ] **Step 1: Verify GitHub identity**

Run:

```bash
gh auth status
gh api user --jq '.login'
```

Expected: authenticated login is exactly `Johaan-Mannanal`. If not, stop before repository creation.

- [ ] **Step 2: Resolve repository existence without mutation**

Run:

```bash
gh repo view Johaan-Mannanal/snap-a-mistake --json nameWithOwner,visibility,defaultBranchRef,url
```

Expected for a new repository: GitHub reports it does not exist. If it exists, inspect its visibility and branch history and stop before adding a remote or pushing.

- [ ] **Step 3: Create the public repository**

Run only when Step 2 confirms the name is unused:

```bash
gh repo create Johaan-Mannanal/snap-a-mistake \
  --public \
  --description "Photograph handwritten math and find the first step where the reasoning broke."
```

Expected: GitHub returns `https://github.com/Johaan-Mannanal/snap-a-mistake`.

- [ ] **Step 4: Add the resolved remote and publish reviewed HEAD as main**

Run:

```bash
git remote add origin https://github.com/Johaan-Mannanal/snap-a-mistake.git
git push -u origin HEAD:main
```

Expected: a new remote `main` branch is created without force, and the push reports the exact current HEAD.

- [ ] **Step 5: Verify the public repository**

Run:

```bash
gh repo edit Johaan-Mannanal/snap-a-mistake --default-branch main
gh repo view Johaan-Mannanal/snap-a-mistake --json nameWithOwner,visibility,defaultBranchRef,url,licenseInfo
git ls-remote origin refs/heads/main
git rev-parse HEAD
```

Expected:

- visibility is `PUBLIC`;
- default branch is `main`;
- URL is `https://github.com/Johaan-Mannanal/snap-a-mistake`;
- GitHub detects the MIT license;
- remote `main` and local HEAD hashes are identical.

- [ ] **Step 6: Inspect the rendered public artifact and hand off owner actions**

Open the repository in a signed-out browser and confirm README rendering, setup commands, submission links, license display, and FERMAT attribution. Report these remaining owner actions exactly:

1. record and publicly upload the narrated video;
2. verify the YouTube link signed out and add it to Devpost;
3. run `/feedback` in the primary Codex task and add its session ID;
4. confirm eligibility and submit under Education before 5:00 p.m. PDT.

Do not claim the Devpost submission itself is complete until those actions are performed.
