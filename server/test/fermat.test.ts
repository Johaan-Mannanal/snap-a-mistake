import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { GoldenManifestSchema } from '../scripts/judge.js'

const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const goldenDir = path.join(serverDir, 'golden')
const manifest = GoldenManifestSchema.parse(
  JSON.parse(await readFile(path.join(goldenDir, 'manifest.json'), 'utf8')),
)
const provenance = JSON.parse(
  await readFile(path.join(goldenDir, 'fermat-provenance.json'), 'utf8'),
) as {
  dataset: string
  revision: string
  license: string
  transformation: string
  cases: Array<{
    file: string
    sourceId: string
    hasError: boolean
    originalQuestion: string
    correctSolution: string
    perturbedSolution: string
    perturbationReasoning: string
    expected: { kind: 'correct' } | { kind: 'error'; errorStepIndex: number; tag: string }
    labelRationale: string
  }>
}

describe('FERMAT curated subset', () => {
  const cases = manifest.cases.filter((c) => c.source === 'fermat')

  it('contains exactly two correct and eight error cases', () => {
    expect(cases).toHaveLength(10)
    expect(cases.filter((c) => c.expect === 'correct')).toHaveLength(2)
    expect(cases.filter((c) => c.expect === 'error')).toHaveLength(8)
  })

  it('pins the licensed upstream revision and aligns provenance one-to-one', () => {
    expect(provenance.dataset).toBe('ai4bharat/FERMAT')
    expect(provenance.revision).toBe('80ff9934c38615bb8d3a33c24252db02e21774f0')
    expect(provenance.license).toBe('CC BY 4.0')
    expect(provenance.cases.map((c) => c.file).sort()).toEqual(cases.map((c) => c.file).sort())
    expect(new Set(provenance.cases.map((c) => c.sourceId)).size).toBe(10)
    for (const record of provenance.cases) {
      expect(record.originalQuestion).not.toBe('')
      expect(record.correctSolution).not.toBe('')
      expect(record.perturbedSolution).not.toBe('')
      expect(record.perturbationReasoning).not.toBe('')
      expect(record.labelRationale).not.toBe('')
    }
  })

  it('stores every selected image as a decodable JPEG', async () => {
    for (const c of cases) {
      expect(c.file).toMatch(/^fermat-.+\.jpg$/)
      const metadata = await sharp(path.join(goldenDir, 'photos', c.file)).metadata()
      expect(metadata.format).toBe('jpeg')
      expect(metadata.width).toBeGreaterThan(500)
      expect(metadata.height).toBeGreaterThan(300)
    }
  })
})
