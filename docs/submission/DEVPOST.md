# Devpost submission copy

## Project

**Title:** Snap-a-Mistake

**Tagline:** Photograph handwritten math and find the first step where the reasoning broke—not just the final wrong answer.

## What I built

I built Snap-a-Mistake because “wrong answer” is usually the least useful feedback a student can receive. The app takes a photo of handwritten algebra or calculus, turns it into positioned steps, identifies the first unsupported step, names the likely misconception, and explains why that transition failed.

The student keeps the original page in view while navigating a linked photo overlay and step timeline. They can accept, reject, or correct the diagnosis; a correction becomes a revision of the same scan rather than a separate mistake record. The app then offers a similar follow-up problem, a hint, and an alternate similar problem. Follow-up attempts remain linked to the original scan.

Patterns and Previous scans are stored locally on the device. The app retains its owned scan photos, all revisions, and follow-up links until the student deletes one scan or clears all history.

## How it works

1. The Expo app captures or selects a photo and asks the Fastify API to analyze it.
2. A multimodal transcription pass returns ordered handwritten steps and vertical position bands.
3. A diagnosis pass identifies the earliest error and selects one controlled misconception tag.
4. An independent verifier can soften a disputed diagnosis into a suspect state.
5. Shared Zod schemas validate the response before the app renders Unicode math such as ∫, √, ×, −, eˣ, and x². Student-facing text does not expose raw LaTeX.

The server is stateless: it has no account system, database, or history store. Analysis sends the submitted photo to the configured external AI service. Correction sends the photo plus selected existing-analysis context. Follow-up generation sends only diagnosis, concept, and problem-history text—never a photo. The server does not retain those inputs or outputs after responding. Provider retention is governed by the provider’s applicable terms.

## Technical evidence

- TypeScript npm-workspace monorepo: Expo/React Native app, Fastify API, Zod shared contracts, and device-local SQLite.
- 467 automated tests passed on this branch on July 26, 2026: 36 shared Vitest, 116 server Vitest, 4 stock-Python importer, and 311 app Vitest tests.
- All three workspaces typechecked and Expo lint completed with zero warnings and zero errors on that same run.
- The repository includes an inspectable 25-case golden manifest: 15 synthetic cases and 10 licensed FERMAT handwriting photographs.
- The paid live-model golden command remains deliberately separate: it requires an API key and makes external requests. No current paid-pass rate is claimed without a recorded run artifact.
- Public repository: https://github.com/Johaan-Mannanal/snap-a-mistake

## Why it matters

The goal is not to make a general tutor chat or another final-answer checker. I wanted a small feedback loop that stays connected to what the student wrote: locate the first break, explain the idea in context, and give them a similar next attempt.

## Submission checklist

- [ ] Complete the physical-phone and live-model checks in the validation record.
- [ ] Record the live-model core diagnosis using the demo script.
- [ ] Label any deterministic mock footage as canned throughout.
- [ ] Review the export for secrets, notifications, unrelated photos, audio, captions, and signed-out playback.
- [ ] Complete the required Google form, eligibility review, public-repository check, and submission before the official deadline.
