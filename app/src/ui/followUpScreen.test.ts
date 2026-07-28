import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(__dirname, '../../app/followup.tsx'), 'utf8')

describe('follow-up screen handoff', () => {
  it('waits for navigation interactions and requires a fresh check-work press', () => {
    expect(source).toContain('InteractionManager.runAfterInteractions')
    expect(source).toContain('routeGate.current.beginPress()')
    expect(source).toContain('routeGate.current.consumePress()')
    expect(source).not.toContain('ROUTE_ACTIVATION_DELAY_MS')
  })
})
