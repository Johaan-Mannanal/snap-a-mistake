# Premium Photo-First UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild every Snap-a-Mistake screen as a cohesive camera-first Night Gallery experience while preserving the existing analysis, history, and follow-up behavior.

**Architecture:** Add one centralized theme and a small set of stateless visual primitives, then migrate each existing screen from inline navy/indigo styling to those primitives. Keep navigation, session state, API calls, SQLite history, and shared response schemas unchanged; pure presentation helpers translate application state into tested labels and semantic tones.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router, `expo-camera`, `expo-image-picker`, `expo-symbols`, `react-native-safe-area-context`, TypeScript, Vitest.

## Global Constraints

- Primary surfaces use Ink `#050505`, Graphite `#121212`, Carbon `#242424`, Chalk `#F5F5F3`, and Muted `#98989D`.
- Signal blue `#1473E6` is restricted to rare active/focus states; it is not a large fill or gradient.
- Error red `#FF5C67` and success green `#36D17C` appear only as compact semantic marks or rails.
- Use native system typography and a monospaced face only for step numbers or technical labels.
- Maintain 44-point minimum touch targets, high contrast, and non-color semantic labels.
- Preserve all API, session, history, response-kind, gallery, camera, and follow-up behavior.
- Use only dependencies already present in `app/package.json`; do not add a gallery/media-library permission.
- Follow the versioned Expo SDK 57 APIs for [Symbols](https://docs.expo.dev/versions/v57.0.0/sdk/symbols/), [Camera](https://docs.expo.dev/versions/v57.0.0/sdk/camera/), [ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/), and [safe-area-context](https://docs.expo.dev/versions/v57.0.0/sdk/safe-area-context/).
- The deterministic mock disclosure remains a video-production requirement and must not be represented as live GPT output.

---

## File Structure

### New files

- `app/src/ui/theme.ts` — approved color, spacing, radius, and type tokens plus tested button palettes.
- `app/src/ui/presentation.ts` — pure camera, analysis, and trend presentation helpers.
- `app/src/ui/theme.test.ts` — token and button-variant regression tests.
- `app/src/ui/presentation.test.ts` — copy and semantic-state regression tests.
- `app/src/components/AppScreen.tsx` — dark safe-area and scroll shell.
- `app/src/components/AppButton.tsx` — primary, secondary, tertiary, and disabled actions.
- `app/src/components/AppIcon.tsx` — SDK 57 `SymbolView` wrapper with text fallback.
- `app/src/components/CameraCorners.tsx` — four-corner capture guide.
- `app/src/components/AnalysisProgress.tsx` — photo-backed three-stage progress sequence.

### Modified files

- `app/app/_layout.tsx` — Ink stack background and light status-bar treatment.
- `app/app/index.tsx` — Night Gallery camera, permission state, and gallery controls.
- `app/app/analyze.tsx` — photo-backed progress, premium response states, and result hierarchy.
- `app/app/followup.tsx` — quiet problem canvas and consistent actions.
- `app/app/insights.tsx` — monochrome trend list and empty state.
- `app/src/components/PhotoOverlay.tsx` — thin diagnostic rail with semantic label.
- `app/src/components/StepCard.tsx` — numbered timeline row instead of rounded card.

### Removed file

- `app/src/components/Screen.tsx` — superseded after all imports move to `AppScreen`.

---

### Task 1: Theme and reusable primitives

**Files:**
- Create: `app/src/ui/theme.test.ts`
- Create: `app/src/ui/theme.ts`
- Create: `app/src/components/AppButton.tsx`
- Create: `app/src/components/AppScreen.tsx`
- Create: `app/src/components/AppIcon.tsx`

**Interfaces:**
- Produces: `colors`, `spacing`, `radii`, `typeScale`, `buttonPalette(variant, disabled)` from `src/ui/theme.ts`.
- Produces: `<AppButton label variant onPress disabled />`, `<AppScreen scroll contentStyle children />`, and `<AppIcon name size color fallback />`.
- Consumes: SDK 57 `SymbolView`; no new dependencies.

- [ ] **Step 1: Write the failing theme tests**

```ts
// app/src/ui/theme.test.ts
import { describe, expect, it } from 'vitest'
import { buttonPalette, colors } from './theme'

describe('Night Gallery theme', () => {
  it('uses the approved palette without the old navy or indigo', () => {
    expect(colors).toMatchObject({
      ink: '#050505', graphite: '#121212', carbon: '#242424', chalk: '#F5F5F3',
      muted: '#98989D', blue: '#1473E6', error: '#FF5C67', success: '#36D17C',
    })
    expect(Object.values(colors)).not.toContain('#0f172a')
    expect(Object.values(colors)).not.toContain('#6366f1')
  })

  it('keeps the primary action monochrome and disabled actions quiet', () => {
    expect(buttonPalette('primary', false)).toEqual({ background: colors.chalk, foreground: colors.ink, border: colors.chalk })
    expect(buttonPalette('secondary', false)).toEqual({ background: colors.ink, foreground: colors.chalk, border: colors.carbon })
    expect(buttonPalette('primary', true)).toEqual({ background: colors.carbon, foreground: colors.muted, border: colors.carbon })
  })
})
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -w app -- src/ui/theme.test.ts`

Expected: FAIL because `src/ui/theme.ts` does not exist.

- [ ] **Step 3: Implement the theme tokens and palette helper**

```ts
// app/src/ui/theme.ts
export const colors = {
  ink: '#050505', graphite: '#121212', carbon: '#242424', chalk: '#F5F5F3',
  muted: '#98989D', blue: '#1473E6', error: '#FF5C67', success: '#36D17C',
} as const

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const
export const radii = { sm: 8, md: 12, lg: 18, round: 999 } as const
export const typeScale = { caption: 12, body: 15, title: 24, display: 32 } as const

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary'

export function buttonPalette(variant: ButtonVariant, disabled: boolean) {
  if (disabled) return { background: colors.carbon, foreground: colors.muted, border: colors.carbon }
  if (variant === 'primary') return { background: colors.chalk, foreground: colors.ink, border: colors.chalk }
  if (variant === 'secondary') return { background: colors.ink, foreground: colors.chalk, border: colors.carbon }
  return { background: 'transparent', foreground: colors.muted, border: 'transparent' }
}
```

- [ ] **Step 4: Implement the visual primitives**

`AppButton` must use a `Pressable` style callback, 52-point minimum height, `accessibilityRole="button"`, `accessibilityState={{ disabled }}`, and `buttonPalette`. `AppScreen` must use Ink, `SafeAreaView`, and optionally a `ScrollView` with 20-point horizontal padding. `AppIcon` must wrap SDK 57 `SymbolView` and accept an explicit fallback.

```tsx
// app/src/components/AppIcon.tsx
import { Text } from 'react-native'
import { SymbolView, type SFSymbol } from 'expo-symbols'
import { colors } from '../ui/theme'

export function AppIcon(props: { name: SFSymbol; size?: number; color?: string; fallback: string }) {
  const size = props.size ?? 20
  return (
    <SymbolView
      name={props.name}
      size={size}
      tintColor={props.color ?? colors.chalk}
      type="monochrome"
      fallback={<Text style={{ color: props.color ?? colors.chalk, fontSize: size }}>{props.fallback}</Text>}
    />
  )
}
```

```tsx
// app/src/components/AppButton.tsx
import { Pressable, StyleSheet, Text } from 'react-native'
import { buttonPalette, colors, radii, type ButtonVariant } from '../ui/theme'

export function AppButton(props: { label: string; onPress?: () => void; disabled?: boolean; variant?: ButtonVariant }) {
  const variant = props.variant ?? 'primary'
  const palette = buttonPalette(variant, props.disabled ?? false)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [styles.base, { backgroundColor: palette.background, borderColor: palette.border, opacity: pressed ? 0.72 : 1 }]}
    >
      <Text style={[styles.label, { color: palette.foreground }]}>{props.label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: { minHeight: 52, borderWidth: 1, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  label: { color: colors.chalk, fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
})
```

```tsx
// app/src/components/AppScreen.tsx
import type { PropsWithChildren } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, spacing } from '../ui/theme'

export function AppScreen(props: PropsWithChildren<{ scroll?: boolean; contentStyle?: StyleProp<ViewStyle> }>) {
  const content = props.scroll === false ? (
    <View style={[styles.fixed, props.contentStyle]}>{props.children}</View>
  ) : (
    <ScrollView contentContainerStyle={[styles.content, props.contentStyle]}>{props.children}</ScrollView>
  )
  return <SafeAreaView style={styles.safe}>{content}</SafeAreaView>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  fixed: { flex: 1, paddingHorizontal: spacing.xl },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.lg },
})
```

- [ ] **Step 5: Verify GREEN and type safety**

Run: `npm test -w app -- src/ui/theme.test.ts`

Expected: 2 tests PASS.

Run: `npm run typecheck -w app`

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/src/ui/theme.ts app/src/ui/theme.test.ts app/src/components/AppButton.tsx app/src/components/AppScreen.tsx app/src/components/AppIcon.tsx
git commit -m "feat(app): add Night Gallery design primitives"
```

---

### Task 2: Camera, framing, and permission experience

**Files:**
- Create: `app/src/ui/presentation.test.ts`
- Create: `app/src/ui/presentation.ts`
- Create: `app/src/components/CameraCorners.tsx`
- Modify: `app/app/index.tsx`
- Modify: `app/app/_layout.tsx`

**Interfaces:**
- Consumes: `colors`, `spacing`, `AppButton`, `AppIcon` from Task 1.
- Produces: `cameraPresentation(isRetry: boolean)` and `<CameraCorners />`.
- Preserves: `CameraView`, `takePictureAsync({ quality: 0.7 })`, `launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })`, `setPhoto`, and routes.

- [ ] **Step 1: Write the failing camera-presentation tests**

```ts
// initial section of app/src/ui/presentation.test.ts
import { describe, expect, it } from 'vitest'
import { cameraPresentation } from './presentation'

