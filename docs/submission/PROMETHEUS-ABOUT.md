## Inspiration

I kept coming back to a frustrating gap in the way most math tools give feedback. A final-answer checker can tell me that my answer is wrong, but that is usually the least useful part. What I really want to know is: **where did my reasoning first stop making sense?**

That question matters because one early misconception can make every line after it look wrong. When I was learning math, I often wished I could get feedback on the exact step where I went off track instead of comparing my final answer with a solution and trying to work backward. I built Snap-a-Mistake to make that kind of feedback immediate.

## What it does

Snap-a-Mistake is a mobile app that analyzes a photo of handwritten algebra or calculus. It reads the work as a sequence of steps, finds the earliest unsupported step, names the likely misconception, and explains why that transition fails.

It then creates a similar practice problem focused on the same idea. The goal is not just to correct one answer. It is to give the student a short learning loop: find the first break, understand it in context, try the concept again, and check the new work.

The diagnosis is shown alongside the original page so the feedback stays connected to what the student actually wrote. The app records misconception categories, scan revisions, follow-up links, and owned scan photos locally on the device until the student deletes them, without requiring an account.

## How I built it

I built Snap-a-Mistake as a TypeScript monorepo with three shared parts: an Expo and React Native mobile app, a stateless Fastify server, and a shared package of Zod schemas used by both sides.

The AI workflow has three stages. First, a multimodal transcription pass converts the photographed page into ordered steps and estimates where each step appears vertically. Second, a reasoning pass re-derives the solution, identifies the first incorrect step, selects a label from a controlled misconception vocabulary, and creates an explanation and follow-up problem. Third, an independent verifier checks the diagnosis. If it disagrees, the app shows a softer “second look” state instead of confidently telling the student that a step is wrong.

I used structured JSON responses and shared validation because model output is part of the product interface, not just text to display. Invalid output receives one correction attempt before reaching the app. The server does not store photos or learning history, while misconception trends are saved locally with SQLite.

## Challenges I ran into

The hardest problem was making the system find the **first** incorrect step reliably. Checking whether a final answer is correct is much easier. Once an early step is wrong, later steps may also be invalid, but highlighting those later consequences does not help the student understand the original cause.

I had to make the pipeline reason across the entire sequence while still returning one precise location. I also introduced a controlled misconception vocabulary so similar errors would receive consistent labels rather than slightly different descriptions every time.

Handwriting created another challenge. A page is not clean structured data: lines can be slanted, crossed out, faint, or spaced unevenly. I kept both a mathematical transcription and a plain-language version of each step, along with vertical position bands, so the app could connect the diagnosis back to the photograph.

Model reliability also required more than prompt tuning. Responses can be malformed, truncated, or overly confident. Shared schemas, correction retries, an independent verifier, uncertainty states, and regression tests all became important parts of the design.

## What I learned

The biggest thing I learned is that building a useful AI product is not the same as making one impressive model call. Reliability comes from the system around the model: clear interfaces, validation, disagreement handling, good fallback states, and tests that represent real inputs.

I created a 25-case validation set with 15 synthetic cases and 10 licensed FERMAT handwriting images, and the repository now has 513 passing automated tests across the app, server, shared schemas, and dataset importer. That process taught me to treat model behavior as something that needs evaluation, not something I should assume will stay consistent.

I also learned that educational feedback needs restraint. When the verifier is uncertain, admitting that uncertainty is better than giving a confident but incorrect diagnosis.

## What’s next

Next, I want to test Snap-a-Mistake with a wider range of handwriting, topics, and real student workflows. I would also like feedback from students and teachers on whether the explanations are clear, whether the follow-up problems feel appropriately targeted, and which recurring patterns are most useful to surface.

The long-term idea is simple: instead of stopping at “wrong answer,” help a student see the first moment their reasoning changed and give them a useful next step.
