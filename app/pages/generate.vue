<script setup lang="ts">
definePageMeta({
  layout: 'default',
})
</script>

<template>
  <div class="flex min-h-0 w-full">
    <!-- Left sidebar: Presets, Input, Parameters -->
    <aside class="flex w-80 shrink-0 flex-col border-r border-default bg-muted overflow-y-auto">
      <!-- Presets section -->
      <section class="flex flex-col gap-2 p-3">
        <h2 class="text-[10px] font-black tracking-wide text-dimmed uppercase">Presets</h2>
        <UInput icon="i-lucide-search" placeholder="Search..." size="sm" />
        <UiEmptyState
          title="No presets loaded"
          description="Presets will appear here once the backend is connected."
          icon="i-lucide-layers"
        />
      </section>

      <USeparator />

      <!-- Input section -->
      <section class="flex flex-col gap-2 p-3">
        <h2 class="text-[10px] font-black tracking-wide text-dimmed uppercase">Input</h2>
        <div class="grid grid-cols-3 gap-2">
          <div
            v-for="i in 3"
            :key="i"
            class="flex aspect-square items-center justify-center rounded-md border border-dashed border-muted bg-elevated"
          >
            <UIcon name="i-lucide-image-plus" class="size-5 text-dimmed" />
          </div>
        </div>
      </section>

      <USeparator />

      <!-- Parameters section -->
      <section class="flex flex-col gap-2 p-3">
        <h2 class="text-[10px] font-black tracking-wide text-dimmed uppercase">Parameters</h2>
        <div class="grid grid-cols-3 gap-x-3 gap-y-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-bold text-highlighted">Ratio</label>
            <USelect
              :items="['16:9', '4:3', '1:1', '9:16']"
              placeholder="Select"
              size="sm"
              disabled
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-bold text-highlighted">Hero position</label>
            <USelect
              :items="['Left', 'Center', 'Right']"
              placeholder="Select"
              size="sm"
              disabled
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-bold text-highlighted">Scale</label>
            <USelect
              :items="['Small', 'Medium', 'Big (60 cm)']"
              placeholder="Select"
              size="sm"
              disabled
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-bold text-highlighted">Scene density</label>
            <USelect
              :items="['Minimal', 'Balanced', 'Dense']"
              placeholder="Select"
              size="sm"
              disabled
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-bold text-highlighted">Camera</label>
            <USelect
              :items="['Random', 'Close-up', 'Wide']"
              placeholder="Select"
              size="sm"
              disabled
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-bold text-highlighted">6</label>
            <USelect
              :items="['6 Parameter']"
              placeholder="Select"
              size="sm"
              disabled
            />
          </div>
        </div>
      </section>

      <!-- Generate button -->
      <div class="mt-auto p-3">
        <UButton
          label="GENERATE"
          icon="i-lucide-sparkles"
          size="lg"
          block
          disabled
        >
          <template #trailing>
            <USeparator orientation="vertical" class="h-4" />
            <span class="text-xs">20 cr.</span>
          </template>
        </UButton>
      </div>
    </aside>

    <!-- Center panel: Output preview -->
    <main class="flex min-w-0 flex-1 flex-col">
      <!-- Image preview area -->
      <div class="flex flex-1 items-center justify-center bg-accented p-4">
        <UiEmptyState
          title="No output yet"
          description="Select a preset and generate to see results here."
          icon="i-lucide-image"
        />
      </div>

      <!-- Prompt / Run area -->
      <div class="flex flex-col border-t border-default">
        <div class="h-32 bg-elevated p-3">
          <UTextarea
            placeholder="Assembled prompt will appear here..."
            :rows="3"
            disabled
            class="h-full"
          />
        </div>
        <div class="flex items-center justify-between border-t border-default px-3 py-2">
          <div class="flex items-center gap-2">
            <UButton icon="i-lucide-chevron-left" size="xs" color="neutral" variant="soft" disabled />
            <span class="text-sm text-muted">0</span>
            <UButton icon="i-lucide-chevron-right" size="xs" color="neutral" variant="soft" disabled />
          </div>
          <div class="flex items-center gap-3">
            <UButton
              label="RUN"
              size="xs"
              disabled
            >
              <template #trailing>
                <USeparator orientation="vertical" class="h-3" />
                <span class="text-xs">20 cr.</span>
              </template>
            </UButton>
          </div>
        </div>
      </div>
    </main>

    <!-- Right sidebar: Information + Editor -->
    <aside class="flex w-72 shrink-0 flex-col border-l border-default bg-muted overflow-y-auto">
      <!-- Information section -->
      <section class="flex flex-col gap-1 p-3">
        <h2 class="text-[10px] font-black tracking-wide text-dimmed uppercase">Information</h2>
        <p class="text-xs text-muted">No generation selected.</p>
      </section>

      <USeparator />

      <!-- Editor section -->
      <section class="flex flex-col gap-3 p-3">
        <h2 class="text-[10px] font-black tracking-wide text-dimmed uppercase">Editor</h2>

        <!-- Mood field 1 -->
        <div class="flex flex-col overflow-hidden rounded-md border border-default">
          <div class="flex items-center justify-between bg-elevated px-3 py-2">
            <span class="text-sm font-bold text-highlighted">Mood</span>
            <UButton label="EXPAND" size="xs" disabled>
              <template #trailing>
                <USeparator orientation="vertical" class="h-3" />
                <span class="text-xs">5 cr.</span>
              </template>
            </UButton>
          </div>
          <UTextarea
            placeholder="Describe the mood..."
            :rows="5"
            disabled
            class="border-0"
            :ui="{ base: 'rounded-none border-0' }"
          />
        </div>

        <!-- Mood field 2 -->
        <div class="flex flex-col overflow-hidden rounded-md border border-default">
          <div class="flex items-center justify-between bg-elevated px-3 py-2">
            <span class="text-sm font-bold text-highlighted">Mood</span>
            <UButton label="EXPAND" size="xs" disabled>
              <template #trailing>
                <USeparator orientation="vertical" class="h-3" />
                <span class="text-xs">5 cr.</span>
              </template>
            </UButton>
          </div>
          <UTextarea
            placeholder="Describe the mood..."
            :rows="5"
            disabled
            class="border-0"
            :ui="{ base: 'rounded-none border-0' }"
          />
        </div>
      </section>
    </aside>
  </div>
</template>
