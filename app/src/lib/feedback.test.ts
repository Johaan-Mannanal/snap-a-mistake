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
})
