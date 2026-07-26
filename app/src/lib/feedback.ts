export type HapticsPort = {
  lightImpact: () => Promise<void>
  success: () => Promise<void>
  isFeedbackEnabled?: () => boolean | Promise<boolean>
}

export type AnnouncementPort = { announce: (message: string) => void }

let announcementPort: AnnouncementPort | null = null

export function setAnnouncementPort(port: AnnouncementPort | null): void {
  announcementPort = port
}

async function isFeedbackEnabled(port: HapticsPort) {
  try {
    return await port.isFeedbackEnabled?.() !== false
  } catch {
    return false
  }
}

async function perform(port: HapticsPort, effect: (port: HapticsPort) => Promise<void>) {
  if (!await isFeedbackEnabled(port)) return
  try {
    await effect(port)
  } catch {
    // Native haptics are optional feedback; failure must not interrupt the task.
  }
}

export function captureFeedback(port: HapticsPort): Promise<void> {
  return perform(port, (feedback) => feedback.lightImpact())
}

export function analysisCompleteFeedback(port: HapticsPort): Promise<void> {
  return perform(port, (feedback) => feedback.success())
}

export function createFeedbackEventGate() {
  const announced = new Set<string>()
  const completed = new Set<string>()

  return {
    announceOnce(key: string, message: string, announceMessage: (message: string) => void) {
      if (announced.has(key)) return false
      announced.add(key)
      announceMessage(message)
      return true
    },
    async completeOnce(revisionId: string, port: HapticsPort) {
      if (completed.has(revisionId)) return false
      completed.add(revisionId)
      await analysisCompleteFeedback(port)
      return true
    },
  }
}

export function createProgressAnnouncementGate() {
  const announced = new Set<'20' | '60'>()

  return {
    announceForElapsed(elapsedSeconds: number, announceMessage: (message: string) => void) {
      // If the clock skips the first boundary, announce the current, more useful state once.
      const threshold = elapsedSeconds >= 60 ? '60' : elapsedSeconds >= 20 ? '20' : null
      if (threshold === null || announced.has(threshold)) return false
      announced.add(threshold)
      announceMessage(threshold === '60'
        ? 'Still working. You can cancel and return to your review.'
        : 'Still working. This can take a little longer.')
      return true
    },
  }
}

export function announce(message: string): void {
  try {
    announcementPort?.announce(message)
  } catch {
    // Announcements are best-effort feedback and must never disrupt the flow.
  }
}
