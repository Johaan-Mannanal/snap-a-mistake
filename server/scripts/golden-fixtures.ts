import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GoldenCase } from './judge.js'

export const GOLDEN_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'golden')
export const GOLDEN_PHOTO_DIR = path.join(GOLDEN_DIR, 'photos')

export type GoldenFixture = {
  goldenCase: GoldenCase
  base64: string
}

export async function preflightGoldenCases(
  cases: GoldenCase[],
  photoDirectory = GOLDEN_PHOTO_DIR,
): Promise<GoldenFixture[]> {
  if (cases.length === 0) {
    throw new Error('Golden preflight selected no cases. Check GOLDEN_SOURCE and the golden manifest.')
  }

  const reads = await Promise.all(cases.map(async (goldenCase) => {
    const photo = path.join(photoDirectory, goldenCase.file)
    try {
      const bytes = await readFile(photo)
      return { fixture: { goldenCase, base64: bytes.toString('base64') } }
    } catch (error) {
      return {
        failure: {
          goldenCase,
          reason: error instanceof Error ? error.message : String(error),
        },
      }
    }
  }))
  const failures = reads.flatMap((read) => read.failure ? [read.failure] : [])

  if (failures.length > 0) {
    const details = failures.map(({ goldenCase, reason }) => `- ${goldenCase.file}: ${reason}`).join('\n')
    const hints = []
    if (failures.some(({ goldenCase }) => goldenCase.source === 'synthetic')) {
      hints.push('Generate the synthetic fixtures with `npm run gen-synthetic -w server`, then rerun the gate.')
    }
    if (failures.some(({ goldenCase }) => goldenCase.source === 'fermat')) {
      hints.push('Restore the committed FERMAT fixtures before rerunning the gate.')
    }
    throw new Error(
      `Golden fixture preflight could not read ${failures.length} selected photo(s):\n${details}\n${hints.join('\n')}`,
    )
  }

  return reads.flatMap((read) => read.fixture ? [read.fixture] : [])
}
