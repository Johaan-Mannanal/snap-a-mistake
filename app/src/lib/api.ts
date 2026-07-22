import { AnalyzeResponseSchema, type AnalyzeResponse } from '@snap/shared'
import { File } from 'expo-file-system'

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'
export const ANALYSIS_TIMEOUT_MS = 180_000

export type ApiFailure = { kind: 'network' } | { kind: 'server'; status: number }

export class ApiError extends Error {
  constructor(public failure: ApiFailure) {
    super(failure.kind === 'server' ? `server error ${failure.status}` : 'network error')
  }
}

export async function analyzePhoto(uri: string, fetchFn: typeof fetch = fetch): Promise<AnalyzeResponse> {
  const form = new FormData()
  form.append('photo', new File(uri), 'photo.jpg')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS)
  let body: unknown
  let status: number
  try {
    let res: Response
    try {
      res = await fetchFn(`${API_URL}/analyze`, { method: 'POST', body: form, signal: controller.signal })
    } catch {
      throw new ApiError({ kind: 'network' })
    }
    if (!res.ok) throw new ApiError({ kind: 'server', status: res.status })
    status = res.status
    body = await res.json().catch(() => null)
  } finally {
    clearTimeout(timer)
  }
  const parsed = AnalyzeResponseSchema.safeParse(body)
  if (!parsed.success) throw new ApiError({ kind: 'server', status })
  return parsed.data
}
