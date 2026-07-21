import { describe, expect, it } from 'vitest'
import {
  StepAnchorSchema,
  matchStepAnchor,
  normalizeStepAnchorText,
} from '../scripts/step-anchor.js'

const step = {
  index: 8,
  latex: '\\tan^{-1}y=x^{-1}+C',
  plain: 'Inverse tangent of y equals x to the power negative one plus C.',
  yBandTopPct: 60,
  yBandBottomPct: 70,
}

describe('normalizeStepAnchorText', () => {
  it('normalizes TeX decorations, Unicode minus signs, and multiplication symbols', () => {
    expect(normalizeStepAnchorText(' \\left( X^{−1} \\right) ')).toBe('x^-1')
    expect(normalizeStepAnchorText('2 \\cdot 2')).toBe('2*2')
  })
})

describe('matchStepAnchor', () => {
  it('matches normalized anchor fragments in either transcribed field', () => {
    expect(matchStepAnchor({ all: ['x^{-1}'] }, step)).toMatchObject({ pass: true })
  })

  it('requires every all fragment to be present', () => {
    expect(matchStepAnchor({ all: ['x^{-1}', 'missing'] }, step)).toMatchObject({
      pass: false,
      missing: ['missing'],
    })
  })

  it('rejects forbidden fragments', () => {
    expect(matchStepAnchor({ all: ['x^{-1}'], none: ['tan^{-1}'] }, step)).toMatchObject({
      pass: false,
      forbidden: ['tan^{-1}'],
    })
  })

  it('reports missing fragments when no anchor candidate matches', () => {
    expect(matchStepAnchor({ all: ['2x-4xy'], none: ['2x^2-4xy'] }, step)).toMatchObject({
      pass: false,
      missing: ['2x-4xy'],
    })
  })
})

describe('StepAnchorSchema', () => {
  it('rejects a fragment that normalizes to empty text', () => {
    expect(() => StepAnchorSchema.parse({ all: [' \\left( \\right) '] })).toThrow(
      'anchor fragment must contain mathematical content',
    )
  })
})
