# FERMAT Handwriting Golden-Set Expansion

**Date:** 2026-07-20  
**Status:** Approved design  
**Source dataset:** [AI4Bharat FERMAT](https://huggingface.co/datasets/ai4bharat/FERMAT)  
**License:** Creative Commons Attribution 4.0 International (CC BY 4.0)

## Goal

Strengthen Snap-a-Mistake's regression suite with real human handwriting before the
on-device pass. Add a small, reproducible FERMAT subset that tests the complete
pipeline: faithful transcription, first-error localization, misconception tagging,
correct-work restraint, and verifier behavior.

The existing 15 generated cases remain the fast, stable baseline. The FERMAT subset
adds handwriting and capture diversity; it does not replace eventual photos taken
through the app, which are still needed to test the exact phone camera workflow.

## Dataset and licensing

FERMAT contains 2,244 annotated, multi-line handwritten math solutions from more
than 40 writers. Its records include the image, original question, correct solution,
perturbed solution, explanation of the perturbation, correctness flag, domain,
handwriting difficulty, and image-quality metadata.

Only ten selected records will be added. Each committed image must have a matching
provenance record containing:

- the FERMAT record ID and source URL;
- the original and perturbed solution text needed to audit our label;
- the upstream license and required attribution;
- whether the image was modified after download;
- our expected first wrong step and misconception tag, with a short rationale.

The repository will include a short attribution document and the CC BY 4.0 license
reference. Images containing personal information or unrelated identifying marks
will be excluded during visual review.

## Selection

Select ten records:

- eight with genuine mathematical errors;
- two with no substantive error (`has_error: false`) to test false-accusation
  resistance;
- primarily algebra and calculus, matching the app's declared scope;
- multiple writers and visibly different handwriting styles;
- a mix of clean and challenging handwriting/image quality;
- one problem and one coherent solution per image;
- enough visible intermediate work to identify a first wrong step.

Prefer cases whose first wrong step can be determined unambiguously from the image,
the correct solution, the perturbed solution, and the perturbation explanation.
Reject cases that depend on a diagram, ambiguous grading convention, missing context,
or an error that cannot be localized to one visible step.

## Labels and misconception vocabulary

Map each erroneous record to the existing eleven-tag vocabulary when the tag is a
faithful pedagogical description. Add a new tag only when no existing tag fits.

New tags must be:

- stable, lower-case kebab-case identifiers;
- specific enough to produce a useful student insight;
- broad enough to recur across more than one narrowly worded problem;
- backed by a human-readable app label and prompt description;
- added to shared-schema, server-prompt, app-label, fixture, and test coverage.

Likely candidates include `arithmetic-error`, `formula-misapplied`,
`notation-error`, and `unit-error`, but the selected records—not this preliminary
list—determine which tags are actually introduced. Avoid overlapping synonyms and
do not enlarge the vocabulary for errors already covered by `algebraic-slip` or
`other`.

For every erroneous case, manually verify:

1. the zero-based index of the first visible wrong step;
2. the misconception tag;
3. that later incorrect lines are downstream consequences rather than earlier
   independent errors.

## Repository layout

- `server/golden/manifest.json` remains the executable list of expected outcomes.
- Selected images use deterministic `fermat-<source-id>.jpg` filenames.
- `server/golden/fermat-provenance.json` stores machine-readable provenance and
  labeling rationale.
- `server/golden/FERMAT-ATTRIBUTION.md` explains the source, citation, license, and
  any transformations.
- The ten selected FERMAT images are committed so the regression subset is
  reproducible. Generated synthetic photos remain ignored.

The downloader/curation step must fetch only selected records rather than download
the approximately 4.8 GB full dataset. It must pin the upstream dataset revision or
record enough source identifiers to reproduce the selection later.

## Contract and application changes

If curation introduces new tags:

1. extend `MISCONCEPTION_TAGS` in `shared/src/index.ts`;
2. describe the expanded controlled vocabulary in the Stage 2 prompt;
3. add display labels in `app/src/lib/labels.ts`;
4. update mock fixtures that exhaustively represent tag behavior, if applicable;
5. add or adjust schema, prompt, label, and golden-judge tests.

The API response shape, verdict semantics, history storage format, and Insights
aggregation algorithm do not otherwise change. Stored tag strings remain compatible
because history already uses the shared string union at the TypeScript boundary.

## Validation

Before any paid model run:

- confirm all ten files decode successfully as images;
- confirm filenames, manifest entries, and provenance records are one-to-one;
- visually compare each image with its source annotation;
- run the shared, server, and app unit suites;
- run the root typecheck;
- verify the repository contains the required attribution and no unintended large
  dataset artifacts.

The real `npm run golden -w server` invocation is a separate checkpoint because it
uses paid API calls. Run the ten FERMAT cases first, inspect failures, and only then
run the combined 25-case suite. Prompt changes are accepted only when they preserve
the synthetic baseline while improving the handwritten subset.

## Failure handling

- If selective access to a record is unavailable, choose another suitable record;
  do not download the entire dataset by default.
- If the image and annotations disagree, exclude the record.
- If a case has multiple plausible first wrong steps, exclude it.
- If a new tag would overlap an existing tag, retain the existing tag or use
  `other` and document the decision.
- If redistribution requirements cannot be satisfied confidently, keep only a
  reproducible downloader plus metadata and do not commit the images.

## Non-goals

- Training or fine-tuning a model on FERMAT.
- Importing all 2,244 records.
- Broadening the product beyond algebra and calculus.
- Replacing the later physical-device camera pass.
- Tuning prompts without rerunning the existing synthetic regression baseline.