describe('cameraPresentation', () => {
  it('uses direct capture guidance', () => {
    expect(cameraPresentation(false)).toEqual({ eyebrow: 'SNAP', instruction: 'Keep one problem inside the frame' })
  })

  it('labels a follow-up attempt without changing the instruction', () => {
    expect(cameraPresentation(true)).toEqual({ eyebrow: 'FOLLOW-UP', instruction: 'Keep one problem inside the frame' })
  })
})
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -w app -- src/ui/presentation.test.ts`

Expected: FAIL because `presentation.ts` does not exist.

- [ ] **Step 3: Implement the minimal camera helper**

```ts
// initial app/src/ui/presentation.ts
export function cameraPresentation(isRetry: boolean) {
  return { eyebrow: isRetry ? 'FOLLOW-UP' : 'SNAP', instruction: 'Keep one problem inside the frame' } as const
}
```

- [ ] **Step 4: Implement the framing component**

`CameraCorners` renders four absolutely positioned 26-by-26 corner views with two Chalk borders each, 42 points inside the horizontal edges and 104/126 points from top/bottom. It must use `pointerEvents="none"` and 0.72 opacity.

```tsx
// app/src/components/CameraCorners.tsx
import { StyleSheet, View } from 'react-native'
import { colors } from '../ui/theme'

