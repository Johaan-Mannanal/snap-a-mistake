import { describe, expect, it } from 'vitest'
import { classifyAppButtonPress } from './appButtonPress'

describe('AppButton press classification', () => {
  it('routes a focused Android markerless click through non-pointer activation', () => {
    expect(classifyAppButtonPress('android', {}, true)).toBe('non-pointer')
  })

  it('keeps an unfocused Android markerless click on the guarded pointer path', () => {
    expect(classifyAppButtonPress('android', {}, false)).toBe('pointer')
  })

  it('keeps a physical responder event on the guarded pointer path even while focused', () => {
    expect(classifyAppButtonPress('android', {
      changedTouches: [{ identifier: 1 }],
      touches: [],
    }, true)).toBe('pointer')
  })

  it('recognizes a web detail-zero activation as non-pointer input', () => {
    expect(classifyAppButtonPress('web', { detail: 0 }, false)).toBe('non-pointer')
  })
})
