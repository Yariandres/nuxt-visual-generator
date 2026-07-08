import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  StorageAdapter,
  StorageUploadInput,
  StorageUploadResult,
} from './types'
import { buildObjectPath } from './path'
import { StorageError } from './errors'

const DEFAULT_BUCKET = 'generated-assets'
const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600

export interface SupabaseStorageAdapterOptions {
  // A service-role client (serverSupabaseServiceRole) so uploads bypass RLS on
  // the private bucket; access control is enforced at the API layer.
  client: SupabaseClient
  bucket?: string
  signedUrlTtlSeconds?: number
}

export function createSupabaseStorageAdapter(
  opts: SupabaseStorageAdapterOptions,
): StorageAdapter {
  const bucket = opts.bucket ?? DEFAULT_BUCKET
  const defaultTtl = opts.signedUrlTtlSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS
  const store = opts.client.storage.from(bucket)

  return {
    bucket,
    buildObjectPath,

    async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
      const { error } = await store.upload(input.path, input.data, {
        contentType: input.contentType,
        upsert: input.upsert ?? false,
      })
      if (error) {
        throw new StorageError({
          category: 'upload_failed',
          message: `Failed to upload "${input.path}" to bucket "${bucket}": ${error.message}`,
          cause: error,
        })
      }
      return { bucket, path: input.path, size: input.data.byteLength }
    },

    async createSignedUrl(path: string, expiresInSeconds = defaultTtl): Promise<string> {
      const { data, error } = await store.createSignedUrl(path, expiresInSeconds)
      if (error || !data?.signedUrl) {
        throw new StorageError({
          category: 'signed_url_failed',
          message: `Failed to sign URL for "${path}" in bucket "${bucket}": ${error?.message ?? 'no URL returned'}`,
          cause: error,
        })
      }
      return data.signedUrl
    },
  }
}