export function CameraCorners() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.corner, styles.topLeft]} /><View style={[styles.corner, styles.topRight]} />
      <View style={[styles.corner, styles.bottomLeft]} /><View style={[styles.corner, styles.bottomRight]} />
    </View>
  )
}

const base = { position: 'absolute' as const, width: 26, height: 26, borderColor: colors.chalk, opacity: 0.72 }
const styles = StyleSheet.create({
  corner: base,
  topLeft: { left: 42, top: 104, borderLeftWidth: 1.5, borderTopWidth: 1.5 },
  topRight: { right: 42, top: 104, borderRightWidth: 1.5, borderTopWidth: 1.5 },
  bottomLeft: { left: 42, bottom: 126, borderLeftWidth: 1.5, borderBottomWidth: 1.5 },
  bottomRight: { right: 42, bottom: 126, borderRightWidth: 1.5, borderBottomWidth: 1.5 },
})
```

- [ ] **Step 5: Rebuild the camera and permission layouts**

In `app/app/index.tsx`, retain the existing `snap`, `pick`, and `usePhoto` functions. Replace emoji/text controls with:

- a top safe-area row containing `snap` or `follow-up` and an Insights `AppIcon` using `chart.line.uptrend.xyaxis`;
- `CameraCorners` and centered instruction copy;
- a bottom safe-area row containing a 48-point gallery `Pressable` with `photo`, a 76-point double-ring shutter, and a 48-point Insights control;
- black permission state with “Camera access” title, one `Allow camera` primary button, and `Choose from library` tertiary button.

Use `accessibilityLabel` on all icon-only controls. Do not request media-library permission before `launchImageLibraryAsync`; SDK 57's image-only system picker does not require it for this flow.

- [ ] **Step 6: Update the root shell**

In `app/app/_layout.tsx`, set the Stack content background to `colors.ink` and add `<StatusBar style="light" />` from `expo-status-bar`.

- [ ] **Step 7: Verify and commit**

Run: `npm test -w app -- src/ui/presentation.test.ts`

Expected: 2 tests PASS.

Run: `npm run typecheck -w app`

Expected: exit 0.

Manual check: camera is edge to edge; gallery, shutter, and Insights controls are tappable; permission fallback still opens the gallery.

```bash
git add app/app/index.tsx app/app/_layout.tsx app/src/ui/presentation.ts app/src/ui/presentation.test.ts app/src/components/CameraCorners.tsx
git commit -m "feat(app): redesign the camera experience"
```

---

### Task 3: Photo-backed analysis progress and result presentation

**Files:**
- Modify: `app/src/ui/presentation.test.ts`
- Modify: `app/src/ui/presentation.ts`
- Create: `app/src/components/AnalysisProgress.tsx`
- Modify: `app/src/components/PhotoOverlay.tsx`
- Modify: `app/src/components/StepCard.tsx`
- Modify: `app/app/analyze.tsx`

**Interfaces:**
- Consumes: `AnalyzeResponse`, `Step`, theme primitives, and session/API functions.
- Produces: `analysisPresentation(response)` with `{ tone, eyebrow, headline, detail }` and `trendPresentation` in Task 4.
- Produces: `<AnalysisProgress uri stage stages />`.
- Preserves: analysis timing, retry, history recording, follow-up routing, and response-kind behavior.

- [ ] **Step 1: Write failing result-presentation tests**

Append to `app/src/ui/presentation.test.ts`:

```ts
import type { AnalyzeResponse } from '@snap/shared'
import { analysisPresentation } from './presentation'

