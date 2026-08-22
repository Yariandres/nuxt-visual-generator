<script setup lang="ts">
import type { PresetSummary } from '#shared/schemas/preset'

defineProps<{ modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [id: string] }>()

const { data, pending, error, refresh } = await useFetch('/api/presets', {
  transform: (res: { presets: PresetSummary[] }) => res.presets,
  default: () => [],
})

// Search bar over the list so a growing preset set stays navigable (BL-048).
const query = ref('')
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return data.value
  return data.value.filter(
    p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
  )
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
  <div v-else class="flex flex-col gap-2">
    <UInput
      v-if="data.length > 1"
      v-model="query"
      icon="i-lucide-search"
      placeholder="Search presets…"
      size="sm"
      :aria-label="'Search presets'"
      :ui="{ trailing: 'pe-1' }"
    >
      <template v-if="query" #trailing>
        <UButton
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="link"
          aria-label="Clear search"
          @click="query = ''"
        />
      </template>
    </UInput>

    <p
      v-if="filtered.length === 0"
      class="px-1 py-2 text-xs text-muted"
    >
      No presets match “{{ query }}”.
    </p>
    <ul v-else class="flex flex-col gap-1">
      <li v-for="p in filtered" :key="p.id">
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
  </div>
</template>
