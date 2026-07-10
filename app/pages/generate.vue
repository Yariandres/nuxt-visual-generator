<script setup lang="ts">
import { fetchPreset } from '~/api/presets'
import { expandField } from '~/api/expand'
import { generateImage } from '~/api/generate'
import { createProject, fetchProject, updateProject, fetchProjectGenerations } from '~/api/projects'

definePageMeta({
  layout: 'default',
})

const {
  selectedPresetId,
  selectedPreset,
  inputs,
  visibleErrors,
  expandStatus,
  expandErrors,
  generateStatus,
  generateError,
  recentOutputs,
  currentProjectId,
  setPreset,
  restoreProject,
  setCurrentProjectId,
  setInput,
  setExpandStatus,
  setGenerateStatus,
  addRecentOutput,
  setRecentOutputs,
  attemptSubmit,
} = useWorkflowState()

const route = useRoute()
const router = useRouter()
const toast = useToast()

// Which recent output is shown in the preview. Falls back to the latest.
const selectedOutputId = ref<string | null>(null)
const selectedOutput = computed(() => {
  const list = recentOutputs.value
  if (list.length === 0) return null
  return list.find(o => o.id === selectedOutputId.value) ?? list[0]
})
const selectedOutputIndex = computed(() => {
  const current = selectedOutput.value
  return current ? recentOutputs.value.findIndex(o => o.id === current.id) : -1
})

// Keep the selection valid as the list changes; default to the latest output.
watch(recentOutputs, (list) => {
  const first = list[0]
  if (!first) {
    selectedOutputId.value = null
  } else if (!list.some(o => o.id === selectedOutputId.value)) {
    selectedOutputId.value = first.id
  }
})

function selectOutput(id: string) {
  selectedOutputId.value = id
}

function stepOutput(delta: number) {
  const next = recentOutputs.value[selectedOutputIndex.value + delta]
  if (next) selectedOutputId.value = next.id
}

const saving = ref(false)
const restoring = ref(false)

async function handleSaveProject() {
  const preset = selectedPreset.value
  if (!preset || saving.value) return

  saving.value = true
  try {
    if (currentProjectId.value) {
      await updateProject(currentProjectId.value, { inputs: inputs.value })
      toast.add({ title: 'Project updated', icon: 'i-lucide-check', color: 'success' })
    } else {
      const project = await createProject(preset.id, inputs.value)
      setCurrentProjectId(project.id)
      await router.replace({ query: { ...route.query, project: project.id } })
      toast.add({ title: 'Project saved', icon: 'i-lucide-check', color: 'success' })
    }
  } catch (err) {
    const message = (err as { statusMessage?: string }).statusMessage ?? 'Please try again.'
    toast.add({ title: 'Could not save project', description: message, icon: 'i-lucide-x', color: 'error' })
  } finally {
    saving.value = false
  }
}

async function restoreProjectFromId(id: string) {
  restoring.value = true
  try {
    const project = await fetchProject(id)
    const preset = await fetchPreset(project.presetId)
    restoreProject(preset, project.inputs, project.id)
    // Populate recent outputs from the project's persisted history.
    try {
      const history = await fetchProjectGenerations(project.id)
      setRecentOutputs(history.map(h => ({
        id: h.id,
        url: h.url,
        prompt: h.prompt,
        createdAt: h.completedAt ?? h.createdAt,
        status: h.status,
      })))
    } catch (err) {
      console.error('[generate] failed to load project history:', err)
    }
    if (project.presetVersion !== preset.version) {
      toast.add({
        title: 'Preset version changed',
        description: `Saved with v${project.presetVersion}; the preset is now v${preset.version}. Inputs were restored.`,
        icon: 'i-lucide-triangle-alert',
        color: 'warning',
      })
    }
  } catch (err) {
    const code = (err as { data?: { code?: string } }).data?.code
    const message = code === 'project_not_found' ? 'Project not found.' : 'Failed to open project.'
    toast.add({ title: 'Could not open project', description: message, icon: 'i-lucide-x', color: 'error' })
    // Drop the unusable id from the URL so a refresh does not re-trigger it.
    await router.replace({ query: { ...route.query, project: undefined } })
  } finally {
    restoring.value = false
  }
}