const base = { kind: 'analysis', steps: [], verifierAgreed: true } as const

describe('analysisPresentation', () => {
  it('presents correct work without a green banner', () => {
    const response: AnalyzeResponse = { ...base, errorStepIndex: null, misconceptionTag: null, explanation: null, followUp: null }
    expect(analysisPresentation(response)).toMatchObject({ tone: 'success', eyebrow: 'VERIFIED', headline: 'All steps check out' })
  })

  it('localizes an agreed error', () => {
    const response: AnalyzeResponse = {
      ...base, errorStepIndex: 1, misconceptionTag: 'integration-by-parts-error', explanation: 'Extra x.',
      followUp: { problem: 'Try again.', concept: 'integration by parts' },
    }
    expect(analysisPresentation(response)).toEqual({
      tone: 'error', eyebrow: 'INTEGRATION BY PARTS ERROR', headline: 'The first break is in step two.', detail: 'Extra x.',
    })
  })

  it('softens verifier disagreement', () => {
    const response: AnalyzeResponse = {
      ...base, verifierAgreed: false, errorStepIndex: 2, misconceptionTag: 'other', explanation: 'Check this transition.',
      followUp: { problem: 'Try again.', concept: 'review' },
    }
    expect(analysisPresentation(response)).toMatchObject({ tone: 'neutral', headline: 'Step three needs a second look.' })
  })
})
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run: `npm test -w app -- src/ui/presentation.test.ts`

Expected: FAIL because `analysisPresentation` is not exported.

- [ ] **Step 3: Implement result presentation**

Use an ordinal helper for one through ten and fall back to the numeric step label. Import `tagLabel` for the eyebrow.

