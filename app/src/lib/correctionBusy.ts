export type CorrectionBusyState = {
  readonly busy: boolean
  readonly currentToken: number | null
  begin(token: number): void
  finish(token: number): boolean
}

export function createCorrectionBusyState(): CorrectionBusyState {
  let currentToken: number | null = null
  return {
    get busy() { return currentToken !== null },
    get currentToken() { return currentToken },
    begin(token) { currentToken = token },
    finish(token) {
      if (currentToken !== token) return false
      currentToken = null
      return true
    },
  }
}
