// Normalized storage failure so callers never branch on Supabase-specific error
// shapes, mirroring the AI layer's ProviderError.
export type StorageErrorCategory = 'upload_failed' | 'signed_url_failed'

export interface StorageErrorOptions {
  category: StorageErrorCategory
  message: string
  cause?: unknown
}

export class StorageError extends Error {
  readonly category: StorageErrorCategory

  constructor(opts: StorageErrorOptions) {
    super(opts.message, { cause: opts.cause })
    this.name = 'StorageError'
    this.category = opts.category
  }
}
