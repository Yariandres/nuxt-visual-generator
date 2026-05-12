<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

const user = useSupabaseUser()

watch(user, () => {
  if (user.value) {
    navigateTo('/generate')
  }
}, { immediate: true })
</script>

<template>
  <UPageCard>
    <div class="flex flex-col items-center gap-3 py-8 text-center">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
      <h2 class="text-lg font-semibold text-highlighted">Confirming your session</h2>
      <p class="text-sm text-muted">Please wait while we verify your account...</p>
    </div>
  </UPageCard>
</template>
