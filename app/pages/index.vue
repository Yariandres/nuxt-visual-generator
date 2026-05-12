<script setup lang="ts">
definePageMeta({
  layout: 'public',
})

const user = useSupabaseUser()
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-24 text-center">
    <h1 class="text-4xl font-bold tracking-tight text-highlighted sm:text-5xl">
      Production-quality visuals through structured AI workflows
    </h1>
    <p class="mx-auto mt-6 max-w-2xl text-lg text-muted">
      Onward gives creative teams repeatable, controlled generation using preset-based workflows instead of raw prompting. Consistent outputs, every time.
    </p>
    <div class="mt-10 flex items-center justify-center gap-4">
      <UButton
        v-if="user"
        label="Open App"
        to="/generate"
        size="lg"
      />
      <template v-else>
        <UButton
          label="Get started"
          to="/signup"
          size="lg"
        />
        <UButton
          label="Sign in"
          to="/login"
          color="neutral"
          variant="outline"
          size="lg"
        />
      </template>
    </div>
  </div>
</template>
