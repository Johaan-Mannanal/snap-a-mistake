import { describe, expect, it } from 'vitest'
import { expandStepIndex, initialExpandedStepIndexes, selectStepIndex, toggleExpandedStepIndexes } from './resultInteraction'

describe('result timeline interaction state', () => {
  it('initially expands only the diagnosed sparse index', () => {
    expect([...initialExpandedStepIndexes(14)]).toEqual([14])
    expect([...initialExpandedStepIndexes(null)]).toEqual([])
  })

  it('toggles each sparse step without changing the selected step', () => {
    const selected = selectStepIndex(null, 14)
    const expanded = toggleExpandedStepIndexes(new Set<number>([14]), 38)
    expect(selected).toBe(14)
    expect([...expanded]).toEqual([14, 38])
    expect([...toggleExpandedStepIndexes(expanded, 38)]).toEqual([14])
  })

  it('selects a photo step and expands it without collapsing other open steps', () => {
    expect(selectStepIndex(3, 11)).toBe(11)
    expect([...expandStepIndex(new Set<number>([3, 8]), 11)]).toEqual([3, 8, 11])
  })
})
