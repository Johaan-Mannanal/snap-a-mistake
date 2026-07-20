import { describe, expect, it } from 'vitest'
import { MISCONCEPTION_TAGS } from '@snap/shared'
import { tagLabel } from './labels'

describe('tagLabel', () => {
  it('has a human label for every tag in the vocabulary', () => {
    for (const tag of MISCONCEPTION_TAGS) {
      expect(tagLabel(tag)).toBeTruthy()
      expect(tagLabel(tag)).not.toContain('-')
    }
  })

  it('uses student-facing labels for the handwriting additions', () => {
    expect(tagLabel('notation-error')).toBe('Notation error')
    expect(tagLabel('formula-misapplied')).toBe('Formula misapplied')
  })
})
