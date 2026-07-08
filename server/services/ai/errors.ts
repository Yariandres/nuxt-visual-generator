// Normalized provider-failure vocabulary shared by every text/image adapter so
// core workflow logic and usage tracking never branch on provider-specific
// error shapes. BL-034 builds retry behavior on top of `retryable`.
export type ProviderErrorCategory =
  | 'timeout'
  | 'rate_limit'
  | 'quota'
  | 'moderation'
  | 'invalid_request'
  | 'authentication'
  | 'transient'
  | 'unknown'

// Categories worth retrying on a safe, idempotent provider call. Kept beside the
// category list so the two stay in sync.
const RETRYABLE: ReadonlySet<ProviderErrorCategory> = new Set([
  'timeout',
  'rate_limit',
  'transient',
])

export interface ProviderErrorOptions {
  provider: string
  category: ProviderErrorCategory
  message: string
  status?: number
  cause?: unknown
}

export class ProviderError extends Error {
  readonly provider: string
  readonly category: ProviderErrorCategory
  readonly retryable: boolean
  readonly status?: number

  constructor(opts: ProviderErrorOptions) {
    super(opts.message, { cause: opts.cause })
    this.name = 'ProviderError'
    this.provider = opts.provider
    this.category = opts.category
    this.status = opts.status
    this.retryable = RETRYABLE.has(opts.category)
  }
}

function categoryForStatus(status: number): ProviderErrorCategory {
  if (status === 408 || status === 504) return 'timeout'
  if (status === 429) return 'rate_limit'
  if (status === 401 || status === 403) return 'authentication'
  if (status === 400 || status === 422) return 'invalid_request'
  if (status >= 500) return 'transient'
  return 'unknown'
}

function isAbortError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const name = (err as { name?: string }).name
  if (name === 'AbortError' || name === 'TimeoutError') return true
  // `$fetch` surfaces its timeout abort wrapped as the FetchError's cause.
  return isAbortError((err as { cause?: unknown }).cause)
}

// Best-effort mapping of an unknown thrown value into a ProviderError. Adapters
// that can detect richer conditions (e.g. a moderation block returned with a
// 200 body) should construct a ProviderError directly instead of relying on
// this fallback.
export function normalizeProviderError(err: unknown, provider: string): ProviderError {
  if (err instanceof ProviderError) return err

  if (isAbortError(err)) {
    return new ProviderError({
      provider,
      category: 'timeout',
      message: `${provider} request timed out.`,
      cause: err,
    })
  }

  const status = extractStatus(err)
  if (status !== undefined) {
    return new ProviderError({
      provider,
      category: categoryForStatus(status),
      message: `${provider} request failed with status ${status}.`,
      status,
      cause: err,
    })
  }

  return new ProviderError({
    provider,
    category: 'unknown',
    message: err instanceof Error ? err.message : `${provider} request failed.`,
    cause: err,
  })
}

function extractStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined
  const e = err as { status?: number, statusCode?: number, response?: { status?: number } }
  return e.status ?? e.statusCode ?? e.response?.status
}
