# Snap-a-Mistake Submission Packaging Design

**Date:** 2026-07-21
**Owner:** Johaan Mannanal
**Status:** Approved design
**Target:** OpenAI Build Week — Education

## Goal

Turn the reviewed Snap-a-Mistake branch into a judge-ready public submission
without expanding product scope. The package must make the working product,
Codex development process, GPT-5.6 architecture, educational value, setup path,
and remaining manual submission actions obvious within a few minutes.

## Chosen approach

Use a judge-first package: concise public documentation, a permissive code
license, ready-to-paste Devpost copy, a timed demo script, and a public GitHub
repository. Do not spend the remaining submission window on optional press-kit
graphics, another paid calibration run, deployment, or new product features.

## Public artifacts

### Root `LICENSE`

- License original Snap-a-Mistake code under the MIT License.
- Copyright line: `Copyright (c) 2026 Johaan Mannanal`.
- Do not relicense third-party material.
- State in the README that the curated FERMAT images remain licensed under
  CC BY 4.0 and link to `server/golden/FERMAT-ATTRIBUTION.md`.
- Preserve `app/LICENSE`, which covers the Expo-derived template material.

### Root `README.md`

The README is the judge entry point and must be accurate at publication time.
It will:

- use the actual July 21, 2026, 5:00 p.m. PDT deadline and the attached Devpost
  criteria;
- identify Education as the submission category;
- lead with the student problem and the snap-to-feedback product loop;
- describe the GPT-5.6 vision, analysis, and verifier stages;
- add a prominent `Built with Codex and GPT-5.6` section explaining how Codex
  accelerated design, TDD implementation, independent review, real-handwriting
  curation, audit diagnosis, and prompt hardening;
- call out key decisions: semantic anchors instead of brittle step indices,
  exact canonical tags, a verifier that softens disagreement, stateless backend,
  and local-only learning history;
- provide a judge quickstart that works without an API key via the mock server;
- retain live-pipeline, test, typecheck, and Expo instructions;
- report the latest paid FERMAT result as 8/10, including the one canonical-tag
  mismatch and one truncated-JSON failure;
- remove false statements that the branch is already merged or that paid
  semantic validation has not run;
- describe the required demo as public, under three minutes, and narrated to
  cover both Codex and GPT-5.6;
- link the license, FERMAT attribution, Devpost submission copy, and demo script.

### `docs/submission/DEVPOST.md`

Provide copy that can be pasted into Devpost with minimal editing:

- project title and one-line tagline;
- Education category;
- concise problem, solution, how-it-works, impact, novelty, and technical
  implementation sections;
- an explicit account of Codex acceleration and GPT-5.6 usage;
- test and real-handwriting evidence stated without overstating reliability;
- repository URL `https://github.com/Johaan-Mannanal/snap-a-mistake`;
- a final manual-action checklist for the public YouTube URL, the Codex
  `/feedback` session ID, eligibility confirmation, and Devpost form submission.

The document must not invent a video URL, feedback ID, user study, deployment,
or device-verification result.

### `docs/submission/DEMO-SCRIPT.md`

Provide a timed script targeting 2 minutes 30 seconds, safely below the
three-minute limit. It will include:

1. the student pain point;
2. capture of incorrect handwritten work;
3. the exact-step overlay, misconception label, and explanation;
4. the easier follow-up and retry loop;
5. the Insights screen;
6. a concise architecture explanation naming GPT-5.6;
7. a concise build-process explanation naming Codex;
8. an Education-impact close.

The script will include a fallback recording path using the mock server so a
network or model failure cannot ruin the take. It will clearly distinguish
spoken narration from on-screen actions.

## Publication workflow

1. Implement and review the documentation and license changes on
   `codex/fermat-golden-set`.
2. Run the complete no-cost verification gate and public-artifact scans.
3. Commit the submission package.
4. Authenticate GitHub CLI as `Johaan-Mannanal`.
5. Create the public repository `Johaan-Mannanal/snap-a-mistake` if it does not
   already exist; if it exists, stop and inspect it before changing anything.
6. Add `origin` only after resolving its exact URL.
7. Publish the reviewed HEAD as the remote `main` branch.
8. Confirm repository visibility, default branch, README rendering, license
   detection, and absence of secrets or ignored data.

Publishing is authorized by the owner. Creating a YouTube upload, fabricating a
`/feedback` value, or submitting the Devpost form is not delegated; those remain
explicit owner actions.

## Verification and safety

Before publication:

- run `npm test` and `npm run typecheck`;
- run `git diff --check` for the complete branch range;
- confirm the worktree is clean after commit;
- confirm no `.env`, API token, Hugging Face token, audit JSON, Parquet shard,
  cache, `.superpowers`, or temporary artifact is tracked;
- confirm all ten FERMAT photos have matching attribution/provenance records;
- confirm the root license and README describe third-party licensing correctly;
- confirm every command and status claim in the README matches the repository;
- inspect the final public GitHub repository after push.

If GitHub authentication fails, the repository name is occupied, or a remote
already contains unrelated history, stop before overwriting anything and report
the exact blocker.

## Success criteria

The package is complete when judges can open a public repository, understand the
idea and Codex/GPT-5.6 implementation, run the mock experience without secrets,
find accurate live setup and test instructions, verify licensing and FERMAT
attribution, and copy the prepared submission/video material. The only remaining
owner actions will be recording and uploading the public demo, obtaining the
Codex `/feedback` session ID, confirming eligibility, and submitting the Devpost
form before the deadline.
