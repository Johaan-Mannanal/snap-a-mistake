export function createSessionResetTransition(
  reset: () => Promise<void>,
  navigate: () => void,
  isCurrent: () => boolean = () => true,
): () => Promise<void> {
  let inFlight: Promise<void> | null = null

  return () => {
    if (inFlight) return inFlight
    inFlight = reset()
      .then(() => { if (isCurrent()) navigate() })
      .finally(() => { inFlight = null })
    return inFlight
  }
}
