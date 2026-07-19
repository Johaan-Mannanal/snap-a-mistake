import type { MisconceptionTag } from '@snap/shared'
import type { HistoryRecord } from './history'

export type TagSummary = { tag: MisconceptionTag; thisWeek: number; trend: 'more' | 'fewer' | 'same' }

const WEEK = 7 * 86_400_000

export function summarize(records: HistoryRecord[], now: Date): TagSummary[] {
  const thisWeek = new Map<MisconceptionTag, number>()
  const lastWeek = new Map<MisconceptionTag, number>()
  for (const r of records) {
    if (r.correct || r.tag === null) continue
    const age = now.getTime() - new Date(r.createdAt).getTime()
    if (age < 0 || age >= 2 * WEEK) continue
    const bucket = age < WEEK ? thisWeek : lastWeek
    bucket.set(r.tag, (bucket.get(r.tag) ?? 0) + 1)
  }
  const tags = new Set<MisconceptionTag>([...thisWeek.keys(), ...lastWeek.keys()])
  return [...tags]
    .map((tag) => {
      const cur = thisWeek.get(tag) ?? 0
      const prev = lastWeek.get(tag) ?? 0
      return { tag, thisWeek: cur, trend: cur > prev ? 'more' : cur < prev ? 'fewer' : 'same' } as TagSummary
    })
    .sort((a, b) => b.thisWeek - a.thisWeek || a.tag.localeCompare(b.tag))
}
