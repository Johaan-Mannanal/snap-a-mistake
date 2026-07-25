import type { ScanOrigin } from '../lib/scanTypes'

export type ReviewActions = {
  primary: 'Analyze'
  retake: 'Retake' | null
  replace: 'Choose another'
}

export type ReviewPresentation = {
  sourceLabel: string
  privacyCopy: string | null
  actions: ReviewActions
  primaryLabel: 'Analyze' | 'Saving photo…'
  actionsDisabled: boolean
  errorCopy: string | null
}

const FIRST_USE_PRIVACY_COPY = 'When you analyze, your photo is sent to our AI service. Our server does not keep it. Your completed scan and photo stay on this device until you delete them.'
const COPY_FAILURE_COPY = 'We couldn’t save this photo on your device. Try analyzing again or choose another photo.'

export function reviewPresentation(input: {
  origin: ScanOrigin
  disclosureAcknowledged: boolean
  isCopying: boolean
  copyFailed: boolean
}): ReviewPresentation {
  return {
    sourceLabel: input.origin === 'camera' ? 'Captured with camera' : 'Selected from library',
    privacyCopy: input.disclosureAcknowledged ? null : FIRST_USE_PRIVACY_COPY,
    actions: { primary: 'Analyze', retake: input.origin === 'camera' ? 'Retake' : null, replace: 'Choose another' },
    primaryLabel: input.isCopying ? 'Saving photo…' : 'Analyze',
    actionsDisabled: input.isCopying,
    errorCopy: input.copyFailed ? COPY_FAILURE_COPY : null,
  }
}
