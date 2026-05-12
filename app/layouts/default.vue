<template>
  <div class="flex h-dvh flex-col bg-default">
    <header class="flex h-10 shrink-0 items-center justify-between border-b border-default px-4">
      <div class="flex items-center gap-4">
        <span class="text-sm font-bold text-muted">File</span>
        <span class="text-sm font-bold text-muted">About</span>
      </div>

      <div class="flex items-center gap-3">
        <span class="text-sm text-muted">0 credits</span>
        <UColorModeButton size="xs" />
      </div>
    </header>

    <div class="flex min-h-0 flex-1">
      <slot />
    </div>

    <footer class="flex h-7 shrink-0 items-center justify-between border-t border-default px-4">
      <span class="text-xs text-muted">Ready</span>
      <span class="text-xs text-dimmed">v1.0</span>
    </footer>
  </div>
</template>
