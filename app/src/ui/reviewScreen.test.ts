import { describe, expect, it } from 'vitest'
import { reviewPresentation } from './reviewScreen'

describe('review presentation', () => {
  it('labels a camera capture and offers a camera-only retake', () => {
    const presentation = reviewPresentation({
      origin: 'camera', disclosureAcknowledged: true, isCopying: false, copyFailed: false,
    })

    expect(presentation.sourceLabel).toBe('Captured with camera')
    expect(presentation.actions).toEqual({ primary: 'Analyze', retake: 'Retake', replace: 'Choose another' })
  })

  it('labels a library photo without offering retake', () => {
    const presentation = reviewPresentation({
      origin: 'library', disclosureAcknowledged: true, isCopying: false, copyFailed: false,
    })

    expect(presentation.sourceLabel).toBe('Selected from library')
    expect(presentation.actions).toEqual({ primary: 'Analyze', retake: null, replace: 'Choose another' })
  })

  it('shows privacy context before the first analysis only', () => {
    expect(reviewPresentation({
      origin: 'camera', disclosureAcknowledged: false, isCopying: false, copyFailed: false,
    }).privacyCopy).toBe('When you analyze, this photo is sent to the tutor. A copy is saved only on this device so you can revisit it.')

    expect(reviewPresentation({
      origin: 'camera', disclosureAcknowledged: true, isCopying: false, copyFailed: false,
    }).privacyCopy).toBeNull()
  })

  it('keeps the photo recoverable and disables actions while its copy is in progress', () => {
    const presentation = reviewPresentation({
      origin: 'library', disclosureAcknowledged: false, isCopying: true, copyFailed: true,
    })

    expect(presentation.primaryLabel).toBe('Saving photo…')
    expect(presentation.actionsDisabled).toBe(true)
    expect(presentation.errorCopy).toBe('We couldn’t save this photo on your device. Try analyzing again or choose another photo.')
  })
})
