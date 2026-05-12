<script setup lang="ts">
interface ErrorStateProps {
  title?: string
  message?: string
  retryLabel?: string
}

withDefaults(defineProps<ErrorStateProps>(), {
  title: 'Something went wrong',
  message: undefined,
  retryLabel: 'Try again',
})

defineEmits<{
  retry: []
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 py-12 text-center">
    <UIcon name="i-lucide-circle-alert" class="size-8 text-error" />
    <p class="text-sm font-medium text-highlighted">{{ title }}</p>
    <p v-if="message" class="max-w-xs text-xs text-muted">{{ message }}</p>
    <UButton
      :label="retryLabel"
      color="neutral"
      variant="outline"
      size="sm"
      class="mt-2"
      @click="$emit('retry')"
    />
  </div>
</template>
