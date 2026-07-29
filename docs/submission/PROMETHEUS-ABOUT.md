## Inspiration

I kept coming back to something that frustrated me about most math tools: they can tell you that your final answer is wrong, but they rarely tell you where your thinking first went off track.

That is usually the part I actually want help with. One small mistake near the beginning can affect every line that follows, and comparing my answer with a completed solution means working backward to guess what happened. I built Snap-a-Mistake because I wanted feedback that starts with a more useful question: **where did my reasoning first stop making sense?**

## What it does

Snap-a-Mistake is a mobile app for handwritten algebra and calculus. A student takes a photo of their work, and the app reads it as a sequence of steps. It then finds the earliest step that does not follow, identifies the likely misconception, and explains what changed.

The feedback stays connected to the original photo, so the student can see the explanation beside the line they actually wrote instead of looking at a separate answer key. Afterward, the app creates a similar practice problem focused on the same idea.

The goal is not just to correct one answer. It is to create a short learning loop: find the first break, understand it in context, try the idea again, and check the new work. Previous scans, revisions, linked follow-up attempts, and recurring misconception patterns stay on the student's device until they delete them. No account is required.

## How I built it

I built the project by myself as a TypeScript monorepo. It has an Expo and React Native mobile app, a stateless Fastify server, and a shared package of Zod schemas that keeps both sides working with the same validated data.

I separated the AI workflow into reading, reasoning, and verification instead of relying on one large model response. First, a multimodal pass turns the photographed page into ordered steps and estimates where each line appears on the page. A second image check compares that transcript with the visible handwriting before any grading happens.

I deliberately made the unreadable-photo warning conservative because I did not want decent handwriting rejected too easily. Blank and non-math photos are still stopped, but ordinary uncertainty continues to the reasoning stage. The app only asks for a new photo when the first pass has exceptionally low confidence and the second check rejects both the transcript's faithfulness and the image's legibility. Even then, the student can choose **Proceed anyway** for that request.

Next, a reasoning pass works through the full solution, finds the first unsupported step, chooses a label from a controlled misconception vocabulary, and creates an explanation and a similar problem. A separate verifier checks that diagnosis. If it disagrees, the app shows a softer “second look” result instead of presenting an uncertain judgment as a fact.

I used structured JSON and shared validation because model output is part of the product interface, not just text to place on a screen. Malformed output gets one correction attempt before it can reach the app. The server does not store photos or learning history; the app stores scan history and patterns locally with SQLite.

## Challenges I ran into

The hardest part was getting the system to focus on the **first** incorrect step. Checking a final answer is much easier. Once one early line is wrong, several later lines may also fail, but highlighting a later consequence does not explain the original mistake.

I had to make the pipeline consider the whole solution while still returning one precise location. I also added a controlled misconception vocabulary so similar errors receive consistent labels instead of a slightly different description on every scan.

Handwriting was another challenge. Real pages are not clean structured data: lines can be faint, slanted, crossed out, or spaced unevenly. I kept both a mathematical transcription and a plain-language reading of each step, along with its approximate vertical position, so the app could connect its diagnosis back to the photograph.

I also learned quickly that reliability needed more than prompt tuning. Responses can be malformed, incomplete, or too confident. Shared schemas, correction retries, an independent verifier, uncertainty states, and regression tests all became important parts of the product.

## What I learned

The biggest thing I learned is that building a useful AI product is not the same as making one impressive model call. Most of the reliability comes from the system around the model: clear interfaces, validation, disagreement handling, careful fallback states, and tests based on realistic inputs.

I assembled a 25-case evaluation set with 15 synthetic cases and 10 licensed FERMAT handwriting images. The final repository run also has 571 passing automated tests across the app, server, shared schemas, and dataset importer. I am not treating those automated tests as proof that every model response will be correct; they are the guardrails around the pipeline, while the separate image set is there for live-model evaluation.

Most importantly, I learned that educational feedback needs restraint. When the checks disagree, admitting uncertainty is much better than giving a student a confident but incorrect explanation.

## What’s next

Next, I want to test Snap-a-Mistake with a wider range of handwriting, math topics, and real student workflows. I would especially like feedback from students and teachers about whether the explanations are clear, whether the similar problems feel genuinely useful, and which long-term patterns are worth showing.

The long-term idea is simple: instead of stopping at “wrong answer,” show the student the first moment their reasoning changed and give them a useful next step.
