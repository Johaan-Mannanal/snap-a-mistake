# Devpost Submission Copy

## Project

**Title:** Snap-a-Mistake

**Tagline:** Photograph handwritten math and find the first step where the reasoning broke—not just the final wrong answer.

## What it does

Snap-a-Mistake turns a photo of handwritten algebra or calculus into step-level
feedback. It transcribes the work, identifies the first incorrect step, names
the misconception, explains why it failed, and creates an easier follow-up
problem. The mobile app overlays the diagnosis on the original page and tracks
recurring misconception patterns locally on the student’s device.

## The educational problem

Students often learn that an answer is wrong without learning where their
reasoning first diverged. A final-answer checker cannot distinguish a sign slip
from a misunderstood rule, and generic explanations do not create a focused
next practice step.

## Exact-first-break learning loop

Snap-a-Mistake focuses feedback on the earliest unsupported step rather than
only the final answer. It explains the misconception in the student's original
context, then creates a smaller targeted problem. The student can retry and see
a verified correct state, turning diagnosis into an immediate learning loop.

## How it works

1. A multimodal transcription pass converts the page into ordered steps and
   vertical positions.
2. A reasoning diagnosis pass finds the first broken step, applies a controlled
   misconception label, and generates a targeted explanation and follow-up.
3. An independent verifier checks the diagnosis; disagreement becomes a softer
   “suspect” state instead of a confident accusation.
4. The Expo app renders the line overlay, step cards, retry loop, and local
   misconception insights.

## Why it is different

The product focuses on the earliest reasoning failure and closes the learning
loop with easier targeted practice. It combines the original handwritten
context, a controlled misconception vocabulary, independent verification, and
private on-device trend tracking rather than acting as another answer generator.

## Technical evidence

- TypeScript monorepo with Expo, Fastify, Zod, SQLite, and shared API schemas.
- Three-stage model pipeline with structured-output validation and correction retry.
- 150 automated tests were passing as of July 22, including four stock-Python
  importer regressions.
- Twenty-five golden cases, including ten licensed FERMAT handwriting images.
- Latest paid FERMAT gate: 8/10; the two remaining misses are documented rather
  than hidden.
- Public repository: https://github.com/Johaan-Mannanal/snap-a-mistake

## Potential impact

Snap-a-Mistake gives students actionable feedback while the reasoning is still
fresh and gives recurring mistakes a visible pattern. The same workflow could
support teachers reviewing common misconceptions without requiring student
accounts or server-side storage of learning history.

## Privacy posture

The server is stateless. Snap-a-Mistake has no accounts and does not store
student learning history on a server; recurring trends are kept in on-device
SQLite.

## Prometheus submission checklist

- [ ] Record and upload the narrated video using `DEMO-SCRIPT.md`. Its core
  diagnosis is a real live-model result; label any mock footage as canned.
- [ ] Confirm the Google form required for the submission is complete.
- [ ] Confirm all eligibility requirements in the official rules.
- [ ] Confirm the repository is public.
- [ ] Open the submitted video in a signed-out browser and verify full playback,
  audio, and captions.
- [ ] Submit by July 29 operationally, ahead of the official July 30, 2026, 8:45 p.m. PDT deadline.
