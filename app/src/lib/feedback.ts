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

export function announce(message: string): void {
  try {
    announcementPort?.announce(message)
  } catch {
    // Announcements are best-effort feedback and must never disrupt the flow.
  }
}