```ts
import type { AnalyzeResponse } from '@snap/shared'
import { tagLabel } from '../lib/labels'

const ORDINAL = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'] as const

export function analysisPresentation(response: Extract<AnalyzeResponse, { kind: 'analysis' }>) {
  if (response.errorStepIndex === null) {
    return { tone: 'success' as const, eyebrow: 'VERIFIED', headline: 'All steps check out', detail: 'Every step follows from the last.' }
  }
  const step = ORDINAL[response.errorStepIndex] ?? String(response.errorStepIndex + 1)
  if (!response.verifierAgreed) {
    return { tone: 'neutral' as const, eyebrow: 'SECOND LOOK', headline: `Step ${step} needs a second look.`, detail: response.explanation ?? '' }
  }
  return {
    tone: 'error' as const,
    eyebrow: response.misconceptionTag ? tagLabel(response.misconceptionTag).toUpperCase() : 'FIRST BREAK',
    headline: `The first break is in step ${step}.`,
    detail: response.explanation ?? '',
  }
}
```

- [ ] **Step 4: Build the photo-backed progress component**

`AnalysisProgress` must render the submitted image edge to edge, a `rgba(0,0,0,0.62)` scrim, and the three stages in a bottom panel. Each row uses a 20-point status column: completed `✓`, active 6-point Chalk dot, upcoming 6-point Carbon dot. It accepts the existing `STAGES` array and numeric `stage` without owning timers.

```tsx
// app/src/components/AnalysisProgress.tsx
import { Image, StyleSheet, Text, View } from 'react-native'
import { colors, spacing } from '../ui/theme'

export function AnalysisProgress(props: { uri: string; stage: number; stages: readonly string[] }) {
  return (
    <View style={styles.root}>
      <Image source={{ uri: props.uri }} resizeMode="cover" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>ANALYZING</Text>
        {props.stages.map((label, index) => {
          const complete = index < props.stage
          const active = index === props.stage
          return (
            <View key={label} style={styles.row}>
              <Text style={[styles.mark, { color: complete ? colors.success : active ? colors.chalk : colors.carbon }]}>
                {complete ? '✓' : '•'}
              </Text>
              <Text style={[styles.label, { color: active ? colors.chalk : colors.muted }]}>{label}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  scrim: { backgroundColor: 'rgba(0,0,0,0.62)' },
  panel: { position: 'absolute', left: spacing.xl, right: spacing.xl, bottom: 54, gap: spacing.md },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.6, marginBottom: spacing.sm },
  row: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mark: { width: 20, fontSize: 16, textAlign: 'center' },
  label: { fontSize: 16, fontWeight: '600' },
})
```

- [ ] **Step 5: Convert the overlay to a diagnostic rail**

Keep `Image.getSize`, `aspectRatio`, `bandStyle`, and flagged-step filtering. Replace the 3-point rounded rectangle and translucent fill with:

```tsx
<View
  key={s.index}
  pointerEvents="none"
  style={{
    position: 'absolute', left: 0, right: 0, top: b.top, height: b.height,
    borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: color,
    backgroundColor: s.verdict === 'wrong' ? 'rgba(255,92,103,0.06)' : 'rgba(245,245,243,0.05)',
  }}
>
  <Text style={{ alignSelf: 'flex-end', margin: 8, color, fontSize: 11, fontWeight: '700' }}>STEP {s.index + 1}</Text>
</View>
```

Use Error red only for `wrong`; use Chalk for `suspect`.

- [ ] **Step 6: Convert `StepCard` into a timeline row**

Keep its public props unchanged. Render a horizontal row with:

- two-digit monospaced index;
- semantic `✓`, `×`, or `↓` mark plus accessible verdict text;
- plain transcription as primary text and LaTeX as muted monospaced text;
- expanded misconception and explanation only for `wrong` or `suspect`;
- a top hairline divider, no card background, no rounded container, and no colored left border.

The target structure is:

