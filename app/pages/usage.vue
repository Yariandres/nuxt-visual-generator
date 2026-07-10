<script setup lang="ts">
import { fetchUsageSummary } from '~/api/usage'

definePageMeta({
  layout: 'default',
})

const { data: summary, status, error, refresh } = await useAsyncData('usage-summary', () =>
  fetchUsageSummary(),
)

const ACTION_LABELS: Record<string, string> = {
  expand: 'Text expansion',
  generate: 'Image generation',
}

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
</script>

<template>
  <div class="min-h-0 flex-1 overflow-y-auto p-6">
    <div class="mx-auto flex max-w-3xl flex-col gap-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-bold text-highlighted">Usage</h1>
          <p class="text-sm text-muted">Your expansion and generation activity. Estimated costs only.</p>
        </div>
        <UButton
          icon="i-lucide-refresh-cw"
          size="xs"
          color="neutral"
          variant="soft"
          :loading="status === 'pending'"
          @click="refresh()"
        >
          Refresh
        </UButton>
      </div>

      <UiErrorState
        v-if="error"
        title="Couldn't load usage"
        :message="error.statusMessage ?? 'Please try again.'"
      />
      <UiLoadingState v-else-if="status === 'pending' && !summary" label="Loading usage…" />

      <template v-else-if="summary">
        <!-- Totals -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="rounded-md border border-default bg-elevated p-3">
            <div class="text-xs text-muted">Total events</div>
            <div class="text-xl font-bold text-highlighted">{{ summary.totals.total }}</div>
          </div>
          <div class="rounded-md border border-default bg-elevated p-3">
            <div class="text-xs text-muted">Succeeded</div>
            <div class="text-xl font-bold text-highlighted">{{ summary.totals.succeeded }}</div>
          </div>
          <div class="rounded-md border border-default bg-elevated p-3">
            <div class="text-xs text-muted">Failed</div>
            <div class="text-xl font-bold text-highlighted">{{ summary.totals.failed }}</div>
          </div>
          <div class="rounded-md border border-default bg-elevated p-3">
            <div class="text-xs text-muted">Est. cost</div>
            <div class="text-xl font-bold text-highlighted">{{ formatCost(summary.totals.estimatedCostCents) }}</div>
          </div>
        </div>

        <!-- Per-action breakdown -->
        <div class="overflow-hidden rounded-md border border-default">
          <table class="w-full text-sm">
            <thead class="bg-muted text-muted">
              <tr>
                <th class="p-3 text-left font-bold">Action</th>
                <th class="p-3 text-right font-bold">Total</th>
                <th class="p-3 text-right font-bold">Succeeded</th>
                <th class="p-3 text-right font-bold">Failed</th>
                <th class="p-3 text-right font-bold">Est. cost</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="action in summary.actions"
                :key="action.action"
                class="border-t border-default"
              >
                <td class="p-3 text-highlighted">{{ ACTION_LABELS[action.action] ?? action.action }}</td>
                <td class="p-3 text-right text-muted">{{ action.total }}</td>
                <td class="p-3 text-right text-muted">{{ action.succeeded }}</td>
                <td class="p-3 text-right text-muted">{{ action.failed }}</td>
                <td class="p-3 text-right text-muted">{{ formatCost(action.estimatedCostCents) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="text-xs text-dimmed">
          Costs are provider estimates for development visibility only — not billing.
        </p>
      </template>
    </div>
  </div>
</template>
