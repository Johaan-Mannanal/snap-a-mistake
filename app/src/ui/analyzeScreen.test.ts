import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const analyzeScreen = readFileSync(resolve(__dirname, '../../app/analyze.tsx'), 'utf8')
const unfinishedLessonAction = new RegExp(['video', 'lesson'].join('\\s+'), 'i')
const parkedFeatureMessage = new RegExp(['coming', 'soon'].join('\\s+'), 'i')

describe('analysis result screen', () => {
  it('does not offer the unfinished lesson action', () => {
    expect(analyzeScreen).not.toMatch(unfinishedLessonAction)
    expect(analyzeScreen).not.toMatch(parkedFeatureMessage)
  })
})
