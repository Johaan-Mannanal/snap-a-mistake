import { beforeEach, describe, expect, it } from 'vitest'
import type { AnalyzeResponse } from '@snap/shared'
import { PersistedSessionSchema } from './scanTypes'
import type { ScanRepository } from './scanRepository'
import {
  acknowledgePrivacyDisclosure,
  getSession,
  hydrateSession,
  isPrivacyDisclosureAcknowledged,
  persistAnalysis,
  resetSession,
  setPendingPhoto,
  setReviewedPhoto,
  startFollowUp,
} from './session'

const withFollowUp: AnalyzeResponse = {
  kind: 'analysis', steps: [], errorStepIndex: 1, misconceptionTag: 'sign-error',
  explanation: 'x', followUp: { problem: 'p', concept: 'c', hint: 'h' }, verifierAgreed: true,
}

class MemorySessionRepository {
  state: unknown = null
  states = new Map<string, unknown>()
  deleted: string[] = []
  failDelete = false

  async getState<T>(key: string, schema: { safeParse(value: unknown): { success: boolean; data?: T } }): Promise<T | null> {
    const value = key === 'active-session' ? this.state : (this.states.get(key) ?? null)
    const parsed = schema.safeParse(value)
    return parsed.success ? parsed.data! : null
  }

  async setState(key: string, value: unknown): Promise<void> {
    if (key === 'active-session') this.state = value
    else this.states.set(key, value)
  }

  async deleteState(key: string): Promise<void> {
    if (this.failDelete) throw new Error('local storage unavailable')
    this.deleted.push(key)
    if (key === 'active-session') this.state = null
    else this.states.delete(key)
  }
}

beforeEach(async () => {
  await resetSession()
})

