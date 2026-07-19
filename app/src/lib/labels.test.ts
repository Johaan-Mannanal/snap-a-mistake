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
})
