# Readable Photo and Follow-up Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop clear, transcribed math photos from being rejected solely by a low self-confidence score and prevent the similar-problem navigation tap from opening the camera.

**Architecture:** Make the existing independent transcription verifier the strict decision boundary whenever Stage 1 extracted at least one step; keep non-math and zero-step rejection absolute. Replace the follow-up route’s elapsed-time-only handoff with a route-readiness plus fresh-press token so only a press beginning after the new screen is ready can activate “Check my work.”

**Tech Stack:** TypeScript, Fastify analysis pipeline, Expo Router, React Native Pressable/InteractionManager, Vitest, Expo lint/export.

## Global Constraints

- Non-math input remains an absolute rejection.
- A transcript containing zero steps remains unreadable.
- Normal strict analysis requires the independent verifier to report both `faithful` and `legible`.
- `allowUncertainTranscript=true` remains a one-request override and never becomes a preference.
- No global legibility-threshold reduction is permitted.
- The follow-up problem remains visible until a deliberate fresh press activates “Check my work.”
- A press beginning before the follow-up route is ready cannot open capture, even if it ends after route activation.
- Blur and unmount clear route readiness and any pending press.
- Preserve the existing premium black-and-white UI, accessibility labels, and follow-up persistence semantics.
- No new runtime dependency is permitted.

---

## File structure

- `server/src/pipeline/run.ts` — owns the strict readability decision order.
- `server/test/run.test.ts` — proves low-score transcript verification and absolute rejection cases.
- `app/src/lib/followUp.ts` — owns route readiness and fresh-press eligibility independent of React.
- `app/src/lib/followUp.test.ts` — proves tap-through rejection and valid fresh presses.
- `app/src/components/AppButton.tsx` — exposes an optional `onPressIn` callback without changing existing callers.
- `app/app/followup.tsx` — binds route-transition completion and fresh presses to “Check my work.”
- `app/src/ui/followUpScreen.test.ts` — guards the screen wiring against timer-only regressions.
- `README.md` and `docs/validation/2026-07-22-prometheus-readiness.md` — record final behavior, evidence, and the remaining phone gate.

---

### Task 1: Verify low-confidence transcripts before rejecting them

**Files:**
- Modify: `server/src/pipeline/run.ts`
- Test: `server/test/run.test.ts`

**Interfaces:**
- Consumes: Stage 1 `{ isMath, legibility, steps }` and request option `{ allowUncertainTranscript?: boolean }`
- Preserves: `RunAnalysisFn` and every response schema
- Produces: a strict path in which nonempty transcripts are decided by `verifyTranscription`

- [ ] **Step 1: Write failing pipeline tests**

Add a strict low-confidence case whose verifier confirms the visible work:

```ts
it('lets the verifier rescue a low-confidence transcript with visible steps', async () => {
  const analyze = makeRunAnalysis(client, config, {
    transcribe: async () => s1({ legibility: 0.3 }),
    verifyTranscription: async () => ({ faithful: true, legible: true, note: '' }),
    analyzeSteps: async () => errorDiag,
    verifyDiagnosis: async () => ({ agrees: true, note: '' }),
  })

  await expect(analyze(image)).resolves.toMatchObject({
    kind: 'analysis',
    errorStepIndex: 1,
  })
})
```

Replace the old “low-legibility returns before fidelity” assertion with:

```ts
it('keeps a low-confidence transcript unreadable when the verifier rejects it', async () => {
  let diagnosisCalls = 0
  const analyze = makeRunAnalysis(client, config, {
    transcribe: async () => s1({ legibility: 0.3 }),
    verifyTranscription: async () => ({ faithful: false, legible: false, note: 'blurred' }),
    analyzeSteps: async () => {
      diagnosisCalls += 1
      return errorDiag
    },
    verifyDiagnosis: async () => ({ agrees: true, note: '' }),
  })

  await expect(analyze(image)).resolves.toMatchObject({ kind: 'unreadable' })
  expect(diagnosisCalls).toBe(0)
})
```

Keep explicit tests proving non-math and `steps: []` return before fidelity.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm run test:vitest -w server -- --run test/run.test.ts
```

Expected: the rescue test fails because `run.ts` returns unreadable before calling `verifyTranscription`.

- [ ] **Step 3: Implement the minimal decision-order change**

In `server/src/pipeline/run.ts`, preserve the absolute gates and remove only the low-score early return:

```ts
if (!s1.isMath) return { kind: 'not-math' }
if (s1.steps.length === 0) return { kind: 'unreadable', tips: RETAKE_TIPS }

const transcriptionCheck = await timeStage(
  timings,
  'Checking the transcription',
  () => deps.verifyTranscription(client, config.models.vision, image, s1.steps),
)
if (
  !options.allowUncertainTranscript
  && (!transcriptionCheck.faithful || !transcriptionCheck.legible)
) return { kind: 'unreadable', tips: RETAKE_TIPS }
```

Do not lower `config.legibilityThreshold`, change Stage 1 output, or weaken the verifier rule.

- [ ] **Step 4: Run focused and server verification**

Run:

```bash
npm run test:vitest -w server -- --run test/run.test.ts
npm run typecheck -w server
```

Expected: PASS.

- [ ] **Step 5: Commit the pipeline fix**

```bash
git add server/src/pipeline/run.ts server/test/run.test.ts
git commit -m "fix: verify readable low-confidence transcripts"
```

---

### Task 2: Require a fresh follow-up press after navigation

**Files:**
- Modify: `app/src/lib/followUp.ts`
- Modify: `app/src/lib/followUp.test.ts`
- Modify: `app/src/components/AppButton.tsx`
- Modify: `app/app/followup.tsx`
- Create: `app/src/ui/followUpScreen.test.ts`

**Interfaces:**
- Changes `FollowUpRouteGate` to:

```ts
export type FollowUpRouteGate = {
  arm(): void
  beginPress(): void
  consumePress(): boolean
  invalidate(): void
}
```

- Extends `AppButton` props with optional `onPressIn?: () => void`
- Preserves all existing `AppButton` behavior for callers omitting `onPressIn`

- [ ] **Step 1: Write failing route-gate tests**

Add:

```ts
it('rejects a press that began before route activation', () => {
  const gate = createFollowUpRouteGate()

  gate.beginPress()
  gate.arm()

  expect(gate.consumePress()).toBe(false)
})

