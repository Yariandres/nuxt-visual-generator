<script setup lang="ts">
const user = useSupabaseUser()
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-default">
    <header class="border-b border-default">
      <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div class="flex items-center gap-8">
          <NuxtLink to="/" class="text-lg font-bold text-highlighted">
            Onward
          </NuxtLink>
          <nav class="hidden items-center gap-4 sm:flex">
            <NuxtLink to="/blog" class="text-sm text-muted hover:text-default">
              Blog
            </NuxtLink>
            <NuxtLink to="/contact" class="text-sm text-muted hover:text-default">
              Contact
            </NuxtLink>
          </nav>
        </div>

        <div class="flex items-center gap-3">
          <UColorModeButton />
          <UButton
            v-if="user"
            label="Open App"
            to="/generate"
            size="sm"
          />
          <template v-else>
            <UButton
              label="Sign in"
              to="/login"
              color="neutral"
              variant="ghost"
              size="sm"
            />
            <UButton
              label="Sign up"
              to="/signup"
              size="sm"
            />
          </template>
        </div>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-default">
      <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <span class="text-xs text-dimmed">&copy; {{ new Date().getFullYear() }} Onward</span>
        <nav class="flex items-center gap-4">
          <NuxtLink to="/privacy" class="text-xs text-dimmed hover:text-muted">
            Privacy
          </NuxtLink>
          <NuxtLink to="/contact" class="text-xs text-dimmed hover:text-muted">
            Contact
          </NuxtLink>
        </nav>
      </div>
    </footer>
  </div>
</template>