onMounted(() => {
  const pid = route.query.project
  if (typeof pid === 'string' && pid) restoreProjectFromId(pid)
})

// When work detaches from a saved project (e.g. switching presets clears the
// association), drop the stale id so a refresh doesn't reopen it.
watch(currentProjectId, (id) => {
  if (!id && route.query.project) {
    router.replace({ query: { ...route.query, project: undefined } })
  }
})

const GENERATE_ERROR_MESSAGES: Record<string, string> = {
  invalid_payload: 'Some inputs are invalid. Please review and try again.',
  invalid_inputs: 'Some required inputs are missing or invalid.',
  preset_not_found: 'This preset is no longer available.',
  invalid_preset: 'This preset is misconfigured.',
  gemini_not_configured: 'Image generation is not configured.',
  project_not_found: 'The selected project could not be found.',
  moderation: 'The request was blocked by content safety filters. Try adjusting your inputs.',
  provider_timeout: 'Image generation timed out. Please try again.',
  provider_failure: 'Image generation failed. Please try again.',
  storage_failed: 'The generated image could not be saved. Please try again.',
  signed_url_failed: 'The image was generated but could not be displayed. Check recent outputs.',
}

async function handleGenerate() {
  const preset = selectedPreset.value
  if (!preset || !attemptSubmit()) return

  setGenerateStatus('pending')
  try {
    const { generation, url } = await generateImage(
      preset.id,
      inputs.value,
      currentProjectId.value ?? undefined,
    )
    addRecentOutput({
      id: generation.id,
      url,
      prompt: generation.finalPrompt,
      createdAt: generation.completedAt ?? generation.createdAt,
      status: 'succeeded',
    })
    selectedOutputId.value = generation.id
    setGenerateStatus('idle')
  } catch (err) {
    const code = (err as { data?: { code?: string } }).data?.code
    const message
      = (code && GENERATE_ERROR_MESSAGES[code])
        ?? (err as { statusMessage?: string }).statusMessage
        ?? 'Image generation failed. Please try again.'
    setGenerateStatus('error', message)
  }
}

const EXPAND_ERROR_MESSAGES: Record<string, string> = {
  field_not_found: 'This field can no longer be expanded.',
  wrong_field_type: 'Only text fields can be expanded.',
  field_not_expandable: 'This field does not support AI expansion.',
  provider_failure: 'Expansion failed. Please try again.',
  preset_not_found: 'Preset is no longer available.',
  invalid_preset: 'Preset is misconfigured.',
  openai_not_configured: 'AI expansion is not configured.',
}

async function handleExpand(key: string) {
  const preset = selectedPreset.value
  const value = inputs.value[key]?.trim()
  if (!preset || !value) return

  setExpandStatus(key, 'pending')
  try {
    const result = await expandField(preset.id, key, value)
    setInput(key, result.text)
    setExpandStatus(key, 'idle')
  } catch (err) {
    const code = (err as { data?: { code?: string } }).data?.code
    const message
      = (code && EXPAND_ERROR_MESSAGES[code])
        ?? (err as { statusMessage?: string }).statusMessage
        ?? 'Expansion failed. Please try again.'
    setExpandStatus(key, 'error', message)
  }
}

const presetDetailError = ref<string | null>(null)

watch(selectedPresetId, async (id) => {
  presetDetailError.value = null
  if (!id) {
    setPreset(null)
    return
  }
  // Already loaded (e.g. restored from a project) — don't reset seeded inputs.
  if (selectedPreset.value?.id === id) return
  try {
    const preset = await fetchPreset(id)
    setPreset(preset)
  } catch (err) {
    setPreset(null)
    presetDetailError.value
      = (err as { statusMessage?: string }).statusMessage ?? 'Failed to load preset detail.'
  }
})
</script>

