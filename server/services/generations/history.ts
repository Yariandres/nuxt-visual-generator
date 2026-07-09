import { GenerationStatus } from '@prisma/client'
import type { StorageAdapter } from '~~/server/services/storage/types'
import { prisma } from '~~/server/utils/prisma'

// V1 shows the last 10 outputs per project; the max is a hard ceiling so a
// future `?limit=` never over-fetches.
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 10

export interface GenerationHistoryItem {
  id: string
  url: string
  prompt: string
  status: 'succeeded'
  mimeType: string | null
  createdAt: string
  completedAt: string | null
}

export type ListProjectGenerationsResult =
  | { ok: true, generations: GenerationHistoryItem[] }
  | { ok: false, reason: 'not_found' }

export async function listProjectGenerations(
  storage: StorageAdapter,
  userId: string,
  projectId: string,
  limit: number = DEFAULT_LIMIT,
): Promise<ListProjectGenerationsResult> {
  // Ownership: 404 for both missing and not-owned so history never leaks.
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  })
  if (!project || project.userId !== userId) return { ok: false, reason: 'not_found' }

  const take = Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT)
  const rows = await prisma.generation.findMany({
    where: {
      projectId,
      status: GenerationStatus.succeeded,
      objectPath: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      finalPrompt: true,
      objectPath: true,
      mimeType: true,
      createdAt: true,
      completedAt: true,
    },
  })

  const withAsset = rows.filter(
    (r): r is typeof r & { objectPath: string } => r.objectPath !== null,
  )

  // Sign each asset. A single signing failure shouldn't sink the whole list, so
  // failed items are logged and dropped rather than rejecting the request.
  const settled = await Promise.all(
    withAsset.map(async (row): Promise<GenerationHistoryItem | null> => {
      try {
        return {
          id: row.id,
          url: await storage.createSignedUrl(row.objectPath),
          prompt: row.finalPrompt,
          status: 'succeeded',
          mimeType: row.mimeType,
          createdAt: row.createdAt.toISOString(),
          completedAt: row.completedAt?.toISOString() ?? null,
        }
      } catch (err) {
        console.error(`[generations] failed to sign URL for generation ${row.id}:`, err)
        return null
      }
    }),
  )

  return { ok: true, generations: settled.filter((g): g is GenerationHistoryItem => g !== null) }
}
