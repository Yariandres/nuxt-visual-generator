<script setup lang="ts">
interface LoadingStateProps {
  label?: string
}

withDefaults(defineProps<LoadingStateProps>(), {
  label: 'Loading…',
})
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 py-12">
    <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
    <span class="text-sm text-muted">{{ label }}</span>
  </div>
</template>
