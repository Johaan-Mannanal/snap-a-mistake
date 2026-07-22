# Focus Lens App Icon and CodeRabbit Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every generic Expo icon surface with the approved Focus Lens identity, verify it technically and visually, and complete a CodeRabbit review of all committed code plus the current physical-device edits.

**Architecture:** One canonical SVG mark in `app/assets/brand` feeds a deterministic Sharp-based generator in the existing server tooling workspace. The generator produces the universal, Android, splash, favicon, and iOS Icon Composer assets; Vitest verifies dimensions, opacity, colors, and configuration references. CodeRabbit then reviews the repository from its root commit and separately reviews current uncommitted device-build edits so no tracked code is skipped.

**Tech Stack:** SVG, Sharp 0.33, TypeScript/tsx, Vitest, Expo SDK 57 configuration, iOS Icon Composer `.icon`, CodeRabbit CLI 0.7.

## Global Constraints

- Use Ink `#050505`, white `#F7F7F7`, and one Signal-blue `#1473E6` focus point.
- Do not use text, gradients, shadows, glass effects, rounded corners baked into the universal bitmap, or generic Expo branding.
- Keep the camera geometry inside platform safe zones and legible at 48 × 48 pixels and in grayscale.
- Generate every raster output from `app/assets/brand/focus-lens-mark.svg`.
- Preserve the existing uncommitted physical-device changes in `app/app.json` and `app/package.json`; never stage those files as part of icon commits.
- Leave ignored generated native directories `app/ios` and `app/android` untracked.
- Treat CodeRabbit findings as review input: verify each finding before changing code, use test-first fixes for behavior changes, and document rejected findings technically.
- Do not represent CodeRabbit as complete until authentication, storage, backend, and WebSocket readiness checks pass.

---

## File Map

- Create `app/assets/brand/focus-lens-mark.svg` — single canonical full-color vector mark.
- Create `server/scripts/gen-app-icons.ts` — deterministic asset renderer and CLI.
- Create `server/test/app-icon-assets.test.ts` — output dimensions, transparency, color, and Icon Composer regression coverage.
- Modify `server/package.json` — add the `gen-app-icons` command using existing `tsx` and `sharp` dependencies.
- Replace `app/assets/images/icon.png` — opaque 1024 × 1024 universal icon.
- Replace `app/assets/images/android-icon-background.png` — opaque Ink adaptive background.
- Replace `app/assets/images/android-icon-foreground.png` — transparent full-color adaptive foreground.
- Replace `app/assets/images/android-icon-monochrome.png` — transparent white monochrome mark.
- Replace `app/assets/images/favicon.png` — opaque 48 × 48 web icon.
- Replace `app/assets/images/splash-icon.png` — transparent white splash mark.
- Modify `app/assets/expo.icon/icon.json` — Ink fill and Focus Lens layer.
- Create `app/assets/expo.icon/Assets/focus-lens-mark.svg` — copied canonical mark for Icon Composer.
- Delete `app/assets/expo.icon/Assets/expo-symbol 2.svg` — remove template branding.
- Delete `app/assets/expo.icon/Assets/grid.png` — remove template grid.
- Create `.superpowers/sdd/coderabbit-full-review.md` — ignored audit report of CodeRabbit commands, findings, decisions, and rerun status.

---

### Task 1: Deterministic Focus Lens asset pipeline

**Files:**
- Create: `app/assets/brand/focus-lens-mark.svg`
- Create: `server/scripts/gen-app-icons.ts`
- Create: `server/test/app-icon-assets.test.ts`
- Modify: `server/package.json`
- Generate: `app/assets/images/*.png`
- Modify: `app/assets/expo.icon/icon.json`
- Create: `app/assets/expo.icon/Assets/focus-lens-mark.svg`
- Delete: `app/assets/expo.icon/Assets/expo-symbol 2.svg`
- Delete: `app/assets/expo.icon/Assets/grid.png`

**Interfaces:**
- Consumes: repository root containing `app/assets/brand/focus-lens-mark.svg`.
- Produces: `renderFocusLensAssets(repoRoot: string): Promise<string[]>`, returning repo-relative paths for every generated asset.

- [ ] **Step 1: Record the user-owned device-edit fingerprint**

Run:

```bash
git diff -- app/app.json app/package.json | shasum -a 256
git status --short
```

Expected: `app/app.json` and `app/package.json` are modified before icon work. Save the hash in the task report and require the identical hash after the icon commit.

- [ ] **Step 2: Write the failing asset regression test**

Create `server/test/app-icon-assets.test.ts`:

```ts
import { mkdtemp, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { describe, expect, test } from 'vitest'
import { renderFocusLensAssets } from '../scripts/gen-app-icons.js'

async function pixel(file: string, left: number, top: number) {
  const { data } = await sharp(file)
    .extract({ left, top, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return [...data.subarray(0, 3)]
}

describe('Focus Lens icon assets', () => {
  test('renders every platform asset from the canonical mark', async () => {
    const sourceRoot = fileURLToPath(new URL('../../', import.meta.url))
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'snap-focus-lens-'))
    const generated = await renderFocusLensAssets(tempRoot, sourceRoot)

    expect(generated).toEqual([
      'app/assets/images/icon.png',
      'app/assets/images/android-icon-background.png',
      'app/assets/images/android-icon-foreground.png',
      'app/assets/images/android-icon-monochrome.png',
      'app/assets/images/favicon.png',
      'app/assets/images/splash-icon.png',
      'app/assets/expo.icon/Assets/focus-lens-mark.svg',
      'app/assets/expo.icon/icon.json',
    ])

    const expected = [
      ['icon.png', 1024, 1024, false],
      ['android-icon-background.png', 512, 512, false],
      ['android-icon-foreground.png', 512, 512, true],
      ['android-icon-monochrome.png', 432, 432, true],
      ['favicon.png', 48, 48, false],
      ['splash-icon.png', 228, 213, true],
    ] as const

    for (const [name, width, height, hasAlpha] of expected) {
      const metadata = await sharp(path.join(tempRoot, 'app/assets/images', name)).metadata()
      expect([metadata.width, metadata.height, metadata.hasAlpha], name).toEqual([width, height, hasAlpha])
    }

    expect(await pixel(path.join(tempRoot, 'app/assets/images/icon.png'), 0, 0)).toEqual([5, 5, 5])
    expect(await pixel(path.join(tempRoot, 'app/assets/images/icon.png'), 512, 512)).toEqual([20, 115, 230])

    const composer = await readFile(path.join(tempRoot, 'app/assets/expo.icon/icon.json'), 'utf8')
    expect(composer).toContain('focus-lens-mark.svg')
    expect(composer).not.toMatch(/expo-symbol|grid\.png/i)
  })
})
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
npm test -w server -- app-icon-assets.test.ts
```

Expected: FAIL because `server/scripts/gen-app-icons.ts` does not exist.

- [ ] **Step 4: Add the canonical Focus Lens vector**

Create `app/assets/brand/focus-lens-mark.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g fill="none" stroke="#F7F7F7" stroke-width="48" stroke-linecap="round" stroke-linejoin="round">
    <rect x="232" y="288" width="560" height="448" rx="120"/>
    <circle cx="512" cy="512" r="140"/>
    <path d="M366 288l44-66h204l44 66"/>
  </g>
  <circle cx="512" cy="512" r="44" fill="#1473E6"/>
</svg>
```

- [ ] **Step 5: Implement the generator**

Create `server/scripts/gen-app-icons.ts`:

```ts
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const INK = { r: 5, g: 5, b: 5, alpha: 1 }
const OUTPUTS = [
  'app/assets/images/icon.png',
  'app/assets/images/android-icon-background.png',
  'app/assets/images/android-icon-foreground.png',
  'app/assets/images/android-icon-monochrome.png',
  'app/assets/images/favicon.png',
  'app/assets/images/splash-icon.png',
  'app/assets/expo.icon/Assets/focus-lens-mark.svg',
  'app/assets/expo.icon/icon.json',
]

function monochrome(svg: Buffer) {
  return Buffer.from(svg.toString('utf8').replaceAll('#1473E6', '#F7F7F7'))
}

async function opaqueIcon(mark: Buffer, width: number, height: number, file: string) {
  const rendered = await sharp(mark).resize({ width, height, fit: 'contain' }).png().toBuffer()
  await sharp({ create: { width, height, channels: 4, background: INK } })
    .composite([{ input: rendered }])
    .removeAlpha()
    .png()
    .toFile(file)
}

async function transparentMark(mark: Buffer, width: number, height: number, file: string) {
  await sharp(mark).resize({ width, height, fit: 'contain' }).png().toFile(file)
}

export async function renderFocusLensAssets(targetRoot: string, sourceRoot = targetRoot) {
  const source = path.join(sourceRoot, 'app/assets/brand/focus-lens-mark.svg')
  const mark = await readFile(source)
  const mono = monochrome(mark)
  const images = path.join(targetRoot, 'app/assets/images')
  const composerAssets = path.join(targetRoot, 'app/assets/expo.icon/Assets')
  await mkdir(images, { recursive: true })
  await mkdir(composerAssets, { recursive: true })

  await opaqueIcon(mark, 1024, 1024, path.join(images, 'icon.png'))
  await sharp({ create: { width: 512, height: 512, channels: 3, background: INK } })
    .png().toFile(path.join(images, 'android-icon-background.png'))
  await transparentMark(mark, 512, 512, path.join(images, 'android-icon-foreground.png'))
  await transparentMark(mono, 432, 432, path.join(images, 'android-icon-monochrome.png'))
  await opaqueIcon(mark, 48, 48, path.join(images, 'favicon.png'))
  await transparentMark(mono, 228, 213, path.join(images, 'splash-icon.png'))
  await cp(source, path.join(composerAssets, 'focus-lens-mark.svg'))

  const composer = {
    fill: { 'automatic-gradient': 'extended-srgb:0.01961,0.01961,0.01961,1.00000' },
    groups: [{ layers: [{ 'image-name': 'focus-lens-mark.svg', name: 'Focus Lens' }] }],
    'supported-platforms': { circles: ['watchOS'], squares: 'shared' },
  }
  await writeFile(
    path.join(targetRoot, 'app/assets/expo.icon/icon.json'),
    `${JSON.stringify(composer, null, 2)}\n`,
  )
  return OUTPUTS
}

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const file of await renderFocusLensAssets(repoRoot)) console.log('wrote', file)
}
```

