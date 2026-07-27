import { describe, expect, it } from 'vitest'
import { createUnreadableDiscardTransition } from './unreadableRecovery'

describe('createUnreadableDiscardTransition', () => {
  it('deletes the scan before clearing memory and navigating', async () => {
    const calls: string[] = []
    const transition = createUnreadableDiscardTransition()

    await transition.discard('scan-1', {
      deleteScan: async () => { calls.push('delete') },
      clearSession: async () => { calls.push('clear') },
      flushOwnedPhotos: async () => { calls.push('flush') },
      navigate: () => { calls.push('navigate') },
    })

    expect(calls).toEqual(['delete', 'clear', 'flush', 'navigate'])
  })

  it('does not clear or navigate when transactional deletion fails', async () => {
    const calls: string[] = []
    const transition = createUnreadableDiscardTransition()

    await expect(transition.discard('scan-1', {
      deleteScan: async () => { throw new Error('database unavailable') },
      clearSession: async () => { calls.push('clear') },
      flushOwnedPhotos: async () => { calls.push('flush') },
      navigate: () => { calls.push('navigate') },
    })).rejects.toThrow('database unavailable')

    expect(calls).toEqual([])
  })

  it('coalesces repeated discards while deletion is in flight', async () => {
    let releaseDeletion: (() => void) | null = null
    const deletion = new Promise<void>((resolve) => { releaseDeletion = resolve })
    const calls: string[] = []
    const transition = createUnreadableDiscardTransition()
    const dependencies = {
      deleteScan: async (scanId: string) => {
        calls.push(`delete:${scanId}`)
        await deletion
      },
      clearSession: async (scanId: string) => { calls.push(`clear:${scanId}`) },
      flushOwnedPhotos: async () => { calls.push('flush') },
      navigate: () => { calls.push('navigate') },
    }

    const first = transition.discard('scan-1', dependencies)
    const second = transition.discard('scan-1', dependencies)
    releaseDeletion!()
    await Promise.all([first, second])

    expect(calls).toEqual(['delete:scan-1', 'clear:scan-1', 'flush', 'navigate'])
  })

  it('navigates when physical cleanup fails after durable deletion', async () => {
    const calls: string[] = []
    const transition = createUnreadableDiscardTransition()

    await expect(transition.discard('scan-1', {
      deleteScan: async () => { calls.push('delete') },
      clearSession: async () => { calls.push('clear') },
      flushOwnedPhotos: async () => {
        calls.push('flush')
        throw new Error('file unavailable')
      },
      navigate: () => { calls.push('navigate') },
    })).resolves.toBeUndefined()

    expect(calls).toEqual(['delete', 'clear', 'flush', 'navigate'])
  })
})
