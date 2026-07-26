import type { AnalyzeResponse, FollowUp, Step } from '@snap/shared'
import type { ApiFailure } from '../lib/api'
import { tagLabel } from '../lib/labels'
import { colors } from './theme'

const ORDINAL = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'] as const

export function cameraPresentation(isRetry: boolean) {
  return { eyebrow: isRetry ? 'FOLLOW-UP' : 'SNAP', instruction: 'Keep one problem inside the frame' } as const
}

export function currentProblemCardPresentation(followUp: FollowUp, hintVisible: boolean, expanded: boolean) {
  const hint = hintVisible ? followUp.hint : null
  return {
    problem: followUp.problem,
    concept: followUp.concept,
    hint,
    announcement: expanded
      ? `Current problem. ${followUp.problem}${hint === null ? '' : `. Hint: ${hint}`}`
      : null,
    accessibilityHint: expanded
      ? 'Hides the current practice problem.'
      : hintVisible
        ? 'Shows the current practice problem and hint.'
        : 'Shows the current practice problem.',
  }
}

export function cameraPermissionPresentation(permission: { granted: boolean; canAskAgain: boolean } | null) {
  if (!permission) {
    return {
      state: 'loading' as const,
      title: 'Checking camera access',
      detail: 'You can still choose a photo from your library.',
      primaryLabel: null,
    }
  }
  if (permission.canAskAgain) {
    return {
      state: 'requestable' as const,
      title: 'Camera access',
      detail: 'Use the camera to capture one problem at a time.',
      primaryLabel: 'Allow camera' as const,
    }
  }
  return {
    state: 'blocked' as const,
    title: 'Camera access is off',
    detail: 'Turn on Camera access in Settings, or choose a photo from your library.',
    primaryLabel: 'Open Settings' as const,
  }
}

export function trendPresentation(trend: 'fewer' | 'more' | 'same' | 'not-enough-data') {
  if (trend === 'fewer') return { label: 'Improving', color: colors.success, symbol: '↗' } as const
  if (trend === 'more') return { label: 'Needs attention', color: colors.error, symbol: '↘' } as const
  if (trend === 'not-enough-data') return { label: 'Need more evidence', color: colors.muted, symbol: '…' } as const
  return { label: 'Steady', color: colors.muted, symbol: '→' } as const
}

export function analysisPresentation(response: Extract<AnalyzeResponse, { kind: 'analysis' }>) {
  if (response.errorStepIndex === null) {
    return { tone: 'success' as const, eyebrow: 'CHECKED', headline: 'All steps check out', detail: 'Every step follows from the last.' }
  }
  const diagnosedPosition = response.steps.findIndex((step) => step.index === response.errorStepIndex)
  const ordinal = diagnosedPosition + 1
  const step = ORDINAL[diagnosedPosition] ?? String(ordinal)
  if (!response.verifierAgreed) {
    return { tone: 'neutral' as const, eyebrow: 'SECOND LOOK', headline: `Step ${step} needs a second look.`, detail: response.explanation ?? '' }
  }
  return {
    tone: 'error' as const,
    eyebrow: response.misconceptionTag ? tagLabel(response.misconceptionTag).toUpperCase() : 'FIRST BREAK',
    headline: `The first break is in step ${step}.`,
    detail: response.explanation ?? '',
  }
}

const ANALYSIS_DESCRIPTIONS = ['Looking at the photo…', 'Checking the math…', 'Preparing your explanation…'] as const

export function analysisPhotoPresentation() {
  return { resizeMode: 'contain', backgroundColor: '#000000' } as const
}

export function analysisProgressPresentation(elapsedSeconds: number, descriptionIndex: number) {
  const description = ANALYSIS_DESCRIPTIONS[descriptionIndex % ANALYSIS_DESCRIPTIONS.length] ?? ANALYSIS_DESCRIPTIONS[0]
  if (elapsedSeconds >= 60) {
    const elapsedCopy = 'Still working. You can cancel and return to your review.'
    return { description, elapsedCopy, announcement: null }
  }
  if (elapsedSeconds >= 20) {
    const elapsedCopy = 'Still working. This can take a little longer.'
    return { description, elapsedCopy, announcement: null }
  }
  const elapsedCopy = 'Usually takes less than a minute.'
  return {
    description,
    elapsedCopy,
    announcement: null,
  }
}

type RecoveryAction = 'retry' | 'review'
type AnalysisRecovery = ApiFailure | { kind: 'not-math' } | { kind: 'unreadable'; tips: readonly string[] }

export function analysisRecoveryPresentation(recovery: AnalysisRecovery): {
  eyebrow: string
  title: string
  detail: string
  actions: readonly RecoveryAction[]
} {
  switch (recovery.kind) {
    case 'network':
      return { eyebrow: 'CONNECTION', title: 'We couldn’t reach the tutor.', detail: 'Your reviewed photo is still saved. Check your connection and try again.', actions: ['retry', 'review'] }
    case 'timeout':
      return { eyebrow: 'TOOK TOO LONG', title: 'The tutor took too long to respond.', detail: 'Your reviewed photo is still saved. Try again or return to review it.', actions: ['retry', 'review'] }
    case 'server':
      return { eyebrow: 'TUTOR UNAVAILABLE', title: 'The tutor is unavailable right now.', detail: 'Your reviewed photo is still saved. Try again in a moment.', actions: ['retry', 'review'] }
    case 'invalid-response':
      return { eyebrow: 'INCOMPLETE RESPONSE', title: 'We received an incomplete analysis.', detail: 'Your reviewed photo is still saved. Try again to get a complete result.', actions: ['retry', 'review'] }
    case 'not-math':
      return { eyebrow: 'NOT MATH', title: 'This photo doesn’t look like math.', detail: 'Return to review to choose another photo or adjust this one.', actions: ['review'] }
    case 'unreadable':
      return { eyebrow: 'UNREADABLE', title: 'This photo is too hard to read.', detail: 'Return to review to retake it or choose another photo.', actions: ['review'] }
    default:
      throw new Error('unknown analysis recovery')
  }
}

