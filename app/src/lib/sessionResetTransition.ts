export function createSessionResetTransition(
  reset: () => Promise<void>,
  navigate: () => void,
): () => Promise<void> {
  let inFlight: Promise<void> | null = null

  return () => {
    if (inFlight) return inFlight
    inFlight = reset()
      .then(navigate)
      .finally(() => { inFlight = null })
    return inFlight
  }
}
