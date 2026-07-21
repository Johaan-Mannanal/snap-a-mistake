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
