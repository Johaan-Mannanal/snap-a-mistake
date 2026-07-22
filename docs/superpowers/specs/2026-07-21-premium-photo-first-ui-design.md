# Premium Photo-First UI Design

**Date:** 2026-07-21  
**Status:** Approved for implementation

## Goal

Turn the functional Snap-a-Mistake MVP into a cohesive, submission-ready iOS experience inspired by the immediacy of Instagram Stories: edge-to-edge photography, minimal chrome, disciplined black-and-white surfaces, and rare color used only when it communicates state.

The redesign covers every app screen and state. It does not change the analysis API, local history model, camera/gallery behavior, follow-up loop, or response contract.

## Selected Direction

**Camera-first Night Gallery** was selected over two alternatives:

- A photo-feed treatment was familiar but made the learning flow feel social.
- A white editorial treatment was polished but weakened the transition from capture to diagnosis.
- Night Gallery keeps the photo central from capture through analysis and gives the app one continuous visual environment.

## Visual System

### Palette

| Token | Value | Use |
|---|---:|---|
| Ink | `#050505` | Primary background |
| Graphite | `#121212` | Raised surfaces and pressed states |
| Carbon | `#242424` | Dividers, borders, disabled controls |
| Chalk | `#F5F5F3` | Primary text and white controls |
| Muted | `#98989D` | Secondary text and inactive states |
| Signal blue | `#1473E6` | Rare active-navigation and focus accents |
| Error red | `#FF5C67` | Thin wrong-step signals only |
| Success green | `#36D17C` | Tiny correct-state signals only |

Blue is never used as a large background or decorative gradient. Red and green never fill cards; they appear as rails, dots, or compact status marks.

### Typography

