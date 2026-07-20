import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GOLDEN_DIR,
  GOLDEN_PHOTO_DIR,
  preflightGoldenCases,
} from '../scripts/golden-fixtures.js'
import {
  GoldenManifestSchema,
  selectCases,
  type GoldenCase,
} from '../scripts/judge.js'

const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const temporaryDirectories: string[] = []

async function temporaryPhotoDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'snap-golden-preflight-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })))
  vi.doUnmock('openai')
  vi.doUnmock('../src/config.js')
  vi.doUnmock('../src/pipeline/run.js')
  vi.doUnmock('../scripts/golden-fixtures.js')
  vi.resetModules()
})

describe('golden fixture paths', () => {
  it('derives the photo directory from the current checkout', () => {
    expect(GOLDEN_DIR).toBe(path.join(serverDir, 'golden'))
    expect(GOLDEN_PHOTO_DIR).toBe(path.join(serverDir, 'golden', 'photos'))
  })

  it('keeps the synthetic generator free of author-specific checkout paths', async () => {
    const source = await readFile(path.join(serverDir, 'scripts', 'gen-synthetic.ts'), 'utf8')

    expect(source).not.toMatch(/\/Users\//)
    expect(source).toContain("from './golden-fixtures.js'")
    expect(source).toContain('GOLDEN_PHOTO_DIR')
  })
})

describe('golden runner initialization', () => {
  it('does not evaluate configuration or OpenAI modules when fixture preflight fails', async () => {
    const evaluations: string[] = []
    vi.doMock('openai', () => {
      evaluations.push('openai')
      return { default: class OpenAI {} }
    })
    vi.doMock('../src/config.js', () => {
      evaluations.push('config')
      return { loadConfig: () => { throw new Error('config must not load') } }
    })
    vi.doMock('../src/pipeline/run.js', () => {
      evaluations.push('pipeline')
      return { makeRunAnalysis: () => { throw new Error('pipeline must not load') } }
    })
    vi.doMock('../scripts/golden-fixtures.js', () => ({
      GOLDEN_DIR,
      preflightGoldenCases: async () => {
        evaluations.push('preflight')
        throw new Error('fixture preflight stopped the run')
      },
    }))

    await expect(import('../scripts/golden.js')).rejects.toThrow('fixture preflight stopped the run')
    expect(evaluations).toEqual(['preflight'])
  })
})

describe('preflightGoldenCases', () => {
  it('rejects an empty selection', async () => {
    await expect(preflightGoldenCases([], await temporaryPhotoDirectory())).rejects.toThrow(
      'Golden preflight selected no cases',
    )
  })

  it('reports every unreadable selected fixture and how to generate synthetic photos', async () => {
    const cases: GoldenCase[] = [
      { file: 'missing-one.jpg', source: 'synthetic', expect: 'correct' },
      { file: 'missing-two.jpg', source: 'synthetic', expect: 'correct' },
    ]

    await expect(preflightGoldenCases(cases, await temporaryPhotoDirectory())).rejects.toThrow(
      /missing-one\.jpg[\s\S]*missing-two\.jpg[\s\S]*npm run gen-synthetic -w server/,
    )
  })

  it('loads all ten committed FERMAT fixtures before a paid run', async () => {
    const manifest = GoldenManifestSchema.parse(
      JSON.parse(await readFile(path.join(GOLDEN_DIR, 'manifest.json'), 'utf8')),
    )
    const cases = selectCases(manifest.cases, 'fermat')

    const fixtures = await preflightGoldenCases(cases, GOLDEN_PHOTO_DIR)

    expect(fixtures).toHaveLength(10)
    expect(fixtures.map((fixture) => fixture.goldenCase.file)).toEqual(cases.map((c) => c.file))
    expect(fixtures.every((fixture) => fixture.base64.length > 0)).toBe(true)
  })
})
