# Prometheus readiness evidence — July 22, 2026

This summary separates evidence that a reviewer can reproduce from the public
branch from observations and paid-run results reported by the project owner. It
does not include prompts, student work, API keys, raw provider payloads, or
private device identifiers.

## Reproducible on the branch

### Automated checks

- `npm test` runs **150 tests**: 12 shared Vitest tests, 85 server Vitest tests,
  4 stock-Python importer tests, and 49 app Vitest tests.
- `npm run typecheck` checks all three workspaces: shared, server, and app.
- Expo Doctor reported **20/20 checks passed** for the app. Reviewers can rerun
  the project check from `app/` with `npx expo-doctor`.

### Golden-set composition

`server/golden/manifest.json` contains **25 cases**:

- 15 synthetic cases;
- 10 FERMAT photographs;
- within the FERMAT subset, 2 correct cases and 8 intentional-error cases.

The manifest, committed FERMAT photographs, and tests make that composition
inspectable without a paid model run. This summary does not claim that the
generated 15-case paid pipeline achieved any particular pass rate.

### License and provenance

- [`server/golden/FERMAT-ATTRIBUTION.md`](../../server/golden/FERMAT-ATTRIBUTION.md)
  records the FERMAT citation and CC BY 4.0 license.
- [`server/golden/fermat-provenance.json`](../../server/golden/fermat-provenance.json)
  records source IDs, labels, the pinned dataset revision, source URLs, and
  shard checksums for the selected cases.
- The optional importer and its four stock-Python regression tests are in
  `server/scripts/import-fermat.py` and `server/test/test_import_fermat.py`.

## Owner-observed or owner-reported

The following evidence is not independently reproducible from repository
contents alone.

### Owner-observed device and live-model checks

- A physical-iPhone development-build workflow exercised camera and gallery
  input, staged analysis, result overlays, follow-up practice, local insights,
  non-math and unreadable responses, and network recovery.
- A real live-model smoke run processed real handwritten math after the
  long-running request path was hardened.

These are owner-observed workflow checks; no device recording or raw model
exchange is committed as repository evidence.

### Owner-reported paid FERMAT result

The latest paid FERMAT result is **8/10**, as reported by the project owner. The
reported two misses were:

1. one strict canonical-tag mismatch, despite selection of the correct error
   step; and
2. one truncated JSON response.

The raw paid-run provider artifact was not committed and cannot be independently
reconstructed from the repository. The 8/10 figure must therefore be presented
as owner-reported, not as repository-reproducible evidence.
