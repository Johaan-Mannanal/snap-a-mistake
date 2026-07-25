import { describe, expect, it } from 'vitest'
import { bootstrapLocalStorage } from './startup'

describe('bootstrapLocalStorage', () => {
  it('returns a recoverable error state when local migration fails', async () => {
    await expect(bootstrapLocalStorage(async () => { throw new Error('database locked') }))
      .resolves.toEqual({ kind: 'error' })
  })

  it('reports ready only after local migration completes', async () => {
    await expect(bootstrapLocalStorage(async () => {})).resolves.toEqual({ kind: 'ready' })
  })
})
