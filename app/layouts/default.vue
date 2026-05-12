<script setup lang="ts">
</script>

<template>
  <div class="min-h-dvh flex flex-col bg-default">
    <header class="border-b border-default px-6 py-3 flex items-center justify-between">
      <NuxtLink to="/" class="text-lg font-semibold text-highlighted">
        Onward
      </NuxtLink>

      <div class="flex items-center gap-2">
        <UColorModeButton />
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>
  </div>
</template>
