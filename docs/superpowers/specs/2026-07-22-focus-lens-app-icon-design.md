# Focus Lens App Icon and CodeRabbit Review Design

**Date:** 2026-07-22  
**Status:** Approved for implementation  
**Product:** Snap-a-Mistake

## Goal

Replace the generic Expo template icon with a distinctive, premium icon that matches the existing Camera-first Night Gallery interface, then run CodeRabbit across the full repository as an additional pre-demo quality gate.

## Selected Direction

The selected direction is **Focus Lens**.

The icon uses a flat Ink (`#050505`) field, a crisp white camera outline, and one small Signal-blue (`#1473E6`) focal point. It contains no text, gradients, shadows, glass effects, or generic Expo branding. The geometry must remain recognizable at small home-screen and favicon sizes and retain comfortable safe margins under iOS rounded-square and Android adaptive-icon masks.

Two alternatives were considered and rejected:

- **Marked Step** combined framing corners with a semantic red correction. It communicated the complete workflow but felt busier and less purely photographic.
- **Broken Equals** emphasized error detection strongly but lost the camera-first product story.

## Asset Coverage

The implementation will replace every user-visible template icon surface with a consistent Focus Lens family:

- universal 1024 × 1024 application icon;
- iOS `.icon` asset and its referenced layers;
- Android adaptive foreground, background, and monochrome assets;
- splash mark;
- web favicon.

The full-color icon uses Ink, white, and the single blue focus point. The Android monochrome asset uses only the camera silhouette so the operating system can apply its own tint. Splash treatment uses the white camera mark on the existing Ink background and omits the blue focus point if required for clarity at the configured 76-point display size.

## Technical and Visual Constraints

- All raster outputs must be generated from one canonical vector source to avoid shape drift.
- The main icon must be opaque and must not bake rounded corners into the source bitmap.
- Foreground geometry must stay inside adaptive-icon safe zones.
- The icon must remain legible at 48 × 48 pixels and in grayscale.
- Existing Night Gallery colors and app behavior remain unchanged.
- Existing uncommitted physical-device changes in `app/app.json` and `app/package.json` are user-owned and must be preserved.
- Generated native `app/ios` and `app/android` directories remain ignored and are not part of the deliverable.

## Verification

Icon verification includes:

- dimensions, alpha/opacity, and file-format checks for every output;
- rendered contact sheets at full and small sizes;
- inspection under representative rounded-square and circular masks;
- Expo configuration resolution to confirm every path exists;
- the full repository test suite, workspace typechecks, and diff hygiene checks.

## CodeRabbit Review

CodeRabbit CLI will review the complete tracked change range against the published `main` baseline, not only the icon files. The review must include application, server, shared package, configuration, tests, and documentation changes visible in the selected range.

CodeRabbit findings will be treated as review input rather than applied blindly:

- Critical and Important findings will be reproduced or verified against the code before changes are made.
- Valid findings will be fixed with focused tests where behavior changes.
- Incorrect or inapplicable findings will be documented with technical reasoning.
- After fixes, CodeRabbit and the automated verification gates will be rerun.

The CodeRabbit CLI must authenticate successfully and pass its readiness checks before its result is represented as a completed review.

## Completion Criteria

The work is complete when the generic Expo icon is absent from all configured app surfaces, the Focus Lens family passes visual and technical inspection, CodeRabbit has reviewed the intended repository range, all valid findings are resolved or explicitly justified, all automated gates pass, and the reviewed changes are committed without overwriting the user's physical-device configuration edits.
