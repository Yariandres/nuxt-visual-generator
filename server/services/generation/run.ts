import { createHash } from 'node:crypto'
import type { Prisma} from '@prisma/client';
import { GenerationStatus } from '@prisma/client'
import type { Preset } from '#shared/schemas/preset'
import type { ImageGenerationAdapter } from '~~/server/services/ai/types'
import { ProviderError } from '~~/server/services/ai/errors'
import type { StorageAdapter } from '~~/server/services/storage/types'
import { StorageError } from '~~/server/services/storage/errors'
import { extForMimeType } from '~~/server/services/storage/path'
import { assemblePrompt } from '~~/server/services/prompt/assemble'
import { ensurePresetRecord } from '~~/server/services/presets/persist'
import { ensureProfile } from '~~/server/services/profiles/ensure'
import { estimateGeminiImageCostCents } from '~~/server/services/usage/pricing'
import { recordUsageEvent, type RecordUsageEventInput } from '~~/server/services/usage/record'
import { prisma } from '~~/server/utils/prisma'

export type GenerateErrorCode =
  | 'invalid_inputs'
  | 'project_not_found'
  | 'moderation'
  | 'provider_timeout'
  | 'provider_failure'
  | 'storage_failed'
  | 'signed_url_failed'

export interface GenerationView {
  id: string
  status: GenerationStatus
  finalPrompt: string
  provider: string
  model: string
  mimeType: string | null
  createdAt: string
  completedAt: string | null
}

export interface RunGenerationDeps {
  imageAdapter: ImageGenerationAdapter
  storage: StorageAdapter
  provider: string
  // The configured base model, used for the pending record and cost lookup
  // (provider responses may echo a versioned model string that pricing tables
  // do not key on).
  model: string
}

export interface RunGenerationInput {
  userId: string
  projectId?: string | null
  preset: Preset
  inputs: Record<string, string>
}

export interface GenerateError {
  code: GenerateErrorCode
  message: string
  status: number
  details?: unknown
}

export type RunGenerationResult =
  | { ok: true, generation: GenerationView, url: string }
  | { ok: false, error: GenerateError }

const HTTP_FOR_PROVIDER: Record<string, number> = {
  moderation: 422,
  timeout: 504,
  rate_limit: 429,
  authentication: 502,
  invalid_request: 502,
  transient: 502,
  unknown: 502,
}

