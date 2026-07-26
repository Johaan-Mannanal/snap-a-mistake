import { describe, expect, it, vi } from 'vitest'

async function loadFeedback() {
  return import('./feedback')
}

describe('feedback', () => {
  it('provides injectable capture, completion, and announcement feedback', async () => {
    const feedback = await loadFeedback()

    expect(feedback).not.toBeNull()
    if (feedback === null) return

    const lightImpact = vi.fn().mockResolvedValue(undefined)
    const success = vi.fn().mockResolvedValue(undefined)
    const port = { lightImpact, success, isFeedbackEnabled: () => true }

    await feedback.captureFeedback(port)
    await feedback.analysisCompleteFeedback(port)

    expect(lightImpact).toHaveBeenCalledTimes(1)
    expect(success).toHaveBeenCalledTimes(1)
    expect(typeof feedback.announce).toBe('function')
  })

  it('suppresses haptics when feedback is disabled', async () => {
    const feedback = await loadFeedback()

    expect(feedback).not.toBeNull()
    if (feedback === null) return

    const lightImpact = vi.fn().mockResolvedValue(undefined)
    const success = vi.fn().mockResolvedValue(undefined)
    const port = { lightImpact, success, isFeedbackEnabled: () => false }

    await feedback.captureFeedback(port)
    await feedback.analysisCompleteFeedback(port)

    expect(lightImpact).not.toHaveBeenCalled()
    expect(success).not.toHaveBeenCalled()
  })

  it('contains haptic failures so workflow feedback never rejects', async () => {
    const feedback = await loadFeedback()

    expect(feedback).not.toBeNull()
    if (feedback === null) return

    const port = {
      lightImpact: vi.fn().mockRejectedValue(new Error('unavailable')),
      success: vi.fn().mockRejectedValue(new Error('unavailable')),
      isFeedbackEnabled: () => true,
    }

    await expect(feedback.captureFeedback(port)).resolves.toBeUndefined()
    await expect(feedback.analysisCompleteFeedback(port)).resolves.toBeUndefined()
  })

  it('announces each wait threshold once and uses the 60-second boundary after a delayed update', async () => {
    const feedback = await loadFeedback()
    const announce = vi.fn()
    const progress = feedback.createProgressAnnouncementGate()

    expect(progress.announceForElapsed(19, announce)).toBe(false)
    expect(progress.announceForElapsed(20, announce)).toBe(true)
    expect(progress.announceForElapsed(20, announce)).toBe(false)
    expect(progress.announceForElapsed(60, announce)).toBe(true)
    expect(progress.announceForElapsed(61, announce)).toBe(false)
    expect(announce).toHaveBeenCalledTimes(2)

    const delayedProgress = feedback.createProgressAnnouncementGate()
    expect(delayedProgress.announceForElapsed(61, announce)).toBe(true)
    expect(announce).toHaveBeenLastCalledWith('Still working. You can cancel and return to your review.')

    const nextAnalysisRun = feedback.createProgressAnnouncementGate()
    expect(nextAnalysisRun.announceForElapsed(20, announce)).toBe(true)
  })

  it('confirms every distinct durable terminal result once, including classified results', async () => {
    const feedback = await loadFeedback()
    const success = vi.fn().mockResolvedValue(undefined)
    const gate = feedback.createFeedbackEventGate()
    const port = { lightImpact: vi.fn().mockResolvedValue(undefined), success, isFeedbackEnabled: () => true }

    // Save failures never enter this durable handoff gate.
    expect(success).not.toHaveBeenCalled()
    await gate.completeOnce('analysis-revision', port)
    await gate.completeOnce('not-math-revision', port)
    await gate.completeOnce('unreadable-revision', port)
    await gate.completeOnce('analysis-revision', port)

    expect(success).toHaveBeenCalledTimes(3)
  })

  it('announces and confirms each durable correction revision once', async () => {
    const feedback = await loadFeedback()
    const announce = vi.fn()
    const success = vi.fn().mockResolvedValue(undefined)
    const gate = feedback.createFeedbackEventGate()
    const port = { lightImpact: vi.fn().mockResolvedValue(undefined), success, isFeedbackEnabled: () => true }

    expect(gate.announceOnce('correction:revision-1', 'Correction completed.', announce)).toBe(true)
    await gate.completeOnce('correction:revision-1', port)
    expect(gate.announceOnce('correction:revision-1', 'Correction completed.', announce)).toBe(false)
    await gate.completeOnce('correction:revision-1', port)
    expect(gate.announceOnce('correction:revision-2', 'Correction completed.', announce)).toBe(true)
    await gate.completeOnce('correction:revision-2', port)

    expect(announce).toHaveBeenCalledTimes(2)
    expect(success).toHaveBeenCalledTimes(2)
  })
})
