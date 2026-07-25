import { AnalyzeResponseSchema, type AnalyzeResponse } from '@snap/shared'
import { File } from 'expo-file-system'

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'
export const ANALYSIS_TIMEOUT_MS = 180_000

export type ApiFailure =
  | { kind: 'network' }
  | { kind: 'timeout' }
  | { kind: 'cancelled' }
  | { kind: 'server'; status: number }
  | { kind: 'invalid-response'; status: number }

export class ApiError extends Error {
  constructor(public failure: ApiFailure) {
    super(
      failure.kind === 'server' || failure.kind === 'invalid-response'
        ? `${failure.kind} error ${failure.status}`
        : `${failure.kind} error`,
    )
  }
}

export async function analyzePhoto(
  uri: string,
  options: { signal?: AbortSignal; fetchFn?: typeof fetch } = {},
): Promise<AnalyzeResponse> {
  const form = new FormData()
  form.append('photo', new File(uri), 'photo.jpg')

  const timeoutController = new AbortController()
  const requestController = new AbortController()
  let timedOut = false
  const abortForCallerCancellation = () => requestController.abort()
  const abortForTimeout = () => {
    timedOut = true
    timeoutController.abort()
    requestController.abort()
  }
  options.signal?.addEventListener('abort', abortForCallerCancellation, { once: true })
  if (options.signal?.aborted) abortForCallerCancellation()
  const timer = setTimeout(abortForTimeout, ANALYSIS_TIMEOUT_MS)

  try {
    const fetchFn = options.fetchFn ?? fetch
    let res: Response
    try {
      res = await fetchFn(`${API_URL}/analyze`, { method: 'POST', body: form, signal: requestController.signal })
    } catch {
      if (options.signal?.aborted) throw new ApiError({ kind: 'cancelled' })
      if (timedOut || timeoutController.signal.aborted) throw new ApiError({ kind: 'timeout' })
      throw new ApiError({ kind: 'network' })
    }
    if (options.signal?.aborted) throw new ApiError({ kind: 'cancelled' })
    if (timedOut || timeoutController.signal.aborted) throw new ApiError({ kind: 'timeout' })
    if (!res.ok) throw new ApiError({ kind: 'server', status: res.status })
    const body = await res.json().catch(() => null)
    if (options.signal?.aborted) throw new ApiError({ kind: 'cancelled' })
    if (timedOut || timeoutController.signal.aborted) throw new ApiError({ kind: 'timeout' })
    const parsed = AnalyzeResponseSchema.safeParse(body)
    if (!parsed.success) throw new ApiError({ kind: 'invalid-response', status: res.status })
    return parsed.data
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abortForCallerCancellation)
  }
}
