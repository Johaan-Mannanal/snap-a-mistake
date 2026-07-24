# Prometheus About Story Design

## Goal

Create a natural, first-person Devpost story for Snap-a-Mistake that clearly covers inspiration, lessons, implementation, and challenges.

## Voice

- Written as a solo student builder using “I.”
- Personal and conversational without sounding casual or exaggerated.
- Judge-focused enough to make the educational value and meaningful use of AI obvious.
- Avoid generic hackathon language, inflated impact claims, and unsupported claims about users or learning outcomes.

## Structure

1. **Inspiration:** Final-answer checkers reveal that an answer is wrong but rarely show where the reasoning first failed. Add a personal note about wanting more useful feedback while learning math.
2. **What it does:** Explain the photo-to-first-break-to-targeted-practice loop in plain language.
3. **How I built it:** Cover the Expo mobile app, stateless Fastify server, shared Zod contracts, three-stage model pipeline, independent verifier, and on-device SQLite insights.
4. **Challenges:** Lead with the difficulty of reliably identifying the earliest incorrect step rather than merely judging the final answer. Also mention handwriting alignment and structured model-output reliability.
5. **What I learned:** Discuss designing uncertainty into AI feedback, testing model behavior, and treating the experience around the model as part of the educational product.
6. **What’s next:** Mention broader handwriting validation and classroom feedback without claiming a deployed service.

## Evidence and Boundaries

- The story may state that the repository has 155 passing automated tests.
- It may mention a 25-case validation set containing synthetic cases and licensed FERMAT handwriting images.
- It must not describe mock results as live-model results.
- It must not claim active users, classroom adoption, proven learning gains, public deployment, or server-side privacy guarantees beyond the documented stateless design.
- Technical detail should support the story rather than dominate it.

## Format

- Approximately 600–800 words.
- Markdown headings that map naturally to Devpost’s requested categories.
- Short paragraphs and limited bullet points.
- LaTeX support is available but should only be used if a mathematical example materially improves the explanation.
