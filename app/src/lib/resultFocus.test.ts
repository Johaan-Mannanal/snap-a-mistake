import { describe, expect, it } from 'vitest'
import type { Step } from '@snap/shared'
import { focusedStepIndexes } from './resultFocus'

function step(index: number, verdict: Step['verdict'] = 'ok'): Step {
  return {
    index,
    verdict,
    latex: `x_${index}`,
    plain: `x ${index}`,
    yBandTopPct: index * 10,
    yBandBottomPct: index * 10 + 5,
  }
}

describe('focusedStepIndexes', () => {
  it('keeps the first diagnosed step and its immediate following step', () => {
    expect(focusedStepIndexes([step(0, 'wrong'), step(1, 'downstream'), step(2, 'downstream')], 0)).toEqual([0, 1])
  })

  it('keeps the indexed neighbor on each side of a middle diagnosis', () => {
    expect(focusedStepIndexes([step(0), step(2, 'wrong'), step(5, 'downstream'), step(9, 'downstream')], 2)).toEqual([0, 2, 5])
  })

  it('does not invent a downstream step after the final diagnosis', () => {
    expect(focusedStepIndexes([step(1), step(4), step(7, 'wrong')], 7)).toEqual([4, 7])
  })

  it('keeps all correct work visible', () => {
    expect(focusedStepIndexes([step(0), step(3), step(8)], null)).toEqual([0, 3, 8])
  })

  it('focuses a suspect diagnosis without treating it as correct work', () => {
    expect(focusedStepIndexes([step(0), step(4, 'suspect'), step(9, 'downstream')], 4)).toEqual([0, 4, 9])
  })

  it('returns only the available indexed neighbors when there is no downstream work', () => {
    expect(focusedStepIndexes([step(3), step(11, 'wrong')], 11)).toEqual([3, 11])
  })
})
