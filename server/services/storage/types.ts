// Provider-agnostic storage contract. The generation flow (BL-024) depends on
// this interface only, so the Supabase implementation can be swapped for S3
// later without touching business logic (PRD §15.1 portability note).

export interface StorageObjectRef {
  userId: string
  // Nullable: ad-hoc generations may not belong to a saved project yet.
  projectId?: string | null
  generationId: string
  // File extension without the leading dot, e.g. "png".
  ext: string
}

export interface StorageUploadInput {
  path: string
  // A Node Buffer is a Uint8Array, so callers can pass either.
  data: Uint8Array
  contentType: string
  // Overwrite an existing object at the same path. Defaults to false.
  upsert?: boolean
}

export interface StorageUploadResult {
  bucket: string
  path: string
  size: number
}

export interface StorageAdapter {
  readonly bucket: string
  // Centralized object-path generation (PRD object-path convention).
  buildObjectPath: (ref: StorageObjectRef) => string
  upload: (input: StorageUploadInput) => Promise<StorageUploadResult>
  // Short-lived signed URL for private asset delivery.
  createSignedUrl: (path: string, expiresInSeconds?: number) => Promise<string>
}
