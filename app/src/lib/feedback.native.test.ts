import { describe, expect, it, vi } from 'vitest'

vi.mock('react-native', () => ({
  AccessibilityInfo: {
    announceForAccessibility: vi.fn(),
    isReduceMotionEnabled: vi.fn().mockResolvedValue(false),
  },
}))

vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}))

describe('native feedback adapter', () => {
  it('loads its native ports and shared feedback behavior without a module cycle', async () => {
    const feedback = await import('./feedback.native')

    expect(typeof feedback.captureFeedback).toBe('function')
    expect(typeof feedback.analysisCompleteFeedback).toBe('function')
    await expect(feedback.captureFeedback(feedback.systemHaptics)).resolves.toBeUndefined()
  })
})
