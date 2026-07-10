import type { UsageActionType } from '@prisma/client'
import { prisma } from '~~/server/utils/prisma'

export interface UsageActionSummary {
  action: UsageActionType
  total: number
  succeeded: number
  failed: number
  estimatedCostCents: number
}

export interface UsageSummary {
  actions: UsageActionSummary[]
  totals: {
    total: number
    succeeded: number
    failed: number
    estimatedCostCents: number
  }
}

const ACTIONS: readonly UsageActionType[] = ['expand', 'generate']

// Aggregates a single user's usage events into per-action counts and estimated
// cost totals. Scoped by userId so it can never surface another user's data.
export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const groups = await prisma.usageEvent.groupBy({
    by: ['actionType', 'succeeded'],
    where: { userId },
    _count: { _all: true },
    _sum: { estimatedCostCents: true },
  })

  const byAction = new Map<UsageActionType, UsageActionSummary>(
    ACTIONS.map(action => [action, { action, total: 0, succeeded: 0, failed: 0, estimatedCostCents: 0 }]),
  )

  for (const group of groups) {
    const summary = byAction.get(group.actionType)
    if (!summary) continue
    const count = group._count._all
    summary.total += count
    if (group.succeeded) summary.succeeded += count
    else summary.failed += count
    summary.estimatedCostCents += group._sum.estimatedCostCents ?? 0
  }

  const actions = [...byAction.values()]
  const totals = actions.reduce(
    (acc, a) => ({
      total: acc.total + a.total,
      succeeded: acc.succeeded + a.succeeded,
      failed: acc.failed + a.failed,
      estimatedCostCents: acc.estimatedCostCents + a.estimatedCostCents,
    }),
    { total: 0, succeeded: 0, failed: 0, estimatedCostCents: 0 },
  )

  return { actions, totals }
}
