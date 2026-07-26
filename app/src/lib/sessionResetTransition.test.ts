import { describe, expect, it, vi } from 'vitest'
import { createSessionResetTransition } from './sessionResetTransition'

describe('createSessionResetTransition', () => {
  it('waits for durable session reset before navigating away', async () => {
    let releaseReset: (() => void) | null = null
    const reset = vi.fn(() => new Promise<void>((resolve) => { releaseReset = resolve }))
    const navigate = vi.fn()
    const transition = createSessionResetTransition(reset, navigate)

    const pending = transition()
    expect(navigate).not.toHaveBeenCalled()

    releaseReset!()
    await pending

    expect(reset).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('coalesces repeated taps while reset is in flight', async () => {
    let releaseReset: (() => void) | null = null
    const reset = vi.fn(() => new Promise<void>((resolve) => { releaseReset = resolve }))
    const navigate = vi.fn()
    const transition = createSessionResetTransition(reset, navigate)

    const first = transition()
    const second = transition()
    releaseReset!()
    await Promise.all([first, second])

    expect(reset).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('does not navigate on a durable reset failure and permits a retry', async () => {
    const reset = vi.fn()
      .mockRejectedValueOnce(new Error('local storage unavailable'))
      .mockResolvedValueOnce(undefined)
    const navigate = vi.fn()
    const transition = createSessionResetTransition(reset, navigate)

    await expect(transition()).rejects.toThrow('local storage unavailable')
    expect(navigate).not.toHaveBeenCalled()

    await transition()
    expect(reset).toHaveBeenCalledTimes(2)
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('does not navigate when route ownership expires while reset is pending', async () => {
    let releaseReset: (() => void) | null = null
    let current = true
    const navigate = vi.fn()
    const transition = createSessionResetTransition(
      () => new Promise<void>((resolve) => { releaseReset = resolve }),
      navigate,
      () => current,
    )

    const pending = transition()
    current = false
    releaseReset!()
    await pending

    expect(navigate).not.toHaveBeenCalled()
  })
})
