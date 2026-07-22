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

async function alpha(file: string, left: number, top: number) {
  const { data } = await sharp(file)
    .extract({ left, top, width: 1, height: 1 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return data[3]
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

    const splash = path.join(tempRoot, 'app/assets/images/splash-icon.png')
    expect(await alpha(splash, 0, 0)).toBe(0)
    expect(await alpha(splash, 0, 106)).toBe(0)
    expect(await alpha(splash, 114, 106)).toBe(255)

    const composer = await readFile(path.join(tempRoot, 'app/assets/expo.icon/icon.json'), 'utf8')
    expect(composer).toContain('focus-lens-mark.svg')
    expect(composer).not.toMatch(/expo-symbol|grid\.png/i)
  })
})
