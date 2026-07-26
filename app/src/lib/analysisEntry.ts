import type { AnalyzeResponse } from '@snap/shared'
import type { Session } from './session'

export type InitialAnalysisEntry = {
  result: AnalyzeResponse | null
  shouldRun: boolean
  restoredResult: boolean
}

export function initialAnalysisEntry(session: Session): InitialAnalysisEntry {
  if (session.routeIntent === 'result' && session.analysis !== null)
    return { result: session.analysis, shouldRun: false, restoredResult: true }
  return {
    result: null,
    shouldRun: session.routeIntent === 'analyze',
    restoredResult: false,
  }
}
