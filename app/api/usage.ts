export interface UsageActionSummary {
  action: 'expand' | 'generate'
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

export async function fetchUsageSummary(): Promise<UsageSummary> {
  const { summary } = await $fetch<{ summary: UsageSummary }>('/api/usage/summary')
  return summary
}
