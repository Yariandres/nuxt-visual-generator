<script setup lang="ts">
import type { PresetV2DynamicField } from '#shared/schemas/preset'
import type { FieldStatus } from '~/composables/useWorkflowState'

const props = defineProps<{
  fields: PresetV2DynamicField[]
  modelValue: Record<string, string>
  expandStatus?: Record<string, FieldStatus>
  expandErrors?: Record<string, string>
}>()

const emit = defineEmits<{
  'update:modelValue': [values: Record<string, string>]
  'expand': [key: string]
}>()

function update(key: string, value: string) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div
      v-for="field in fields"
      :key="field.key"
      class="flex flex-col overflow-hidden rounded-md border border-default"
    >
      <div class="flex items-center justify-between gap-2 bg-elevated px-3 py-2">
        <label
          :for="`field-${field.key}`"
          class="truncate text-sm font-bold text-highlighted"
        >{{ field.label }}</label>
        <UButton
          v-if="field.aiEnabled"
          label="Expand with AI"
          icon="i-lucide-sparkles"
          size="xs"
          variant="soft"
          :loading="expandStatus?.[field.key] === 'pending'"
          :disabled="expandStatus?.[field.key] === 'pending' || !modelValue[field.key]?.trim()"
          @click="emit('expand', field.key)"
        />
      </div>
      <UTextarea
        :id="`field-${field.key}`"
        :model-value="modelValue[field.key] ?? ''"
        :placeholder="field.placeholder || `Describe ${field.label.toLowerCase()}...`"
        :rows="5"
        :ui="{ base: 'rounded-none border-0' }"
        @update:model-value="(v: string | number) => update(field.key, String(v))"
      />
      <p
        v-if="expandStatus?.[field.key] === 'error' && expandErrors?.[field.key]"
        class="bg-elevated px-3 py-1 text-xs text-error"
      >
        {{ expandErrors[field.key] }}
      </p>
    </div>
  </div>
</template>
