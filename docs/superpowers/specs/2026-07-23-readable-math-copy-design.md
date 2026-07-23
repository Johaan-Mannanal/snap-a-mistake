# Readable Math Copy Design

## Goal

Make mathematical notation inside diagnosis explanations and follow-up problems read naturally on a phone without adding a LaTeX renderer or another native dependency.

## Behavior

- Student-facing explanations and follow-up problems use polished Unicode notation such as `eˣ`, `x²`, `∫eˣ dx`, and `−`.
- Raw LaTeX commands, math delimiters, and caret-style exponents such as `e^x` are invalid in these fields.
- If the model returns invalid notation, the existing schema-correction retry asks it for readable Unicode or spoken prose before the response reaches the app.
- The analysis action reads **Try a similar problem**. The generated problem still targets the same misconception and should be slightly easier, but the interface does not promise a difficulty reduction the model cannot guarantee.
- Transcribed-step LaTeX remains unchanged because it is diagnostic source data, displayed separately beneath each plain-language transcription.

## Architecture

The server prompt defines the preferred notation and provides concrete examples. The shared schema enforces the boundary for both the stage-two model result and the final analysis response. The app continues to render accessible native text; only the analysis button label changes.

No KaTeX, WebView, inline-math parser, or native rebuild is introduced.

## Error Handling

The existing one-time model correction retry handles invalid student-facing notation. If the corrected response is still invalid, the existing model-output error path remains responsible for showing the app’s retry state.

## Testing

- A shared-schema test rejects caret-style math while accepting Unicode notation.
- A server test verifies the prompt requirements and proves a caret-style response is corrected on retry.
- An analysis-screen test locks the new action label.
- The complete repository test and typecheck gates run after implementation.
