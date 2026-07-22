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
  { file: 'fermat-img_438_pert_3_1.jpg', sourceId: 'img_438_pert_3.1', expect: 'error', tag: 'notation-error' },
  { file: 'fermat-img_401_pert_3_1.jpg', sourceId: 'img_401_pert_3.1', expect: 'error', tag: 'algebraic-slip' },
  { file: 'fermat-img_414_pert_3_1.jpg', sourceId: 'img_414_pert_3.1', expect: 'error', tag: 'algebraic-slip' },
  { file: 'fermat-img_415_pert_3_1.jpg', sourceId: 'img_415_pert_3.1', expect: 'error', tag: 'integration-by-parts-error' },
  { file: 'fermat-img_559_pert_3_1.jpg', sourceId: 'img_559_pert_3.1', expect: 'error', tag: 'notation-error' },
  { file: 'fermat-img_601_pert_3_1.jpg', sourceId: 'img_601_pert_3.1', expect: 'error', tag: 'sign-error' },
  { file: 'fermat-img_468_pert_3_1.jpg', sourceId: 'img_468_pert_3.1', expect: 'error', tag: 'formula-misapplied' },
  { file: 'fermat-img_584_pert_3_2.jpg', sourceId: 'img_584_pert_3.2', expect: 'error', tag: 'sign-error' },
]

const expectedAnchors = {
  'img_438_pert_3.1': { all: ['x^{-1}'] },
  'img_401_pert_3.1': { all: ['3x+2', '3x^2+4x+5'] },
  'img_414_pert_3.1': { all: ['\\frac{x+3}{x+1}'] },
  'img_415_pert_3.1': { all: ['\\sin x-\\sin x'] },
  'img_559_pert_3.1': { all: ['2x-4xy'], none: ['2x^2-4xy'] },
  'img_601_pert_3.1': { all: ['\\frac{n}{n-1}'] },
  'img_468_pert_3.1': { all: ['-3&4', '2&-1'] },
  'img_584_pert_3.2': { all: ['P(2)=2^2+2\\cdot2'] },
} as const

const expectedProvenanceErrorIndices = {
  'img_438_pert_3.1': 3,
  'img_401_pert_3.1': 4,
  'img_414_pert_3.1': 7,
  'img_415_pert_3.1': 5,
  'img_559_pert_3.1': 3,
  'img_601_pert_3.1': 1,
  'img_468_pert_3.1': 2,
  'img_584_pert_3.2': 2,
} as const

const rejectedSourceIds = [
  'img_423_pert_3.1',
  'img_384_pert_3.1',
  'img_583_pert_3.1',
  'img_479_pert_3.1',
  'img_459_pert_3.1',
]

const rejectedFiles = [
  'fermat-img_423_pert_3_1.jpg',
  'fermat-img_384_pert_3_1.jpg',
  'fermat-img_583_pert_3_1.jpg',
  'fermat-img_479_pert_3_1.jpg',
  'fermat-img_459_pert_3_1.jpg',
]

function rejectedEntries(actual: readonly string[], rejected: readonly string[]) {
  return actual.filter((entry) => rejected.includes(entry))
}

describe('FERMAT curated subset', () => {
  const cases = manifest.cases.filter((c) => c.source === 'fermat')

  it('detects a partially reintroduced rejected record', () => {
    expect(rejectedEntries([rejectedSourceIds[0]!], rejectedSourceIds)).toEqual([rejectedSourceIds[0]!])
  })

  it('contains exactly two correct and eight error cases', () => {
    expect(cases).toHaveLength(10)
    expect(cases.filter((c) => c.expect === 'correct')).toHaveLength(2)
    expect(cases.filter((c) => c.expect === 'error')).toHaveLength(8)
  })

  it('uses the exact audited source records and excludes every rejected record', async () => {
    expect(cases).toEqual(expectedFermatCases.map((c) => ({
      ...c,
      source: 'fermat',
      ...(c.expect === 'error' ? {
        errorStepAnchor: expectedAnchors[c.sourceId as keyof typeof expectedAnchors],
      } : {}),
    })))
    expect(cases.filter((c) => c.expect === 'error').map((c) => ({
      sourceId: c.sourceId,
      errorStepIndex: c.errorStepIndex,
      errorStepAnchor: c.errorStepAnchor,
      tag: c.tag,
    }))).toEqual(Object.entries(expectedAnchors).map(([sourceId, errorStepAnchor]) => ({
      sourceId,
      errorStepIndex: undefined,
      errorStepAnchor,
      tag: expectedFermatCases.find((c) => c.sourceId === sourceId)?.tag,
    })))
    expect(provenance.cases.filter((c) => c.expected.kind === 'error').map((c) => ({
      sourceId: c.sourceId,
      errorStepIndex: c.expected.kind === 'error' ? c.expected.errorStepIndex : undefined,
      tag: c.expected.kind === 'error' ? c.expected.tag : undefined,
    }))).toEqual(Object.entries(expectedProvenanceErrorIndices).map(([sourceId, errorStepIndex]) => ({
      sourceId,
      errorStepIndex,
      tag: expectedFermatCases.find((c) => c.sourceId === sourceId)?.tag,
    })))
    expect(rejectedEntries(cases.map((c) => c.sourceId!), rejectedSourceIds)).toEqual([])
    expect(rejectedEntries(provenance.cases.map((c) => c.sourceId), rejectedSourceIds)).toEqual([])
    const committedPhotos = await readdir(path.join(goldenDir, 'photos'))
    expect(rejectedEntries(committedPhotos, rejectedFiles)).toEqual([])
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
          errorStepIndex: expectedProvenanceErrorIndices[
            manifestCase.sourceId as keyof typeof expectedProvenanceErrorIndices
          ],
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
