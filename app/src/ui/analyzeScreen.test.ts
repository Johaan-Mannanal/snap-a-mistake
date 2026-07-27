import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const analyzeScreen = readFileSync(resolve(__dirname, '../../app/analyze.tsx'), 'utf8')
const unfinishedLessonAction = new RegExp(['video', 'lesson'].join('\\s+'), 'i')
const parkedFeatureMessage = new RegExp(['coming', 'soon'].join('\\s+'), 'i')

describe('analysis result screen', () => {
  it('discards unreadable scans before offering a new photo', () => {
    expect(analyzeScreen).toContain('createUnreadableDiscardTransition')
    expect(analyzeScreen).toContain('clearSessionForDeletedScan')
    expect(analyzeScreen).toContain('flushCleanupQueue')
    expect(analyzeScreen).toContain('Take a new photo')
  })

  it('offers an explicit lower-confidence retry without returning unreadable scans to review', () => {
    expect(analyzeScreen).toContain('label="Proceed anyway"')
    expect(analyzeScreen).toContain('Results may be less accurate.')
    expect(analyzeScreen).toContain("run({ allowUncertainTranscript: true })")
    expect(analyzeScreen).toContain('Analyzing with lower confidence.')
    const unreadableStart = analyzeScreen.indexOf("if (result.kind === 'unreadable')")
    const unreadableEnd = analyzeScreen.indexOf('const correct =', unreadableStart)
    const unreadableBranch = analyzeScreen.slice(unreadableStart, unreadableEnd)
    expect(unreadableStart).toBeGreaterThan(-1)
    expect(unreadableEnd).toBeGreaterThan(unreadableStart)
    expect(unreadableBranch).not.toContain('Return to review')
  })

  it('starts strictly and preserves the explicit override across transport retries', () => {
    expect(analyzeScreen).toContain('if (initialEntry.shouldRun) run({ allowUncertainTranscript: false })')
    expect(analyzeScreen).toContain('retryRunOptions.current = options')
    expect(analyzeScreen).toContain('allowUncertainTranscript: options.allowUncertainTranscript')
    expect(analyzeScreen).toContain('run(retryRunOptions.current)')
  })

  it('leaves a forced unreadable result recoverable without automatically running again', () => {
    expect(analyzeScreen).toContain('There still wasn’t enough readable math to analyze.')
    const unreadableStart = analyzeScreen.indexOf("if (result.kind === 'unreadable')")
    const unreadableEnd = analyzeScreen.indexOf('const correct =', unreadableStart)
    const unreadableBranch = analyzeScreen.slice(unreadableStart, unreadableEnd)
    expect(unreadableBranch).not.toContain('useEffect')
  })

  it('does not offer the unfinished lesson action', () => {
    expect(analyzeScreen).not.toMatch(unfinishedLessonAction)
    expect(analyzeScreen).not.toMatch(parkedFeatureMessage)
  })

  it('offers a similar problem without promising lower difficulty', () => {
    expect(analyzeScreen).toContain('label="Try a similar problem"')
    expect(analyzeScreen).not.toContain('label="Try a simpler problem"')
  })
})