- Use the native iOS system family (San Francisco through React Native's default `System`) for display and body text.
- Use strong size and weight contrast instead of multiple typefaces.
- Use a compact monospaced face only for step numbers and technical math labels.
- Favor sentence case, short labels, and direct instructional copy.

### Shape and spacing

- Use generous edge spacing, thin hairline dividers, and a small set of radii.
- Reserve large rounding for the shutter and compact controls. Results should not look like a stack of generic rounded dashboard cards.
- Maintain at least 44-point touch targets and high text contrast.

### Signature element

The app's visual signature is a **diagnostic rail**: a thin full-width line band crossing the photographed step where reasoning first breaks. Its step number and semantic color connect the photo to the expanded explanation below.

## Screens

### Camera and permissions

- Keep the camera edge to edge.
- Place a quiet `snap` wordmark at the top and a minimal Insights control opposite it.
- Replace the tip pill with a short, low-contrast instruction: “Keep one problem inside the frame.”
- Use four corner guides instead of a large visible box.
- Bottom controls contain a square gallery affordance, a precise double-ring shutter, and a minimal Insights affordance.
- Do not introduce a new photo-library permission merely to render a recent-photo thumbnail; use a clear photo-library symbol.
- The permission state uses the same black canvas, direct copy, one primary action, and a secondary gallery action.
- The follow-up retry state uses a compact top label without changing the camera layout.

### Analyzing

- Keep the submitted photo visible and dimmed rather than cutting to an empty loading screen.
- Present the three existing stages as a vertical sequence over the lower portion of the photo.
- Completed stages receive compact checks, the active stage is bright, and upcoming stages remain muted.
- Preserve the existing stage timing and API behavior.

### Result

- Use a quiet top bar with a return-to-camera action and an `Analysis` title.
- Make the photo the first major element and render the diagnostic rail over wrong or suspect steps.
- Follow the image with a diagnosis block: misconception eyebrow, direct headline, and explanation.
- Replace stacked step cards with a numbered timeline separated by hairline rules.
- Expand only the first wrong or suspect step. Correct steps get tiny green marks; the first wrong step gets a tiny red mark; downstream steps are muted.
- The primary action is a high-contrast white-on-black/black-on-white button labeled “Try a simpler problem.”
- Keep “Video lesson — coming soon” visibly secondary and disabled.
- Keep “Snap another” as a restrained tertiary action.

### Correct, suspect, unreadable, not-math, and failure states

- Correct work uses a tiny green check beside “All steps check out,” followed by a short clean-work sentence, photo, and timeline. There is no green banner.
- A verifier disagreement uses neutral styling and careful wording rather than a confident red signal.
- Unreadable and not-math results use direct titles, concise guidance, and one retake action without emoji.
- Network/server failure clearly states that the photo is retained and offers `Try again` plus a secondary `Use another photo` action.

### Follow-up

- Show the concept as a compact eyebrow and the problem as the dominant type element on a quiet black canvas.
- Use “Check my work” as the primary white action.
- Preserve the current return-to-camera retry behavior.

### Insights

- Use a simple monochrome list with thin separators, not colored dashboard cards.
- Show misconception label, weekly count, and compact trend language.
- Use tiny red/green trend signals only where the direction is meaningful.
- The empty state invites the student to analyze work and offers a clear return action.

## Component Architecture

The visual system should be centralized instead of duplicating inline colors and button styles across screens.

- `src/ui/theme.ts`: colors, spacing, radii, type sizes, and reusable shadows/opacity values.
- `src/components/AppScreen.tsx`: safe-area and scrolling shell for dark screens.
- `src/components/AppButton.tsx`: primary, secondary, tertiary, and disabled variants.
- `src/components/CameraCorners.tsx`: reusable framing-guide corners.
- `src/components/AnalysisProgress.tsx`: staged overlay used while analysis runs.
- `src/components/PhotoOverlay.tsx`: photo plus diagnostic rail and step indicator.
- `src/components/StepCard.tsx`: retained filename for minimal churn, but rendered as a timeline row instead of a card.
- Existing screen modules continue to own navigation and data orchestration.

Components remain small and receive explicit props. Styling primitives do not read session or API state directly.

## Data Flow and Behavior

The existing behavior remains authoritative:

```text
camera/gallery → session photo URI → /analyze → staged progress
→ validated response → photo diagnosis + step timeline
→ optional follow-up → camera retry → local Insights history
```

- No API or shared-schema changes.
- No new account, storage, or network behavior.
- No change to deterministic mock disclosure requirements for the submission video.
- Simulator gallery population is a development/demo operation and is not part of app runtime behavior.

## Error Handling

- Preserve the selected photo across retryable failures.
- Keep all response kinds reachable and styled consistently.
- Do not rely on color alone: pair every semantic color with a symbol, label, or text treatment.
- Disabled and loading controls remain visibly distinct.
- Long explanations and misconception labels must wrap without horizontal clipping.

## Motion

- Use restrained press feedback and opacity transitions supported by the existing React Native stack.
- Concentrate motion in the capture-to-analysis transition and stage progression.
- Avoid decorative looping animation, gradients, and excessive spring effects.

## Testing and Acceptance Criteria

- Existing unit tests and all workspace typechecks remain green.
- Add tests for any extracted state-to-presentation helpers or behavior-affecting component logic.
- Verify manually in the iOS Simulator using every mock fixture: `error`, `correct`, `suspect`, `unreadable`, and `not-math`.
- Verify the network failure recovery state with the server stopped.
- Verify gallery and simulated-camera entry paths.
- Verify the result with short and long explanations and at least four steps.
- Verify no screen reintroduces the old navy/indigo palette, emoji navigation, large colored banners, or generic stacked cards.
- Verify the full submission path fits the demo narrative: capture, staged analysis, localized error, explanation, follow-up, retry, correct state, and Insights.

## Demo Gallery

Populate the booted simulator with the available synthetic and FERMAT JPEG fixtures after implementation. This gives the user several correct, incorrect, unreadable, and handwritten examples to select during testing and recording without changing the repository's runtime behavior.
