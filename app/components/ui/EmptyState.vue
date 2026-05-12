<script setup lang="ts">
interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
}

withDefaults(defineProps<EmptyStateProps>(), {
  icon: 'i-lucide-inbox',
  description: undefined,
})
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 py-12 text-center">
    <UIcon :name="icon" class="size-8 text-dimmed" />
    <p class="text-sm font-medium text-muted">{{ title }}</p>
    <p v-if="description" class="max-w-xs text-xs text-dimmed">{{ description }}</p>
    <div v-if="$slots.default" class="mt-2">
      <slot />
    </div>
  </div>
</template>
