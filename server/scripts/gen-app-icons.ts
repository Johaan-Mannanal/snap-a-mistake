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