<template>
  <div class="flex min-h-0 w-full">
    <!-- Left sidebar: Presets, Input, Parameters -->
    <aside class="flex w-80 shrink-0 flex-col border-r border-default bg-muted overflow-y-auto">
      <!-- Presets section -->
      <section class="flex flex-col gap-2 p-3">
        <h2 class="text-[10px] font-black tracking-wide text-dimmed uppercase">Presets</h2>
        <FeaturesPresetsSelector v-model="selectedPresetId" />
      </section>

      <USeparator />

      <!-- Input section -->
      <section class="flex flex-col gap-2 p-3">
        <h2 class="text-[10px] font-black tracking-wide text-dimmed uppercase">Input</h2>
        <UiLoadingState v-if="restoring" label="Opening project…" />
        <UiEmptyState
          v-else-if="!selectedPresetId"
          title="Pick a preset"
          description="Choose a preset on the left to start configuring inputs."
          icon="i-lucide-mouse-pointer-click"
        />
        <UiErrorState
          v-else-if="presetDetailError"
          title="Couldn't load preset"
          :message="presetDetailError"
        />
        <UiLoadingState v-else-if="!selectedPreset" label="Loading preset…" />
        <div v-else class="flex flex-col gap-3">
          <div class="flex items-start justify-between gap-2 rounded-md border border-default bg-elevated p-3">
            <div class="min-w-0">
              <div class="truncate text-sm font-bold text-highlighted">{{ selectedPreset.name }}</div>
              <div class="text-xs text-muted">
                v{{ selectedPreset.version }} · Fields ({{ selectedPreset.fields.length }})
                <span v-if="currentProjectId"> · Saved</span>
              </div>
            </div>
            <UButton
              :label="currentProjectId ? 'Update' : 'Save'"
              icon="i-lucide-save"
              size="xs"
              variant="soft"
              :loading="saving"
              :disabled="saving || restoring"
              @click="handleSaveProject"
            />
          </div>
          <FeaturesPresetsFieldsForm
            v-model="inputs"
            :preset="selectedPreset"
            :errors="visibleErrors"
            :expand-status="expandStatus"
            :expand-errors="expandErrors"
            @expand="handleExpand"
          />
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
          :disabled="!selectedPreset || generateStatus === 'pending'"
          :loading="generateStatus === 'pending'"
          @click="handleGenerate"
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
        <UiLoadingState
          v-if="generateStatus === 'pending'"
          label="Generating image…"
        />
        <UiErrorState
          v-else-if="generateStatus === 'error'"
          title="Generation failed"
          :message="generateError ?? 'Something went wrong.'"
        />
        <img
          v-else-if="selectedOutput"
          :src="selectedOutput.url"
          :alt="selectedOutput.prompt"
          class="max-h-full max-w-full rounded-md object-contain shadow-lg"
        >
        <UiEmptyState
          v-else
          title="No output yet"
          description="Select a preset and generate to see results here."
          icon="i-lucide-image"
        />
      </div>

      <!-- Recent outputs strip -->
      <div
        v-if="recentOutputs.length"
        class="flex gap-2 overflow-x-auto border-t border-default bg-default p-2"
      >
        <button
          v-for="output in recentOutputs"
          :key="output.id"
          type="button"
          class="size-14 shrink-0 overflow-hidden rounded border-2 transition-colors"
          :class="output.id === selectedOutput?.id ? 'border-primary' : 'border-transparent hover:border-muted'"
          @click="selectOutput(output.id)"
        >
          <img :src="output.url" :alt="output.prompt" class="size-full object-cover">
        </button>
      </div>

      <!-- Prompt / Run area -->
      <div class="flex flex-col border-t border-default">
        <div class="h-32 bg-elevated p-3">
          <UTextarea
            :model-value="selectedOutput?.prompt ?? ''"
            placeholder="Assembled prompt will appear here..."
            :rows="3"
            disabled
            class="h-full"
          />
        </div>
        <div class="flex items-center justify-between border-t border-default px-3 py-2">
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-chevron-left"
              size="xs"
              color="neutral"
              variant="soft"
              :disabled="selectedOutputIndex <= 0"
              @click="stepOutput(-1)"
            />
            <span class="text-sm text-muted">
              {{ recentOutputs.length ? `${selectedOutputIndex + 1} / ${recentOutputs.length}` : '0' }}
            </span>
            <UButton
              icon="i-lucide-chevron-right"
              size="xs"
              color="neutral"
              variant="soft"
              :disabled="selectedOutputIndex < 0 || selectedOutputIndex >= recentOutputs.length - 1"
              @click="stepOutput(1)"
            />
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
