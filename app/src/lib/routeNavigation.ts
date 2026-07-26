export type StatefulRouteName = 'review' | 'analyze' | 'followup'

export function statefulRouteScreenOptions(route: string): { gestureEnabled?: false } {
  return route === 'review' || route === 'analyze' || route === 'followup'
    ? { gestureEnabled: false }
    : {}
}

export type SystemBackPort = {
  addEventListener(
    event: 'hardwareBackPress',
    listener: () => boolean,
  ): { remove(): void }
}

export function registerSystemBackTransition(
  port: SystemBackPort,
  transition: () => void,
): { remove(): void } {
  return port.addEventListener('hardwareBackPress', () => {
    transition()
    return true
  })
}

export function analysisSystemBackAction(
  hasResult: boolean,
  actions: { active(): void; result(): void },
): () => void {
  return hasResult ? actions.result : actions.active
}
