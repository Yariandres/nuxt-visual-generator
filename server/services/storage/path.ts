import type { StorageObjectRef } from './types'

// Segment used when a generation has no owning project yet, so the path stays
// well-formed and predictable (PRD path assumes a projectId is present).
const NO_PROJECT_SEGMENT = '_none'

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

// Pure so it is trivially unit-testable (BL-036) and free of any storage SDK.
// Convention: user/{userId}/project/{projectId}/generation/{generationId}.{ext}
export function buildObjectPath(ref: StorageObjectRef): string {
  const project = ref.projectId ?? NO_PROJECT_SEGMENT
  const ext = normalizeExt(ref.ext)
  return `user/${ref.userId}/project/${project}/generation/${ref.generationId}.${ext}`
}

export function normalizeExt(ext: string): string {
  const cleaned = ext.trim().replace(/^\.+/, '').toLowerCase()
  if (cleaned === '') {
    throw new Error('Storage object requires a non-empty file extension.')
  }
  return cleaned
}

export function extForMimeType(mimeType: string): string {
  const ext = MIME_EXTENSIONS[mimeType.toLowerCase()]
  if (!ext) {
    throw new Error(`Unsupported image mime type: "${mimeType}".`)
  }
  return ext
}
