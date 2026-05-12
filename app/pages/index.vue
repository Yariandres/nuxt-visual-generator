<script setup lang="ts">
</script>

<template>
  <div class="mx-auto max-w-7xl px-6 py-8 flex flex-col gap-8">
    <div>
      <h1 class="text-2xl font-bold text-highlighted">
        Generator
      </h1>
      <p class="mt-1 text-muted">
        Select a preset, fill the inputs, and generate production-quality visuals.
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <section class="lg:col-span-2 flex flex-col gap-6">
        <UCard>
          <template #header>
            <h2 class="text-base font-semibold text-highlighted">
              Preset
            </h2>
          </template>
          <p class="text-sm text-muted">
            Preset selector will be rendered here.
          </p>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="text-base font-semibold text-highlighted">
              Inputs
            </h2>
          </template>
          <p class="text-sm text-muted">
            Dynamic form fields will be rendered here based on the selected preset.
          </p>
        </UCard>

        <UButton label="Generate" icon="i-lucide-sparkles" size="lg" disabled />
      </section>

      <aside class="flex flex-col gap-6">
        <UCard>
          <template #header>
            <h2 class="text-base font-semibold text-highlighted">
              Output Preview
            </h2>
          </template>
          <div class="flex items-center justify-center rounded-md border border-dashed border-muted bg-elevated h-64">
            <p class="text-sm text-muted">
              Generated output will appear here.
            </p>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="text-base font-semibold text-highlighted">
              Recent Outputs
            </h2>
          </template>
          <p class="text-sm text-muted">
            Last 10 generated outputs will be listed here.
          </p>
        </UCard>
      </aside>
    </div>
  </div>
</template>