```tsx
export function StepCard(props: { step: Step; misconceptionLabel: string | null; explanation: string | null }) {
  const expanded = props.step.verdict === 'wrong' || props.step.verdict === 'suspect'
  const mark = props.step.verdict === 'ok' ? '✓' : props.step.verdict === 'wrong' ? '×' : props.step.verdict === 'suspect' ? '?' : '↓'
  const color = props.step.verdict === 'ok' ? colors.success : props.step.verdict === 'wrong' ? colors.error : colors.muted
  return (
    <View style={styles.row} accessible accessibilityLabel={`Step ${props.step.index + 1}, ${props.step.verdict}`}>
      <Text style={styles.index}>{String(props.step.index + 1).padStart(2, '0')}</Text>
      <Text style={[styles.mark, { color }]}>{mark}</Text>
      <View style={styles.copy}>
        <Text style={styles.plain}>{props.step.plain}</Text>
        <Text style={styles.latex}>{props.step.latex}</Text>
        {expanded && props.misconceptionLabel ? <Text style={[styles.tag, { color }]}>{props.misconceptionLabel.toUpperCase()}</Text> : null}
        {expanded && props.explanation ? <Text style={styles.explanation}>{props.explanation}</Text> : null}
      </View>
    </View>
  )
}
```

Define `styles.row` with `borderTopWidth: StyleSheet.hairlineWidth` and Carbon, `styles.index` and `styles.latex` with `fontFamily: 'Courier'`, and all text colors from the approved theme.

- [ ] **Step 7: Recompose the analysis screen**

In `app/app/analyze.tsx`:

- replace the local `Button` with `AppButton`;
- render `AnalysisProgress` while pending;
- render a compact top bar, `PhotoOverlay`, diagnosis block from `analysisPresentation`, and timeline rows for analysis results;
- correct state uses only a compact Success green check and monochrome text;
- primary label becomes `Try a simpler problem`;
- disabled label becomes `Video lesson — coming soon` without emoji;
- tertiary label remains `Snap another`;
- network, not-math, and unreadable states use direct copy without emoji and preserve existing actions.

- [ ] **Step 8: Verify and commit**

Run: `npm test -w app -- src/ui/presentation.test.ts src/lib/overlay.test.ts`

Expected: all targeted tests PASS.

Run: `npm run typecheck -w app`

Expected: exit 0.

Manual check with `MOCK=error`, `MOCK=correct`, and `MOCK=suspect`: the photo appears during progress and results; only the first flagged line expands; no colored result banner remains.

```bash
git add app/app/analyze.tsx app/src/ui/presentation.ts app/src/ui/presentation.test.ts app/src/components/AnalysisProgress.tsx app/src/components/PhotoOverlay.tsx app/src/components/StepCard.tsx
git commit -m "feat(app): redesign analysis around the photo"
```

---

### Task 4: Follow-up, Insights, and remaining states

**Files:**
- Modify: `app/src/ui/presentation.test.ts`
- Modify: `app/src/ui/presentation.ts`
- Modify: `app/app/followup.tsx`
- Modify: `app/app/insights.tsx`
- Remove: `app/src/components/Screen.tsx`

**Interfaces:**
- Consumes: `AppScreen`, `AppButton`, `AppIcon`, theme tokens, existing `TagSummary`.
- Produces: `trendPresentation(trend)` returning `{ label, color, symbol }`.
- Preserves: `startFollowUp`, `router.dismissTo('/')`, `loadHistory`, and `summarize`.

- [ ] **Step 1: Write failing trend-presentation tests**

Append to `app/src/ui/presentation.test.ts`:

```ts
import { trendPresentation } from './presentation'
import { colors } from './theme'

describe('trendPresentation', () => {
  it.each([
    ['fewer', { label: 'Improving', color: colors.success, symbol: '↗' }],
    ['more', { label: 'Needs attention', color: colors.error, symbol: '↘' }],
    ['same', { label: 'Steady', color: colors.muted, symbol: '→' }],
  ] as const)('maps %s without decorative color', (trend, expected) => {
    expect(trendPresentation(trend)).toEqual(expected)
  })
})
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run: `npm test -w app -- src/ui/presentation.test.ts`

Expected: FAIL because `trendPresentation` is not exported.

- [ ] **Step 3: Implement the minimal trend helper**

```ts
import { colors } from './theme'

