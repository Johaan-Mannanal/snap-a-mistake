import { describe, expect, it } from 'vitest'
import type { HistoryRecord } from './history'
import { summarize } from './trends'

const now = new Date('2026-07-18T12:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()
const rec = (tag: HistoryRecord['tag'], n: number, correct = false): HistoryRecord =>
  ({ tag, correct, createdAt: daysAgo(n) })

describe('summarize', () => {
  it('counts mistakes per tag within the last 7 days', () => {
    const out = summarize([rec('sign-error', 1), rec('sign-error', 3), rec('chain-rule-missed', 2)], now)
    expect(out.find((t) => t.tag === 'sign-error')?.thisWeek).toBe(2)
    expect(out.find((t) => t.tag === 'chain-rule-missed')?.thisWeek).toBe(1)
  })
  it('ignores correct records and null tags', () => {
    const out = summarize([rec('sign-error', 1, true), rec(null, 1)], now)
    expect(out).toEqual([])
  })
  it('marks fewer when this week improved on last week', () => {
    const out = summarize([rec('sign-error', 10), rec('sign-error', 9), rec('sign-error', 2)], now)
    expect(out[0]).toMatchObject({ tag: 'sign-error', thisWeek: 1, trend: 'fewer' })
  })
  it('marks more when this week got worse, and sorts by thisWeek desc', () => {
    const out = summarize(
      [rec('sign-error', 1), rec('sign-error', 2), rec('algebraic-slip', 3)],
      now,
    )
    expect(out[0]).toMatchObject({ tag: 'sign-error', thisWeek: 2, trend: 'more' })
    expect(out[1]).toMatchObject({ tag: 'algebraic-slip', thisWeek: 1 })
  })
  it('drops records older than 14 days from trend math', () => {
    const out = summarize([rec('sign-error', 20), rec('sign-error', 1)], now)
    expect(out[0]).toMatchObject({ thisWeek: 1, trend: 'more' })
  })
})
