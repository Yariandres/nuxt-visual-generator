import { beforeEach, describe, expect, it, vi } from 'vitest'

const { groupBy } = vi.hoisted(() => ({ groupBy: vi.fn() }))
vi.mock('~~/server/utils/prisma', () => ({
  prisma: { usageEvent: { groupBy } },
}))

const { getUsageSummary } = await import('~~/server/services/usage/summary')

beforeEach(() => groupBy.mockReset())

describe('getUsageSummary', () => {
  it('shapes grouped rows into per-action counts and cost totals', async () => {
    groupBy.mockResolvedValue([
      { actionType: 'expand', succeeded: true, _count: { _all: 5 }, _sum: { estimatedCostCents: 0 } },
      { actionType: 'expand', succeeded: false, _count: { _all: 1 }, _sum: { estimatedCostCents: null } },
      { actionType: 'generate', succeeded: true, _count: { _all: 3 }, _sum: { estimatedCostCents: 12 } },
      { actionType: 'generate', succeeded: false, _count: { _all: 2 }, _sum: { estimatedCostCents: null } },
    ])

    const summary = await getUsageSummary('u1')

    const expand = summary.actions.find(a => a.action === 'expand')
    const generate = summary.actions.find(a => a.action === 'generate')
    expect(expand).toEqual({ action: 'expand', total: 6, succeeded: 5, failed: 1, estimatedCostCents: 0 })
    expect(generate).toEqual({ action: 'generate', total: 5, succeeded: 3, failed: 2, estimatedCostCents: 12 })
    expect(summary.totals).toEqual({ total: 11, succeeded: 8, failed: 3, estimatedCostCents: 12 })
  })

  it('scopes the query to the given user', async () => {
    groupBy.mockResolvedValue([])
    await getUsageSummary('user-123')
    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-123' } }))
  })

  it('returns zeroed actions when there is no usage', async () => {
    groupBy.mockResolvedValue([])
    const summary = await getUsageSummary('u1')
    expect(summary.actions).toHaveLength(2)
    expect(summary.totals).toEqual({ total: 0, succeeded: 0, failed: 0, estimatedCostCents: 0 })
  })
})
