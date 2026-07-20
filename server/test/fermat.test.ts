import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
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
  shards: Array<{ file: string; sha256: string }>
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
    coherenceAudit?: {
      firstErrorBasis: string
      downstreamCoherence: string
    }
    outputSha256: string
  }>
}

const expectedFermatCases = [
  { file: 'fermat-img_486_pert_5_1.jpg', sourceId: 'img_486_pert_5.1', expect: 'correct' },
  { file: 'fermat-img_400_pert_5_1.jpg', sourceId: 'img_400_pert_5.1', expect: 'correct' },
  { file: 'fermat-img_438_pert_3_1.jpg', sourceId: 'img_438_pert_3.1', expect: 'error', errorStepIndex: 3, tag: 'notation-error' },
  { file: 'fermat-img_401_pert_3_1.jpg', sourceId: 'img_401_pert_3.1', expect: 'error', errorStepIndex: 4, tag: 'algebraic-slip' },
  { file: 'fermat-img_414_pert_3_1.jpg', sourceId: 'img_414_pert_3.1', expect: 'error', errorStepIndex: 7, tag: 'algebraic-slip' },
  { file: 'fermat-img_415_pert_3_1.jpg', sourceId: 'img_415_pert_3.1', expect: 'error', errorStepIndex: 5, tag: 'integration-by-parts-error' },
  { file: 'fermat-img_559_pert_3_1.jpg', sourceId: 'img_559_pert_3.1', expect: 'error', errorStepIndex: 3, tag: 'notation-error' },
  { file: 'fermat-img_601_pert_3_1.jpg', sourceId: 'img_601_pert_3.1', expect: 'error', errorStepIndex: 1, tag: 'sign-error' },
  { file: 'fermat-img_459_pert_3_1.jpg', sourceId: 'img_459_pert_3.1', expect: 'error', errorStepIndex: 3, tag: 'notation-error' },
  { file: 'fermat-img_584_pert_3_2.jpg', sourceId: 'img_584_pert_3.2', expect: 'error', errorStepIndex: 2, tag: 'sign-error' },
]

const rejectedSourceIds = [
  'img_423_pert_3.1',
  'img_384_pert_3.1',
  'img_583_pert_3.1',
  'img_479_pert_3.1',
]

const rejectedFiles = [
  'fermat-img_423_pert_3_1.jpg',
  'fermat-img_384_pert_3_1.jpg',
  'fermat-img_583_pert_3_1.jpg',
  'fermat-img_479_pert_3_1.jpg',
]

describe('FERMAT curated subset', () => {
  const cases = manifest.cases.filter((c) => c.source === 'fermat')

  it('contains exactly two correct and eight error cases', () => {
    expect(cases).toHaveLength(10)
    expect(cases.filter((c) => c.expect === 'correct')).toHaveLength(2)
    expect(cases.filter((c) => c.expect === 'error')).toHaveLength(8)
  })

  it('uses the exact audited source records and excludes every rejected record', async () => {
    expect(cases).toEqual(expectedFermatCases.map((c) => ({ ...c, source: 'fermat' })))
    expect(provenance.cases.map(({ file, sourceId, expected }) => ({
      file,
      sourceId,
      expect: expected.kind,
      ...(expected.kind === 'error' ? {
        errorStepIndex: expected.errorStepIndex,
        tag: expected.tag,
      } : {}),
    })))
      .toEqual(expectedFermatCases)
    expect(cases.map((c) => c.sourceId)).not.toEqual(expect.arrayContaining(rejectedSourceIds))
    expect(provenance.cases.map((c) => c.sourceId)).not.toEqual(expect.arrayContaining(rejectedSourceIds))
    const committedPhotos = await readdir(path.join(goldenDir, 'photos'))
    expect(committedPhotos).not.toEqual(expect.arrayContaining(rejectedFiles))
  })

  it('pins the licensed upstream revision and aligns provenance one-to-one', () => {
    expect(provenance.dataset).toBe('ai4bharat/FERMAT')
    expect(provenance.revision).toBe('80ff9934c38615bb8d3a33c24252db02e21774f0')
    expect(provenance.license).toBe('CC BY 4.0')
    expect(provenance.shards).toEqual([
      {
        file: 'train-00000-of-00010.parquet',
        sha256: 'fc144ae82fb8e2704978f2f74b965a7c85e090997b7c49607f282ea48b1d066f',
      },
      {
        file: 'train-00001-of-00010.parquet',
        sha256: 'a8216e3780a99d2652afc8e7566d97190863d35b16699c528fee202344b3ed51',
      },
    ])
    expect(provenance.cases.map((c) => c.file).sort()).toEqual(cases.map((c) => c.file).sort())
    expect(new Set(provenance.cases.map((c) => c.sourceId)).size).toBe(10)
    for (const manifestCase of cases) {
      const record = provenance.cases.find((c) => c.file === manifestCase.file)
      expect(record?.sourceId).toBe(manifestCase.sourceId)
      expect(record?.hasError).toBe(manifestCase.expect === 'error')
      expect(record?.expected.kind).toBe(manifestCase.expect)
      if (manifestCase.expect === 'error') {
        expect(record?.expected).toEqual({
          kind: 'error',
          errorStepIndex: manifestCase.errorStepIndex,
          tag: manifestCase.tag,
        })
      } else {
        expect(record?.expected).toEqual({ kind: 'correct' })
      }
    }
    for (const record of provenance.cases) {
      expect(record.originalQuestion).not.toBe('')
      expect(record.correctSolution).not.toBe('')
      expect(record.perturbedSolution).not.toBe('')
      expect(record.perturbationReasoning).not.toBe('')
      expect(record.labelRationale).not.toBe('')
      expect(record.outputSha256).toMatch(/^[a-f0-9]{64}$/)
      if (record.expected.kind === 'error') {
        expect(record.coherenceAudit?.firstErrorBasis).toEqual(expect.any(String))
        expect(record.coherenceAudit?.firstErrorBasis).not.toBe('')
        expect(record.coherenceAudit?.downstreamCoherence).toEqual(expect.any(String))
        expect(record.coherenceAudit?.downstreamCoherence).not.toBe('')
      }
    }
  })

  it('stores every selected image as a byte-pinned decodable JPEG', async () => {
    for (const c of cases) {
      expect(c.file).toMatch(/^fermat-.+\.jpg$/)
      const imagePath = path.join(goldenDir, 'photos', c.file)
      const bytes = await readFile(imagePath)
      const metadata = await sharp(bytes).metadata()
      const record = provenance.cases.find((candidate) => candidate.file === c.file)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(record?.outputSha256)
      expect(metadata.format).toBe('jpeg')
      expect(metadata.width).toBeGreaterThan(500)
      expect(metadata.height).toBeGreaterThan(300)
    }
  })
})
