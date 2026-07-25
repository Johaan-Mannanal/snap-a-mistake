export type LocalStorageBootstrapState = { kind: 'ready' } | { kind: 'error' }

export async function bootstrapLocalStorage(
  initialize: () => Promise<void>,
): Promise<LocalStorageBootstrapState> {
  try {
    await initialize()
    return { kind: 'ready' }
  } catch {
    return { kind: 'error' }
  }
}
