import { describe, expect, it } from 'vitest'
import { createCorrectionBusyState } from './correctionBusy'

describe('correction busy ownership', () => {
  it('clears a cancelled current operation so controls can retry', () => {
    const busy = createCorrectionBusyState()
    busy.begin(1)
    expect(busy.busy).toBe(true)
    expect(busy.finish(1)).toBe(true)
    expect(busy.busy).toBe(false)
    busy.begin(2)
    expect(busy.busy).toBe(true)
  })

  it('does not let an old completion clear a newer operation', () => {
    const busy = createCorrectionBusyState()
    busy.begin(1)
    busy.begin(2)
    expect(busy.finish(1)).toBe(false)
    expect(busy.busy).toBe(true)
    expect(busy.finish(2)).toBe(true)
    expect(busy.busy).toBe(false)
  })
})
