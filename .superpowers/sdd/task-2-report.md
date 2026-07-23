# Task 2 report: remove unfinished demo affordance

## Scope

- Read `app/AGENTS.md` and the exact [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/) before editing app code.
- Removed only the disabled parked lesson action from `app/app/analyze.tsx`.
- Added a focused source-level regression test because this Expo app has no route rendering test harness; the existing presentation tests cover pure presentation helpers only.
- `README.md` was already clear and was left unchanged.

## RED

Command:

```sh
npm run test --workspace @snap/app -- src/ui/analyzeScreen.test.ts
```

Output summary:

```text
FAIL src/ui/analyzeScreen.test.ts > analysis result screen > does not offer the unfinished lesson action
AssertionError: expected ... not to match /video lesson|coming soon/i
Tests  1 failed
```

The failure was expected and was caused by the disabled result-screen action in `app/app/analyze.tsx`.

## GREEN

Command:

```sh
npm run test --workspace @snap/app -- src/ui/analyzeScreen.test.ts src/ui/presentation.test.ts
```

Output summary:

```text
Test Files  2 passed (2)
Tests  14 passed (14)
```

Vitest emitted the pre-existing Vite CJS Node API deprecation warning; tests otherwise completed successfully.

## Static checks

```sh
rg -n -i 'video lesson|coming soon' app README.md
```

Produced no matches (exit status 1 is `rg`'s expected no-match status).

```sh
git diff --check
```

Completed with no output (no whitespace errors).

## Files changed

- `app/app/analyze.tsx`
- `app/src/ui/analyzeScreen.test.ts`

## Commit

`Remove unfinished video lesson affordance`

## Concerns

None. The regression check reads the route source because no React Native route-rendering test setup exists in this app.