- [ ] **Step 6: Add the generator command**

Add this exact entry to `server/package.json` scripts after `gen-synthetic`:

```json
"gen-app-icons": "tsx scripts/gen-app-icons.ts"
```

- [ ] **Step 7: Run GREEN and generate the committed assets**

Run:

```bash
npm test -w server -- app-icon-assets.test.ts
npm run gen-app-icons -w server
```

Expected: focused test PASS; generator prints eight `wrote` lines.

- [ ] **Step 8: Remove the old Icon Composer template layers**

Delete only:

```text
app/assets/expo.icon/Assets/expo-symbol 2.svg
app/assets/expo.icon/Assets/grid.png
```

Then run:

```bash
rg -n "expo-symbol|grid\.png|automatic-gradient.*0\.47843" app/assets app/app.json
```

Expected: no matches.

- [ ] **Step 9: Verify the user-owned diff is unchanged**

Run the same fingerprint command from Step 1:

```bash
git diff -- app/app.json app/package.json | shasum -a 256
```

Expected: hash exactly matches Step 1.

- [ ] **Step 10: Commit only the icon pipeline and assets**

Stage explicit paths; do not stage `app/app.json` or `app/package.json`:

```bash
git add app/assets/brand app/assets/images app/assets/expo.icon server/scripts/gen-app-icons.ts server/test/app-icon-assets.test.ts server/package.json
git diff --cached --check
git diff --cached --name-only
git commit -m "feat(app): add Focus Lens icon family"
```

Expected staged names: only the icon source/assets, generator, test, and `server/package.json`.

---

### Task 2: Expo configuration and visual verification

**Files:**
- Verify: `app/app.json`
- Verify: all generated icon assets from Task 1.
- Create ignored evidence: `.superpowers/sdd/focus-lens-icon-preview.png`

**Interfaces:**
- Consumes: generated Focus Lens assets and existing Expo configuration paths.
- Produces: configuration, pixel-level, masked-size, and physical-device evidence.

- [ ] **Step 1: Resolve Expo configuration**

Run:

```bash
cd app
npx expo config --type public
```

Expected: exit 0; `icon`, `ios.icon`, adaptive icon paths, favicon, and splash icon all resolve to existing Focus Lens assets.

- [ ] **Step 2: Run technical asset inspection**

Run from the repository root:

```bash
npm test -w server -- app-icon-assets.test.ts
for file in app/assets/images/*.png; do sips -g pixelWidth -g pixelHeight -g hasAlpha "$file"; done
```

Expected: dimensions and alpha match the test matrix; universal icon and adaptive background are opaque.

- [ ] **Step 3: Generate a contact sheet**

Run:

```bash
mkdir -p .superpowers/sdd
magick app/assets/images/icon.png -resize 256x256 /tmp/focus-256.png
magick app/assets/images/icon.png -resize 64x64 /tmp/focus-64.png
magick app/assets/images/icon.png -resize 48x48 /tmp/focus-48.png
magick montage /tmp/focus-256.png /tmp/focus-64.png /tmp/focus-48.png -tile 3x1 -geometry +32+32 -background '#181818' .superpowers/sdd/focus-lens-icon-preview.png
```

Expected: preview contains crisp 256, 64, and 48-pixel versions without clipped strokes or a lost blue focus point. Inspect it with the image viewer.