it('accepts one fresh press that begins after route activation', () => {
  const gate = createFollowUpRouteGate()
  gate.arm()

  gate.beginPress()

  expect(gate.consumePress()).toBe(true)
  expect(gate.consumePress()).toBe(false)
})

it('clears a pending press on blur', () => {
  const gate = createFollowUpRouteGate()
  gate.arm()
  gate.beginPress()

  gate.invalidate()

  expect(gate.consumePress()).toBe(false)
})
```

- [ ] **Step 2: Write the failing screen-wiring guard**

Create `app/src/ui/followUpScreen.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(__dirname, '../../app/followup.tsx'), 'utf8')

describe('follow-up screen handoff', () => {
  it('waits for navigation interactions and requires a fresh check-work press', () => {
    expect(source).toContain('InteractionManager.runAfterInteractions')
    expect(source).toContain('routeGate.current.beginPress()')
    expect(source).toContain('routeGate.current.consumePress()')
    expect(source).not.toContain('ROUTE_ACTIVATION_DELAY_MS')
  })
})
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
npm test -w app -- --run src/lib/followUp.test.ts src/ui/followUpScreen.test.ts
```

Expected: route-gate method and screen-wiring failures.

- [ ] **Step 4: Implement fresh-press state**

In `createFollowUpRouteGate`, track route readiness and a single press token:

```ts
let armed = false
let pressEligible = false
return {
  arm() {
    armed = true
    pressEligible = false
  },
  beginPress() {
    pressEligible = armed
  },
  consumePress() {
    const accepted = armed && pressEligible
    pressEligible = false
    return accepted
  },
  invalidate() {
    armed = false
    pressEligible = false
  },
}
```

- [ ] **Step 5: Expose `onPressIn` through `AppButton`**

Use a named props type:

```ts
type AppButtonProps = {
  label: string
  onPress?: () => void
  onPressIn?: () => void
  disabled?: boolean
  variant?: ButtonVariant
}
```

Pass `props.onPressIn` to the existing `Pressable`. Do not change styling, labels, or disabled behavior.

- [ ] **Step 6: Replace timer-only follow-up activation**

Import `InteractionManager` from `react-native`. In the existing focus effect:

```ts
beginFollowUpRouteActivation(routeGate.current, (activate) => {
  const interaction = InteractionManager.runAfterInteractions(activate)
  return () => interaction.cancel()
})
```

Remove `ROUTE_ACTIVATION_DELAY_MS`.

Before either visible check-work action can call `checkWork`, require a fresh press:

```tsx
<AppButton
  label={checkingWork ? 'Preparing camera…' : 'Check my work'}
  onPressIn={() => routeGate.current.beginPress()}
  onPress={() => {
    if (routeGate.current.consumePress()) checkWork()
  }}
  disabled={checkingWork || isLeaving}
/>
```

Apply the same `onPressIn` and consuming wrapper to “Try checking my work again.” Leave hint and alternate-problem actions unchanged.

- [ ] **Step 7: Run focused app verification**

Run:

```bash
npm test -w app -- --run src/lib/followUp.test.ts src/ui/followUpScreen.test.ts
npm run typecheck -w app
npm run lint -w app
```

Expected: PASS.

- [ ] **Step 8: Commit the handoff fix**

```bash
git add app/src/lib/followUp.ts app/src/lib/followUp.test.ts app/src/components/AppButton.tsx app/app/followup.tsx app/src/ui/followUpScreen.test.ts
git commit -m "fix: prevent follow-up tap-through"
```

---

### Task 3: Reconcile evidence and verify the complete fix

**Files:**
- Modify: `README.md`
- Modify: `docs/validation/2026-07-22-prometheus-readiness.md`

**Interfaces:**
- Consumes: final automated command output
- Produces: exact test totals and a physical-device checklist for both regressions

- [ ] **Step 1: Update behavior documentation**

In `README.md`, clarify that nonempty low-confidence transcripts receive the independent fidelity check before strict rejection. In the validation record, add unchecked phone steps:

```md
- [ ] Submit a clear handwritten page that Stage 1 scores below the confidence threshold and confirm the strict verifier can continue to analysis without requiring **Proceed anyway**.
- [ ] Open **Try a similar problem** with a normal and a deliberately long press; confirm the problem remains visible and the camera opens only after a new press on **Check my work**.
```

Do not claim these device checks are complete.

- [ ] **Step 2: Run complete automated verification**

Run:

```bash
npm test
npm run typecheck
npm run lint -w app
```

Then run:

```bash
cd app
npx expo export --platform ios --output-dir /tmp/snap-a-mistake-readable-handoff
```

Finally run from the repository root:

```bash
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 3: Reconcile exact evidence**

Replace stale test totals in `README.md` and `docs/validation/2026-07-22-prometheus-readiness.md` with the counts printed by the final `npm test`. Record the iOS export path `/tmp/snap-a-mistake-readable-handoff`. Do not change paid live-model claims.

- [ ] **Step 4: Commit documentation**

```bash
git add README.md docs/validation/2026-07-22-prometheus-readiness.md
git commit -m "docs: validate readable photo and follow-up handoff fixes"
```