export function trendPresentation(trend: 'fewer' | 'more' | 'same') {
  if (trend === 'fewer') return { label: 'Improving', color: colors.success, symbol: '↗' } as const
  if (trend === 'more') return { label: 'Needs attention', color: colors.error, symbol: '↘' } as const
  return { label: 'Steady', color: colors.muted, symbol: '→' } as const
}
```

- [ ] **Step 4: Rebuild the follow-up screen**

Use `AppScreen`, an uppercase Muted concept eyebrow, 32-point Chalk problem text, a short Muted instruction, and a primary `Check my work` action. The missing-follow-up state uses `No follow-up yet`, explanatory copy, and a `Back to camera` secondary action. Preserve `startFollowUp()` before returning to `/`.

- [ ] **Step 5: Rebuild Insights**

Use a minimal top bar with chevron, 32-point `Patterns` title, and rows separated by Carbon hairlines. Each row shows label, `{count} this week`, and the tested trend label/symbol. The empty state says `No patterns yet` and explains that patterns appear after analyses; include a secondary `Back to camera` action.

- [ ] **Step 6: Remove the obsolete shell and verify no old visual language remains**

Delete `app/src/components/Screen.tsx` after confirming no imports remain.

Run:

```bash
rg -n "#0f172a|#1e293b|#6366f1|#312e81|#14532d|#451a03|📊|🖼️|🎬|😕|📐" app/app app/src/components
```

Expected: no matches.

- [ ] **Step 7: Verify and commit**

Run: `npm test -w app -- src/ui/presentation.test.ts src/lib/trends.test.ts src/lib/session.test.ts`

Expected: all targeted tests PASS.

Run: `npm run typecheck -w app`

Expected: exit 0.

```bash
git add app/app/followup.tsx app/app/insights.tsx app/src/ui/presentation.ts app/src/ui/presentation.test.ts app/src/components/Screen.tsx
git commit -m "feat(app): finish the Night Gallery screen set"
```

---

### Task 5: Full verification, simulator gallery, and submission-ready handoff

**Files:**
- No production file changes expected.
- Verify: all app, shared, and server files affected transitively by the workspace commands.

**Interfaces:**
- Consumes: the completed UI and existing mock fixtures.
- Produces: a booted simulator gallery populated with synthetic and FERMAT images plus fresh verification evidence.

- [ ] **Step 1: Run the complete automated gate**

Run: `npm test`

Expected: all workspace Vitest suites and all four Python importer tests PASS.

Run: `npm run typecheck`

Expected: shared, server, and app typechecks exit 0.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 2: Generate the complete synthetic photo set**

Run from the worktree root:

```bash
npm run gen-synthetic -w server
```

Expected: 15 `wrote ...jpg` lines ending with `faint-math.jpg`.

- [ ] **Step 3: Add every synthetic and FERMAT JPEG to the booted simulator**

Run:

```bash
xcrun simctl addmedia booted server/golden/photos/*.jpg
```

Expected: exit 0. Open Photos in the simulator and confirm algebra, calculus, blurry, non-math, and FERMAT handwriting examples appear.

- [ ] **Step 4: Verify the manual fixture matrix**

For each server command, restart the mock, choose any gallery photo, and verify the named state:

| Command | Expected UI |
|---|---|
| `MOCK=error npm run mock -w server` | red diagnostic rail, expanded first-break explanation, follow-up action |
| `MOCK=correct npm run mock -w server` | compact green check, “All steps check out,” clean timeline |
| `MOCK=suspect npm run mock -w server` | neutral second-look language, no confident red claim |
| `MOCK=unreadable npm run mock -w server` | direct readability tips and retake action |
| `MOCK=not-math npm run mock -w server` | math-only guidance and retake action |
| server stopped | retained-photo failure state with retry and alternate-photo actions |

- [ ] **Step 5: Capture visual evidence**

Take simulator screenshots of camera, analyzing, error result, correct result, follow-up, Insights, and failure states. Inspect each for clipping, safe-area collisions, old palette residue, emoji navigation, and unreadable contrast.

- [ ] **Step 6: Final status and hand off for whole-branch review**

Run:

```bash
git status --short
git log --oneline -6
```

Expected: clean status and the Night Gallery task commits at the top of the log. Do not push from this task. After the required whole-branch review passes, the controller publishes `HEAD` to remote `main` and reminds the user that the demo recording must retain the on-screen disclosure `DETERMINISTIC MOCK MODE — CANNED RESPONSE (NOT LIVE GPT-5.6).`
