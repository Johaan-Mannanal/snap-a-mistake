import type { MisconceptionTag } from '@snap/shared'

const LABELS: Record<MisconceptionTag, string> = {
  'sign-error': 'Sign error',
  'dropped-term': 'Dropped term',
  'distribution-error': 'Distribution error',
  'chain-rule-missed': 'Chain rule missed',
  'product-rule-misapplied': 'Product rule misapplied',
  'integration-by-parts-error': 'Integration by parts error',
  // U+2011 non-breaking hyphen (not a plain hyphen) — intentional, keeps "U-substitution" from wrapping mid-word.
  'u-sub-bounds-error': 'U‑substitution bounds error',
  'algebraic-slip': 'Algebraic slip',
  'exponent-rule-error': 'Exponent rule error',
  'equals-abuse': 'Equals sign misuse',
  other: 'Other misconception',
}

export function tagLabel(tag: MisconceptionTag): string {
  return LABELS[tag]
}
