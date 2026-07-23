# Readable Math Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure diagnosis explanations and follow-up problems use polished Unicode math, and label the follow-up action “Try a similar problem.”

**Architecture:** Tighten the shared student-facing text schema so caret notation triggers the model client’s existing correction retry. Align the stage-two prompt with that contract, then change only the analysis action copy in the Expo app.

**Tech Stack:** TypeScript, Zod, Vitest, OpenAI JSON responses, React Native 0.86, Expo SDK 57

## Global Constraints

- Do not add KaTeX, WebView, an inline-math parser, or another dependency.
- Preserve native React Native `Text` rendering and its accessibility behavior.
- Allow Unicode notation such as `eˣ`, `x²`, `∫eˣ dx`, and `−`.
- Reject raw LaTeX commands, math delimiters, and all caret notation in `explanation` and `followUp.problem`.
- Preserve `TranscribedStep.latex` unchanged.
- Use the exact action label **Try a similar problem**.
- Follow the versioned Expo SDK 57 documentation at `https://docs.expo.dev/versions/v57.0.0/`.

---

### Task 1: Enforce Unicode student-facing math

**Files:**
- Modify: `shared/src/index.ts:11-14`
- Test: `shared/test/schemas.test.ts:48-56`

**Interfaces:**
- Consumes: `StudentFacingMathTextSchema`, the private Zod string schema used by `Stage2Schema` and `AnalyzeResponseSchema`.
- Produces: the same private schema, now rejecting `^` in addition to raw LaTeX commands and delimiters.

- [ ] **Step 1: Write the failing schema test**

Replace the existing raw-LaTeX test with:

```ts
it('requires Unicode or prose in student-facing diagnosis copy', () => {
  const base = {
    errorStepIndex: 0,
    misconceptionTag: 'algebraic-slip' as const,
    followUp: { problem: 'Simplify x² ÷ 2.', concept: 'division' },
  }

  expect(Stage2Schema.parse({
    ...base,
    explanation: 'Dividing x² by 2 preserves the exponent.',
  }).explanation).toContain('x²')

  expect(() => Stage2Schema.parse({
    ...base,
    explanation: 'Dividing x^2 by 2 preserves the exponent.',
  })).toThrow('caret notation')

  expect(() => Stage2Schema.parse({
    ...base,
    explanation: 'Dividing by $\\frac{x}{2}$ changes the value.',
  })).toThrow('raw LaTeX')
})
```

- [ ] **Step 2: Run the shared test and verify RED**

Run:

```bash
npm test -w shared -- --run test/schemas.test.ts
```

Expected: FAIL because `Dividing x^2 by 2 preserves the exponent.` is currently accepted.

- [ ] **Step 3: Extend the schema guard**

Change `StudentFacingMathTextSchema` to:

```ts
const StudentFacingMathTextSchema = z.string().min(1).refine(
  (value) => !/(?:\$|\^|\\(?:[A-Za-z]+|[()[\]]))/.test(value),
  { message: 'must use Unicode or prose without raw LaTeX, math delimiters, or caret notation' },
)
```

- [ ] **Step 4: Run the shared test and verify GREEN**

Run:

```bash
npm test -w shared -- --run test/schemas.test.ts
```

Expected: PASS with 13 tests.

- [ ] **Step 5: Commit the schema change**

```bash
git add shared/src/index.ts shared/test/schemas.test.ts
git commit -m "fix: require Unicode math in student copy"
```

---

### Task 2: Make model output match the Unicode contract

**Files:**
- Modify: `server/src/pipeline/stage2.ts:60-63`
- Test: `server/test/stage2.test.ts:30-32`
- Test: `server/test/stage2.test.ts:79-101`

**Interfaces:**
- Consumes: `Stage2Schema`, whose validation error activates `callModelJson`’s existing one-time correction retry.
- Produces: `analyzeSteps(client, model, steps): Promise<Stage2Result>` with Unicode or spoken math in `explanation` and `followUp.problem`.

- [ ] **Step 1: Write the failing prompt and retry assertions**

In the prompt-serialization test, use:

```ts
expect(text).toMatch(/Unicode math symbols/i)
expect(text).toMatch(/never use.*caret notation/i)
expect(text).toMatch(/if Unicode is unavailable.*describe.*in words/i)
expect(text).not.toMatch(/x\^2 when helpful/i)
```

Replace the retry fixture and assertions with:

```ts
it('retries when student-facing copy contains caret notation', async () => {
  const caretNotation = JSON.stringify({
    errorStepIndex: 1,
    misconceptionTag: 'integration-by-parts-error',
    explanation: 'Since v = e^x, the remaining integral is ∫e^x dx.',
    followUp: { problem: 'Evaluate ∫ x e^x dx.', concept: 'integration by parts' },
  })
  const readable = JSON.stringify({
    errorStepIndex: 1,
    misconceptionTag: 'integration-by-parts-error',
    explanation: 'Since v = eˣ, the remaining integral is ∫eˣ dx.',
    followUp: { problem: 'Evaluate ∫ x eˣ dx.', concept: 'integration by parts' },
  })
  const client = fakeClient(caretNotation, readable)

  const result = await analyzeSteps(client, 'gpt-5.6-sol', steps)

  expect(result.explanation).toBe('Since v = eˣ, the remaining integral is ∫eˣ dx.')
  expect(result.followUp?.problem).toBe('Evaluate ∫ x eˣ dx.')
  expect(client.chat.completions.create).toHaveBeenCalledTimes(2)
})
```

- [ ] **Step 2: Run the stage-two test and verify RED**

Run:

```bash
npm run test:vitest -w server -- --run test/stage2.test.ts
```

Expected: FAIL because the prompt still permits `x^2` and does not forbid caret notation.

- [ ] **Step 3: Tighten the stage-two instructions**

Replace the student-facing notation rule with:

```ts
- Write "explanation" and "followUp.problem" as readable plain text with polished Unicode math symbols, for example ∫, √, ×, ÷, −, eˣ, and x².
- Never use LaTeX commands, math delimiters, or caret notation such as \\frac, \\int, \\(...\\), $...$, e^x, or x^2 in those fields. If the needed expression is not practical in Unicode, describe it clearly in words.
```

- [ ] **Step 4: Run the stage-two test and verify GREEN**

Run:

```bash
npm run test:vitest -w server -- --run test/stage2.test.ts
```

Expected: PASS with 3 tests.

- [ ] **Step 5: Commit the prompt change**

```bash
git add server/src/pipeline/stage2.ts server/test/stage2.test.ts
git commit -m "fix: request polished Unicode math copy"
```

---

### Task 3: Rename the follow-up action

**Files:**
- Modify: `app/app/analyze.tsx:145`
- Test: `app/src/ui/analyzeScreen.test.ts`

**Interfaces:**
- Consumes: the existing `AppButton` and `/followup` route.
- Produces: the same navigation behavior with the exact visible label `Try a similar problem`.

- [ ] **Step 1: Write the failing screen-copy test**

Add this case to `app/src/ui/analyzeScreen.test.ts`:

```ts
it('offers a similar problem without promising lower difficulty', () => {
  expect(analyzeScreen).toContain('label="Try a similar problem"')
  expect(analyzeScreen).not.toContain('label="Try a simpler problem"')
})
```

- [ ] **Step 2: Run the app test and verify RED**

Run:

```bash
npm test -w app -- --run src/ui/analyzeScreen.test.ts
```

Expected: FAIL because the analysis button is still labeled `Try a simpler problem`.

- [ ] **Step 3: Change the button label**

In `app/app/analyze.tsx`, use:

```tsx
{result.followUp && !correct ? <AppButton label="Try a similar problem" onPress={() => router.push('/followup')} /> : null}
```

- [ ] **Step 4: Run the app test and verify GREEN**

Run:

```bash
npm test -w app -- --run src/ui/analyzeScreen.test.ts
```

Expected: PASS with 2 tests.

- [ ] **Step 5: Commit the interface copy**

```bash
git add app/app/analyze.tsx app/src/ui/analyzeScreen.test.ts
git commit -m "fix: describe follow-up as a similar problem"
```

---

### Task 4: Verify the integrated change

**Files:**
- Verify only; no production files change.

**Interfaces:**
- Consumes: the schema, prompt, retry behavior, and app label from Tasks 1-3.
- Produces: evidence that the repository remains releasable.

- [ ] **Step 1: Run every automated test**

Run:

```bash
npm test
```

Expected: all shared, server, importer, and app tests pass.

- [ ] **Step 2: Run every TypeScript typecheck**

Run:

```bash
npm run typecheck
```

Expected: all three workspace typechecks exit successfully.

- [ ] **Step 3: Check patch hygiene**

Run:

```bash
git diff --check
git status --short --branch
```

Expected: no whitespace errors and no uncommitted plan-related files.
