# Golden Audit and Index Calibration Design

## Context

The first paid FERMAT-only run completed with two correct cases passing, seven error cases being detected at indices that differed from the manifest, and one request timeout. The manifest indices were assigned from a manual visible-equation grouping, while Stage 1 creates the authoritative `steps[]` array consumed by Stage 2, the verifier, the overlay, and the judge.

The working root-cause hypothesis is that the manifest and Stage 1 used different line-counting conventions. This hypothesis must be tested against the actual transcribed step text; numeric substitutions alone are insufficient.

## Considered approaches

1. **Print full responses to stdout.** Smallest code change, but the evidence is easy to lose, awkward to compare, and incomplete if a long run is interrupted.
2. **Write an opt-in structured JSON audit.** Recommended. It preserves each expected case, returned response, judge result, and pipeline error without storing image bytes or credentials. It supports deterministic, no-cost replay and careful human inspection.
3. **Replace numeric expectations immediately with semantic text matching.** Potentially more robust, but it changes the golden contract before proving that Stage 1 segmentation is unstable. Defer this unless the audited rerun produces different indices for the same erroneous text.

## Chosen design

Add `GOLDEN_AUDIT_PATH` as an optional runner setting. When present, the runner rewrites a versioned JSON document after every completed case. Each entry contains the case filename/source ID, its expected outcome, the complete `AnalyzeResponse` when available, the judge result, or a sanitized pipeline error. It never contains base64 image data, API keys, environment values, or request headers.

Seed the seven error indices observed in the first paid run and retain the timed-out case's audited manual expectation. The next paid FERMAT run becomes a hypothesis test:

- If the same indices identify step text containing the known mathematical error, and tag/verifier checks pass, the calibration is supported.
- If an index moves but the same erroneous text is still selected, fixed numeric indices are an unstable contract; stop recalibrating numbers and design semantic anchors.
- If the selected text is not the known first error, investigate transcription/analysis quality rather than altering the manifest.
- A timeout is recorded distinctly and must not be interpreted as a label failure.

## Audit format and lifecycle

The document is `{ "version": 1, "generatedAt": string, "entries": GoldenAuditEntry[] }`. Entries are written in manifest order. The audit path will be under `/private/tmp` for paid runs and remains outside Git. File writes use a sibling temporary file followed by rename so an interrupted write cannot leave malformed JSON at the requested path.

## Error handling

Audit-write failures are fatal because continuing would spend money without preserving the requested evidence. Model/pipeline errors remain per-case failures and are recorded. Existing fixture preflight remains before configuration and OpenAI module evaluation.

## Testing

- A focused unit test proves successful and failed responses serialize without base64 or secret-like fields.
- A focused unit test proves atomic output is valid JSON and updates after each supplied entry.
- Manifest regression coverage pins the seven observed first-run indices.
- The existing full no-cost test and typecheck gates remain mandatory.
- The paid run is exactly `GOLDEN_SOURCE=fermat` with an audit path; no combined synthetic run occurs.

## Scope

This change adds diagnostics and evidence-backed calibration only. It does not change production API responses, prompts, models, timeouts, retry policy, curated images, tags, or provenance.