- [ ] **Step 4: Rebuild and inspect on the physical iPhone**

With the iPhone connected, trusted, and in Developer Mode, run:

```bash
cd app
SNAP_LAN_IP="$(ipconfig getifaddr en0)"
EXPO_PUBLIC_API_URL="http://${SNAP_LAN_IP}:3000" npx expo run:ios --device
```

Expected: Snap-a-Mistake installs with the Focus Lens home-screen icon. Inspect the icon on light and dark wallpapers and confirm the actual camera flow still opens.

- [ ] **Step 5: Run the automated gate**

Run from the repository root:

```bash
npm test
npm run typecheck
git diff --check
git status --short
```

Expected: all tests/typechecks pass; only the preserved `app/app.json` and `app/package.json` user edits remain unstaged.

---

### Task 3: Full-repository CodeRabbit review and resolution

**Files:**
- Create ignored audit report: `.superpowers/sdd/coderabbit-full-review.md`
- Modify only files required to resolve verified CodeRabbit findings.

**Interfaces:**
- Consumes: committed current code at HEAD plus preserved uncommitted device-build changes.
- Produces: authenticated CodeRabbit review evidence, disposition for every finding, clean rerun, and final automated verification.

- [ ] **Step 1: Authenticate CodeRabbit with user approval**

Run outside the filesystem/network sandbox:

```bash
coderabbit auth login --agent
```

Expected: CodeRabbit returns an authorization URL or browser flow. Pause for the user to complete login, then run:

```bash
coderabbit auth status
coderabbit doctor
```

Expected: authentication, storage, backend, and WebSocket checks all PASS.

- [ ] **Step 2: Review all committed code since the repository root**

Run:

```bash
SNAP_REVIEW_BASE="$(git rev-list --max-parents=0 HEAD)"
coderabbit review --agent --committed --base-commit "$SNAP_REVIEW_BASE"
```

Expected: CodeRabbit reviews the diff from `5e0665fe00ec3de8cf13c98d7f1b3ed85e43c93f`, whose only file was the initial design spec, through current HEAD. This includes all committed application, server, shared, configuration, test, and documentation code added afterward.

- [ ] **Step 3: Review preserved uncommitted device-build edits**

Run:

```bash
coderabbit review --agent --uncommitted --include-untracked
```

Expected: CodeRabbit separately reviews the current `app/app.json` and `app/package.json` edits and any intentional untracked, non-ignored file.

- [ ] **Step 4: Record and triage every finding**

Create `.superpowers/sdd/coderabbit-full-review.md` with these exact sections:

```markdown
# CodeRabbit Full Repository Review

## Readiness
- Authentication:
- Doctor:

## Committed review
- Base:
- Head:
- Findings:

## Uncommitted review
- Files:
- Findings:

## Disposition
| Finding | Severity | Verified evidence | Decision | Fix/test |
| --- | --- | --- | --- | --- |

## Rerun
- CodeRabbit:
- Tests:
- Typecheck:
- Diff check:
```

For each finding, inspect the cited file and reproduce the issue where possible. Do not change code merely because CodeRabbit suggested it.

- [ ] **Step 5: Fix verified findings test-first**

For each verified behavior defect:

1. Add one focused failing test.
2. Run it and capture the expected failure in the audit report.
3. Make the smallest production change.
4. Run the focused test and relevant workspace suite.
5. Commit the finding and its test together.

For configuration or documentation findings with no executable behavior, use `git diff --check`, Expo config resolution, or a focused static regression test as the verification appropriate to that finding.

- [ ] **Step 6: Rerun CodeRabbit after fixes**

Run both review scopes again:

```bash
SNAP_REVIEW_BASE="$(git rev-list --max-parents=0 HEAD)"
coderabbit review --agent --committed --base-commit "$SNAP_REVIEW_BASE"
coderabbit review --agent --uncommitted --include-untracked
```

Expected: no unresolved Critical or Important findings. Document any remaining Minor or rejected finding with evidence.

- [ ] **Step 7: Run final verification**

Run:

```bash
npm test
npm run typecheck
git diff --check
git diff --check "$(git rev-list --max-parents=0 HEAD)"..HEAD
git status --short
git log --oneline -8
```

Expected: all automated gates pass; committed branch range is whitespace-clean; only preserved user-owned physical-device edits remain unstaged unless the user separately approves committing them.

- [ ] **Step 8: Final handoff**

Report:

- Focus Lens asset commit(s);
- contact-sheet and physical-device inspection results;
- CodeRabbit readiness and exact review scopes;
- finding dispositions and fix commits;
- final test/typecheck counts;
- preserved uncommitted device configuration state;
- whether a rebuild is required before recording the demo.
