import { Prisma, type UsageActionType } from '@prisma/client'
import { prisma } from '~~/server/utils/prisma'

export interface RecordUsageEventInput {
  userId: string
  projectId?: string | null
  generationId?: string | null
  actionType: UsageActionType
  provider: string
  model: string
  succeeded: boolean
  estimatedCostCents?: number | null
  metadata?: Record<string, unknown> | null
}

// Persists a usage event. Throws on failure — callers in expand/generate routes
// should wrap in try/catch and treat usage-write failures as non-fatal so the
// user-facing request still succeeds.
export async function recordUsageEvent(input: RecordUsageEventInput): Promise<void> {
  await prisma.usageEvent.create({
    data: {
      userId: input.userId,
      projectId: input.projectId ?? null,
      generationId: input.generationId ?? null,
      actionType: input.actionType,
      provider: input.provider,
      model: input.model,
      succeeded: input.succeeded,
      estimatedCostCents: input.estimatedCostCents ?? null,
      metadata: input.metadata == null
        ? Prisma.JsonNull
        : (input.metadata as Prisma.InputJsonValue),
    },
  })
}