export async function runGeneration(
  deps: RunGenerationDeps,
  input: RunGenerationInput,
): Promise<RunGenerationResult> {
  const { preset, inputs, userId } = input
  const projectId = input.projectId ?? null

  // 1. Assemble + validate required inputs before touching the DB or provider.
  const assembly = assemblePrompt(preset, inputs)
  if (!assembly.ok) {
    return {
      ok: false,
      error: {
        code: 'invalid_inputs',
        message: 'One or more inputs are invalid.',
        status: 400,
        details: assembly.errors,
      },
    }
  }

  // 2. Ownership check for an optional project (SetNull FK would otherwise let
  // a caller attach a generation to someone else's project).
  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })
    if (!project || project.userId !== userId) {
      return {
        ok: false,
        error: {
          code: 'project_not_found',
          message: 'Project not found.',
          status: 404,
        },
      }
    }
  }

  // 3. Ensure the user's profile + DB preset row exist, then open a pending
  // generation record.
  await ensureProfile(userId)
  const dbPreset = await ensurePresetRecord(preset)
  const generation = await prisma.generation.create({
    data: {
      userId,
      projectId,
      presetId: dbPreset.id,
      presetVersion: preset.version,
      finalPrompt: assembly.prompt,
      provider: deps.provider,
      model: deps.model,
      status: GenerationStatus.pending,
    },
    select: { id: true, createdAt: true },
  })

  // 4. Call the image provider.
  let image
  let latencyMs: number | undefined
  let resolvedModel = deps.model
  try {
    const res = await deps.imageAdapter.generate({
      prompt: assembly.prompt,
      aspectRatio: preset.output.defaultAspectRatio,
    })
    image = res.image
    latencyMs = res.meta.latencyMs
    resolvedModel = res.meta.model
  } catch (err) {
    const category = err instanceof ProviderError ? err.category : 'unknown'
    const message = err instanceof Error ? err.message : 'Image generation failed.'
    await markFailed(generation.id, message, { category })
    await safeRecordUsage({
      userId,
      projectId,
      generationId: generation.id,
      provider: deps.provider,
      model: deps.model,
      succeeded: false,
      metadata: { category },
    })
    return {
      ok: false,
      error: {
        code: category === 'moderation' ? 'moderation' : category === 'timeout' ? 'provider_timeout' : 'provider_failure',
        message,
        status: HTTP_FOR_PROVIDER[category] ?? 502,
      },
    }
  }

  // 5. Persist the asset through the storage adapter.
  let ext: string
  try {
    ext = extForMimeType(image.mimeType)
  } catch {
    const message = `Provider returned an unsupported image type: ${image.mimeType}.`
    await markFailed(generation.id, message, { latencyMs })
    await safeRecordUsage({ userId, projectId, generationId: generation.id, provider: deps.provider, model: deps.model, succeeded: false, metadata: { latencyMs } })
    return { ok: false, error: { code: 'provider_failure', message, status: 502 } }
  }

  const bytes = Buffer.from(image.base64, 'base64')
  const objectPath = deps.storage.buildObjectPath({ userId, projectId, generationId: generation.id, ext })

  try {
    await deps.storage.upload({ path: objectPath, data: bytes, contentType: image.mimeType })
  } catch (err) {
    const message = err instanceof StorageError ? err.message : 'Failed to store generated asset.'
    await markFailed(generation.id, message, { latencyMs })
    await safeRecordUsage({ userId, projectId, generationId: generation.id, provider: deps.provider, model: deps.model, succeeded: false, metadata: { latencyMs } })
    return { ok: false, error: { code: 'storage_failed', message, status: 500 } }
  }

  // 6. Mark the generation succeeded with asset + provider metadata. The asset
  // now exists, so the record is authoritative even if URL signing fails next.
  const completed = await prisma.generation.update({
    where: { id: generation.id },
    data: {
      status: GenerationStatus.succeeded,
      model: resolvedModel,
      bucket: deps.storage.bucket,
      objectPath,
      mimeType: image.mimeType,
      fileSize: bytes.byteLength,
      checksum: createHash('sha256').update(bytes).digest('hex'),
      providerMetadata: { latencyMs } as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
    select: { completedAt: true },
  })

  await safeRecordUsage({
    userId,
    projectId,
    generationId: generation.id,
    provider: deps.provider,
    model: deps.model,
    succeeded: true,
    estimatedCostCents: estimateGeminiImageCostCents(deps.model, 1),
    metadata: { latencyMs },
  })

  // 7. Short-lived signed URL for delivery. A failure here does not roll back
  // the successful generation -- the asset is retrievable later (BL-029).
  let url: string
  try {
    url = await deps.storage.createSignedUrl(objectPath)
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'signed_url_failed',
        message: err instanceof StorageError ? err.message : 'Failed to sign asset URL.',
        status: 500,
      },
    }
  }

  return {
    ok: true,
    url,
    generation: {
      id: generation.id,
      status: GenerationStatus.succeeded,
      finalPrompt: assembly.prompt,
      provider: deps.provider,
      model: resolvedModel,
      mimeType: image.mimeType,
      createdAt: generation.createdAt.toISOString(),
      completedAt: completed.completedAt?.toISOString() ?? null,
    },
  }
}

async function markFailed(
  id: string,
  errorMessage: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.generation.update({
      where: { id },
      data: {
        status: GenerationStatus.failed,
        errorMessage,
        providerMetadata: metadata as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    })
  } catch (err) {
    console.error('[generate] failed to mark generation failed:', err)
  }
}

// Usage-write failures must never mask the primary request outcome (BL-031).
async function safeRecordUsage(input: Omit<RecordUsageEventInput, 'actionType'>): Promise<void> {
  try {
    await recordUsageEvent({ ...input, actionType: 'generate' })
  } catch (err) {
    console.error('[generate] failed to record usage event:', err)
  }
}
