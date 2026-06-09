<script setup lang="ts">
import type { PresetSummary } from '#shared/schemas/preset'

defineProps<{ modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [id: string] }>()

const { data, pending, error, refresh } = await useFetch('/api/presets', {
  transform: (res: { presets: PresetSummary[] }) => res.presets,
  default: () => [],
})

function select(id: string) {
  emit('update:modelValue', id)
}
</script>

<template>
  <UiLoadingState v-if="pending" label="Loading presets…" />
  <UiErrorState
    v-else-if="error"
    title="Couldn't load presets"
    :message="error.statusMessage ?? 'Try again in a moment.'"
    @retry="refresh()"
  />
  <UiEmptyState
    v-else-if="!data || data.length === 0"
    title="No presets yet"
    description="Add a preset to engines/ to get started."
    icon="i-lucide-layers"
  />
  <ul v-else class="flex flex-col gap-1">
    <li v-for="p in data" :key="p.id">
      <button
        type="button"
        class="flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left text-sm transition-colors"
        :class="modelValue === p.id
          ? 'border-primary bg-primary/10 text-highlighted'
          : 'border-default bg-default text-default hover:bg-elevated'"
        @click="select(p.id)"
      >
        <span class="font-medium">{{ p.name }}</span>
        <span class="text-xs text-muted">v{{ p.version }}</span>
      </button>
    </li>
  </ul>
</template>