const VERDICT_LABEL: Record<Step['verdict'], string> = {
  ok: 'correct',
  wrong: 'incorrect',
  suspect: 'needs a second look',
  downstream: 'downstream from the first issue',
}

function accessibilitySentence(label: string, value: string) {
  const copy = value.trim()
  return `${label}: ${copy}${/[.!?]$/.test(copy) ? '' : '.'}`
}

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '(': '⁽', ')': '⁾', n: 'ⁿ', x: 'ˣ',
}

function balancedGroup(value: string, openIndex: number) {
  if (value[openIndex] !== '{') return null
  let depth = 0
  for (let index = openIndex; index < value.length; index += 1) {
    if (value[index] === '{') depth += 1
    if (value[index] === '}') depth -= 1
    if (depth === 0) return { content: value.slice(openIndex + 1, index), end: index + 1 }
  }
  return null
}

function replaceFractions(value: string): string | null {
  let result = value
  while (result.includes('\\frac')) {
    const command = result.lastIndexOf('\\frac')
    const numerator = balancedGroup(result, command + 5)
    if (!numerator) return null
    const denominator = balancedGroup(result, numerator.end)
    if (!denominator) return null
    const top = replaceFractions(numerator.content)
    const bottom = replaceFractions(denominator.content)
    if (top === null || bottom === null) return null
    const readableTop = /[+\-]/.test(top.slice(1)) ? `(${top})` : top
    const readableBottom = /[+\-]/.test(bottom.slice(1)) ? `(${bottom})` : bottom
    result = `${result.slice(0, command)}${readableTop}/${readableBottom}${result.slice(denominator.end)}`
  }
  return result
}

function replaceSuperscripts(value: string) {
  return value.replace(/\^(?:\{([^{}]+)\}|([A-Za-z0-9+\-()]))/g, (match, group: string | undefined, single: string | undefined) => {
    const exponent = group ?? single ?? ''
    const converted = [...exponent].map((character) => SUPERSCRIPT[character]).join('')
    return converted.length === exponent.length ? converted : match
  })
}

function comparisonKey(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

export function readableStepMath(latex: string, plain?: string): string | null {
  if (/\\(?:begin|cancel|end|operatorname|overset|underset)\b/.test(latex)) return null

  const withFractions = replaceFractions(latex)
  if (withFractions === null) return null

  const readable = replaceSuperscripts(withFractions)
    .replace(/\\text\{([^{}]*)\}/g, '$1')
    .replace(/\\(?:left|right)/g, '')
    .replace(/\\(?:times|cdot)/g, ' × ')
    .replace(/\\div/g, ' ÷ ')
    .replace(/\\int/g, '∫ ')
    .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
    .replace(/\\(?:,|;|!|quad|qquad| )/g, ' ')
    .replace(/-/g, '−')
    .replace(/\s+/g, ' ')
    .trim()

  if (!readable || /[\\{}^_]/.test(readable)) return null
  if (plain && comparisonKey(readable) === comparisonKey(plain)) return null
  return readable
}

export function stepAccessibilityLabel(
  step: Step,
  ordinal: number,
  misconceptionLabel: string | null,
  explanation: string | null,
  includeSecondary = true,
) {
  const expanded = includeSecondary && (step.verdict === 'wrong' || step.verdict === 'suspect')
  const math = readableStepMath(step.latex, step.plain)
  const sentences = [
    `Step ${ordinal}, ${VERDICT_LABEL[step.verdict]}.`,
    accessibilitySentence('Work', step.plain),
  ]
  if (includeSecondary && math) sentences.push(accessibilitySentence('Math', math))
  if (expanded && misconceptionLabel) sentences.push(accessibilitySentence('Misconception', misconceptionLabel))
  if (expanded && explanation) sentences.push(accessibilitySentence('Explanation', explanation))
  return sentences.join(' ')
}

export function stepCardPresentation(step: Step, input: {
  ordinal: number
  expanded: boolean
  selected: boolean
  misconceptionLabel: string | null
  explanation: string | null
}) {
  const math = readableStepMath(step.latex, step.plain)
  const expandable = math !== null || input.misconceptionLabel !== null || input.explanation !== null
  const expanded = expandable && input.expanded
  const visibleMisconception = expanded ? input.misconceptionLabel : null
  const visibleExplanation = expanded ? input.explanation : null
  const accessibilityAction = !expandable
    ? null
    : expanded
      ? { name: 'collapse' as const, label: 'Collapse step' }
      : { name: 'expand' as const, label: 'Expand step' }
  return {
    math: expanded ? math : null,
    misconceptionLabel: visibleMisconception,
    explanation: visibleExplanation,
    accessibilityLabel: stepAccessibilityLabel(step, input.ordinal, visibleMisconception, visibleExplanation, expanded),
    accessibilityState: expandable ? { expanded, selected: input.selected } : { selected: input.selected },
    accessibilityHint: !expandable ? null : expanded ? 'Double tap to collapse this step.' : 'Double tap to expand this step.',
    accessibilityAction,
  }
}
