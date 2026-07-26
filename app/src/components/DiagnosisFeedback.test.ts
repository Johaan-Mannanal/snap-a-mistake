import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(__dirname, 'DiagnosisFeedback.tsx'), 'utf8')

describe('diagnosis feedback sheet', () => {
  it('keeps all Dynamic Type content reachable in a safe-area bounded scroll sheet', () => {
    expect(source).toContain('<SafeAreaView edges={[\'bottom\']}')
    expect(source).toContain('<ScrollView contentContainerStyle={styles.sheetContent}')
    expect(source).toContain("maxHeight: '92%'")
    expect(source).toContain('minHeight: 52')
  })
})
