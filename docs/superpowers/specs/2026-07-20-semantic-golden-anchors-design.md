# Semantic Golden Anchors and Canonical Tags Design

## Context and evidence

The FERMAT gate currently compares `actual.errorStepIndex` with a static source-image line number. Two paid runs disproved that contract:

- `img_438_pert_3.1` selected the same erroneous `tan^{-1}y = x^{-1} + C` line at index 9 in run 1 and index 8 in run 2.
- `img_559_pert_3.1` was provisionally assigned index 1 from run 1, but the run-2 audit showed index 1 was a correct source-polynomial line, not the dropped-exponent error.
- Five run-2 cases selected the independently audited erroneous text but failed because of an index or neighboring-tag mismatch.

Stage 1 owns the runtime `steps[]` array and may segment the same photographed work differently across calls. A source-image line number is therefore not a stable regression oracle for a model-generated array index.

## Decision

FERMAT error cases will use semantic step anchors and one exact canonical misconception tag. Synthetic cases retain fixed numeric indices because their committed/generated layout is stable and already serves as a deterministic regression fixture.

The gate remains strict. It will not accept multiple tags and will not pass a response merely because it flagged some error somewhere on the page.

## Manifest contract

An error case must define exactly one locator:

```ts
type ErrorLocator =
  | { errorStepIndex: number; errorStepAnchor?: never }
  | { errorStepIndex?: never; errorStepAnchor: {
      all: string[]
      none?: string[]
    } }
```

`all` must contain at least one non-empty fragment. Every `all` fragment must occur in the selected runtime step after normalization. Every `none` fragment must be absent. Correct, unreadable, and not-math cases may define neither locator. FERMAT error cases must use `errorStepAnchor`; synthetic error cases must use `errorStepIndex`.

The provenance file keeps its manually audited visible `errorStepIndex` because that describes the source photograph. The manifest describes the runtime gate and may therefore use an anchor instead. Tests must make this distinction explicit rather than pretending the two index spaces are identical.

## Text normalization and matching

The judge locates the runtime step using `actual.errorStepIndex`, then matches anchors against that step's `latex` and `plain` fields.

Both anchor fragments and step fields use the same deterministic normalization:

1. Unicode NFKC and lowercase.
2. Normalize Unicode minus/dash variants to `-`.
3. Normalize `×`, `·`, and `\\cdot` to `*`.
4. Remove LaTeX layout-only commands: `\\left`, `\\right`, `\\quad`, `\\,`, `\\;`, and `\\!`.
5. Remove whitespace and grouping delimiters `{}`, `()`, and `[]` while retaining letters, digits, operators, `&`, and semantic LaTeX command names such as `\\frac`, `\\sin`, and `\\log`.

Each fragment passes if its normalized value is a substring of either normalized `latex` or normalized `plain`. `all` is conjunction; `none` is exclusion. Empty normalized fragments are invalid at schema parse time.

The eight FERMAT error anchors are:

| Source ID | Required fragments | Forbidden fragments | Canonical tag |
| --- | --- | --- | --- |
| `img_438_pert_3.1` | `x^{-1}` | — | `notation-error` |
| `img_401_pert_3.1` | `3x+2`, `3x^2+4x+5` | — | `algebraic-slip` |
| `img_414_pert_3.1` | `\\frac{x+3}{x+1}` | — | `algebraic-slip` |
| `img_415_pert_3.1` | `\\sin x-\\sin x` | — | `integration-by-parts-error` |
| `img_559_pert_3.1` | `2x-4xy` | `2x^2-4xy` | `notation-error` |
| `img_601_pert_3.1` | `\\frac{n}{n-1}` | — | `sign-error` |
| `img_468_pert_3.1` | `-3&4`, `2&-1` | — | `formula-misapplied` |
| `img_584_pert_3.2` | `P(2)=2^2+2\\cdot2` | — | `sign-error` |

These fragments describe the erroneous mathematics, not incidental prose or a model-specific index.

## Judge order

For expected errors, the judge performs these checks in order:

1. Response is an analysis and contains an error index.
2. The indexed runtime step exists.
3. The configured locator matches: exact index for synthetic cases or semantic anchor for FERMAT.
4. The returned tag equals the one canonical tag.
5. The verifier agreed.
6. The located step verdict is `wrong`.

Failure details distinguish missing step, anchor mismatch, tag mismatch, verifier disagreement, and verdict mismatch. Anchor mismatch output may show the selected step text and required fragments, but must not include image data or credentials.

This order prevents the run-2 `img_559` response from becoming a false pass: its selected correct line does not contain the `2x-4xy` anchor.

## Canonical tag policy

Stage 2 keeps the existing thirteen-tag vocabulary and receives an explicit decision order:

1. Use a method-specific tag when the mathematical error is in applying that method (`chain-rule-missed`, `product-rule-misapplied`, `integration-by-parts-error`, `u-sub-bounds-error`, `distribution-error`, or `exponent-rule-error`).
2. Use `formula-misapplied` when a named formula or structural template is selected, oriented, or substituted incorrectly.
3. Use `sign-error` for an isolated `+`/`-` change when the surrounding operation or formula remains the same.
4. Use `notation-error` when a written symbol, variable, exponent, or inverse notation changes meaning without fitting a method/formula rule.
5. Use `equals-abuse` only when the equality relation itself is misused, not merely because one side contains a wrong formula.
6. Use `algebraic-slip` for a routine arithmetic or algebraic rewrite after the correct method/formula was chosen.
7. Use `dropped-term` when a nonzero term/factor disappears and `other` only when no defined category fits.

Examples tied to the audited cases are added to the prompt: inverse-function versus reciprocal notation, log-ratio inversion, the final integration-by-parts substitution, set-builder sign change, and adjugate-template reordering. These examples are classification guidance only; they do not reveal expected answers for arbitrary inputs.

## Audit replay fixture

A compact sanitized fixture will preserve the run-2 evidence needed for no-cost regression tests. It contains only case/source IDs, expected locator/tag, the selected runtime step, actual tag/verifier state, and judgment-relevant fields. It excludes image bytes, full prompts, explanations, follow-up problems, headers, keys, and environment values.

Tests use it to prove:

- the same semantic line matches regardless of runtime index;
- the run-2 `img_559` selected line fails its anchor;
- anchored cases still fail wrong tags, verifier disagreement, missing steps, and suspect verdicts;
- existing synthetic index behavior remains unchanged.

## Error handling and compatibility

- Invalid or empty anchors fail manifest parsing before fixture preflight or OpenAI setup.
- Audit serialization includes the anchor as part of the expected case but does not change its privacy boundary.
- No production API or shared `AnalyzeResponse` schema changes.
- No image, provenance, model, timeout, retry, or app behavior changes.
- README test counts and golden-gate semantics are updated after implementation.

## Validation gates

1. TDD red/green tests for normalization, anchor schema, semantic judging, synthetic compatibility, prompt priority, and audit replay.
2. Root `npm test`, including stock-Python importer tests.
3. Root typecheck, diff check, manifest/provenance integrity, and secret/artifact scans.
4. Independent task reviews and a final whole-branch review.
5. A new paid FERMAT run only after no-cost gates pass and the user separately authorizes the spend.
