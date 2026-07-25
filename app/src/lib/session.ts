import type { AnalyzeResponse, FollowUp } from '@snap/shared'

export type Session = {
  photoUri: string | null
  analysis: AnalyzeResponse | null
  followUp: FollowUp | null
  isRetry: boolean
}

let session: Session = { photoUri: null, analysis: null, followUp: null, isRetry: false }

export function getSession(): Session {
  return session
}
export function setPhoto(uri: string): void {
  session = { ...session, photoUri: uri, analysis: null, isRetry: false }
}
export function setAnalysis(a: AnalyzeResponse): void {
  const followUp = a.kind === 'analysis' && a.followUp ? a.followUp : session.followUp
  session = { ...session, analysis: a, followUp }
}
export function startFollowUp(): void {
  session = { ...session, isRetry: true, photoUri: null, analysis: null }
}
export function resetSession(): void {
  session = { photoUri: null, analysis: null, followUp: null, isRetry: false }
}