describe('session', () => {
  it('resetSession clears everything', async () => {
    await resetSession()
    expect(getSession()).toMatchObject({
      routeIntent: 'capture', pendingScanId: null, photoUri: null, origin: null,
      analysis: null, followUp: null, parentScanId: null, isRetry: false,
    })
  })

  it('persists a pending review photo before it becomes a durable scan', async () => {
    const repository = new MemorySessionRepository()
    await hydrateSession(repository as unknown as ScanRepository)

    await setPendingPhoto({ uri: 'file:///cache/camera.jpg', origin: 'camera' })

    expect(repository.state).toEqual({
      routeIntent: 'review', pendingScanId: null, photoUri: 'file:///cache/camera.jpg', origin: 'camera',
      analysis: null, followUp: null, parentScanId: null,
    })
    expect(getSession()).toMatchObject({ routeIntent: 'review', photoUri: 'file:///cache/camera.jpg', origin: 'camera' })
  })

  it('persists the first-use privacy acknowledgement separately from the active review', async () => {
    const repository = new MemorySessionRepository()
    await hydrateSession(repository as unknown as ScanRepository)

    await acknowledgePrivacyDisclosure()
    await setPendingPhoto({ uri: 'file:///cache/camera.jpg', origin: 'camera' })

    expect(isPrivacyDisclosureAcknowledged()).toBe(true)
    expect(repository.states.get('privacy-disclosure-v1')).toEqual({ acknowledged: true })
    expect(repository.state).toEqual({
      routeIntent: 'review', pendingScanId: null, photoUri: 'file:///cache/camera.jpg', origin: 'camera',
      analysis: null, followUp: null, parentScanId: null,
    })
  })

  it('persists a reviewed scan for analysis and a completed result without retaining a stale follow-up', async () => {
    const repository = new MemorySessionRepository()
    repository.state = {
      routeIntent: 'result', pendingScanId: 'old-scan', photoUri: 'file:///documents/scans/old-scan.jpg', origin: 'library',
      analysis: withFollowUp, followUp: withFollowUp.followUp, parentScanId: null,
    }
    await hydrateSession(repository as unknown as ScanRepository)
    await setReviewedPhoto({ scanId: 'scan-1', uri: 'file:///documents/scans/scan-1.jpg', origin: 'library', parentScanId: null })

    const noFollowUp: AnalyzeResponse = {
      kind: 'analysis', steps: [], errorStepIndex: null, misconceptionTag: null,
      explanation: null, followUp: null, verifierAgreed: true,
    }
    await persistAnalysis('scan-1', noFollowUp, 42)

    expect(repository.state).toEqual({
      routeIntent: 'result', pendingScanId: 'scan-1', photoUri: 'file:///documents/scans/scan-1.jpg', origin: 'library',
      analysis: noFollowUp, followUp: null, parentScanId: null,
    })
    expect(getSession()).toMatchObject({ routeIntent: 'result', pendingScanId: 'scan-1', followUp: null })
  })

  it('persists a follow-up independently of the prior result', async () => {
    const repository = new MemorySessionRepository()
    await hydrateSession(repository as unknown as ScanRepository)

    await startFollowUp('scan-1', withFollowUp.followUp!)

    expect(repository.state).toEqual({
      routeIntent: 'follow-up', pendingScanId: null, photoUri: null, origin: null,
      analysis: null, followUp: withFollowUp.followUp, parentScanId: 'scan-1',
    })
    expect(getSession()).toMatchObject({ routeIntent: 'follow-up', parentScanId: 'scan-1', followUp: withFollowUp.followUp })
  })

  it('keeps the parent link when a follow-up moves from camera capture into review', async () => {
    const repository = new MemorySessionRepository()
    await hydrateSession(repository as unknown as ScanRepository)
    await startFollowUp('scan-1', withFollowUp.followUp!)

    await setPendingPhoto({ uri: 'file:///cache/follow-up.jpg', origin: 'camera' })

    expect(repository.state).toEqual({
      routeIntent: 'review', pendingScanId: null, photoUri: 'file:///cache/follow-up.jpg', origin: 'camera',
      analysis: null, followUp: null, parentScanId: 'scan-1',
    })
    expect(getSession()).toMatchObject({ routeIntent: 'review', parentScanId: 'scan-1', isRetry: true })
  })

  it('discards invalid persisted state and falls back to capture', async () => {
    const repository = new MemorySessionRepository()
    repository.state = { routeIntent: 'review', photoUri: null, origin: 'camera' }

    await hydrateSession(repository as unknown as ScanRepository)

    expect(getSession()).toMatchObject({ routeIntent: 'capture', photoUri: null })
    expect(repository.deleted).toContain('active-session')
  })

  it('discards a stale persisted follow-up that contradicts a result without one', async () => {
    const repository = new MemorySessionRepository()
    repository.state = {
      routeIntent: 'result', pendingScanId: 'scan-1', photoUri: 'file:///documents/scans/scan-1.jpg', origin: 'camera',
      analysis: { kind: 'analysis', steps: [], errorStepIndex: null, misconceptionTag: null, explanation: null, followUp: null, verifierAgreed: true },
      followUp: withFollowUp.followUp, parentScanId: null,
    }

    await hydrateSession(repository as unknown as ScanRepository)

    expect(getSession()).toMatchObject({ routeIntent: 'capture', photoUri: null, followUp: null })
    expect(repository.deleted).toContain('active-session')
  })

  it('keeps the active reviewed photo available when durable session reset fails', async () => {
    const repository = new MemorySessionRepository()
    await hydrateSession(repository as unknown as ScanRepository)
    await setPendingPhoto({ uri: 'file:///cache/camera.jpg', origin: 'camera' })
    repository.failDelete = true

    try {
      await expect(resetSession()).rejects.toThrow('local storage unavailable')

      expect(getSession()).toMatchObject({ routeIntent: 'review', photoUri: 'file:///cache/camera.jpg', origin: 'camera' })
    } finally {
      repository.failDelete = false
      await resetSession()
    }
  })

  it('restores a terminated analysis as an interrupted review that retains the reviewed photo', async () => {
    const repository = new MemorySessionRepository()
    repository.state = PersistedSessionSchema.parse({
      routeIntent: 'analyze', pendingScanId: 'scan-1', photoUri: 'file:///documents/scans/scan-1.jpg', origin: 'camera',
      analysis: null, followUp: null, parentScanId: null,
    })

    await hydrateSession(repository as unknown as ScanRepository)

    expect(getSession()).toMatchObject({
      routeIntent: 'review', pendingScanId: 'scan-1', photoUri: 'file:///documents/scans/scan-1.jpg', isInterrupted: true,
    })
    expect(repository.state).toMatchObject({ routeIntent: 'review', pendingScanId: 'scan-1' })
  })
})
