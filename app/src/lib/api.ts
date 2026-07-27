import {
  AlternateFollowUpContextSchema,
  AnalyzeResponseSchema,
  FollowUpSchema,
  type AlternateFollowUpContext,
  type AnalyzeResponse,
  type CorrectionContext,
  type FollowUp,
} from '@snap/shared'
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

type RequestOptions = { signal?: AbortSignal; fetchFn?: typeof fetch }

export type AnalyzeRequestOptions = RequestOptions & {
  allowUncertainTranscript?: boolean
}

async function requestApi<T>(
  endpoint: string,
  init: Pick<RequestInit, 'body' | 'headers'>,
  parse: (body: unknown) => { success: true; data: T } | { success: false },
  options: RequestOptions,
): Promise<T> {
  const timeoutController = new AbortController()
  const requestController = new AbortController()
  let abortReason: 'timeout' | 'cancelled' | null = null
  const abortRequest = (reason: 'timeout' | 'cancelled') => {
    if (abortReason !== null) return
    abortReason = reason
    requestController.abort()
  }
  const abortForCallerCancellation = () => abortRequest('cancelled')
  const abortForTimeout = () => {
    timeoutController.abort()
    abortRequest('timeout')
  }
  options.signal?.addEventListener('abort', abortForCallerCancellation, { once: true })
  if (options.signal?.aborted) abortForCallerCancellation()
  const timer = setTimeout(abortForTimeout, ANALYSIS_TIMEOUT_MS)

  try {
    const fetchFn = options.fetchFn ?? fetch
    let res: Response
    try {
      res = await fetchFn(`${API_URL}${endpoint}`, { method: 'POST', ...init, signal: requestController.signal })
    } catch {
      if (abortReason === 'cancelled') throw new ApiError({ kind: 'cancelled' })
      if (abortReason === 'timeout') throw new ApiError({ kind: 'timeout' })
      throw new ApiError({ kind: 'network' })
    }
    if (abortReason === 'cancelled') throw new ApiError({ kind: 'cancelled' })
    if (abortReason === 'timeout') throw new ApiError({ kind: 'timeout' })
    if (!res.ok) throw new ApiError({ kind: 'server', status: res.status })
    const body = await res.json().catch(() => null)
    if (abortReason === 'cancelled') throw new ApiError({ kind: 'cancelled' })
    if (abortReason === 'timeout') throw new ApiError({ kind: 'timeout' })
    const parsed = parse(body)
    if (!parsed.success) throw new ApiError({ kind: 'invalid-response', status: res.status })
    return parsed.data
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abortForCallerCancellation)
  }
}

async function requestDiagnosis(
  endpoint: '/analyze' | '/correct-diagnosis',
  uri: string,
  context: CorrectionContext | null,
  options: RequestOptions,
): Promise<AnalyzeResponse> {
  const form = new FormData()
  form.append('photo', new File(uri), 'photo.jpg')
  if (context !== null) form.append('context', JSON.stringify(context))
  return requestApi(endpoint, { body: form }, AnalyzeResponseSchema.safeParse, options)
}

export async function analyzePhoto(uri: string, options: AnalyzeRequestOptions = {}): Promise<AnalyzeResponse> {
  const form = new FormData()
  form.append('photo', new File(uri), 'photo.jpg')
  if (options.allowUncertainTranscript) form.append('allowUncertainTranscript', 'true')
  return requestApi('/analyze', { body: form }, AnalyzeResponseSchema.safeParse, options)
}

export async function correctDiagnosis(
  uri: string,
  context: CorrectionContext,
  options: RequestOptions = {},
): Promise<AnalyzeResponse> {
  return requestDiagnosis('/correct-diagnosis', uri, context, options)
}

export async function requestAlternateFollowUp(
  context: AlternateFollowUpContext,
  options: RequestOptions = {},
): Promise<FollowUp> {
  const validated = AlternateFollowUpContextSchema.parse(context)
  return requestApi('/follow-up', {
    body: JSON.stringify(validated),
    headers: { 'content-type': 'application/json' },
  }, FollowUpSchema.safeParse, options)
}
