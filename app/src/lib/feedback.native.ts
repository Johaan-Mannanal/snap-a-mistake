import { AccessibilityInfo } from 'react-native'
import * as Haptics from 'expo-haptics'
import { setAnnouncementPort, type HapticsPort } from './feedback'

setAnnouncementPort({ announce: (message) => AccessibilityInfo.announceForAccessibility(message) })

export { announce, analysisCompleteFeedback, captureFeedback } from './feedback'

export const systemHaptics: HapticsPort = {
  lightImpact: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  isFeedbackEnabled: async () => !(await AccessibilityInfo.isReduceMotionEnabled()),
}
