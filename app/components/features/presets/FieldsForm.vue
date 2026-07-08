<script setup lang="ts">
import type { Preset, PresetField } from '#shared/schemas/preset'
import type { FieldStatus } from '~/composables/useWorkflowState'

defineProps<{
  preset: Preset
  modelValue: Record<string, string>
  errors?: Record<string, string>
  expandStatus?: Record<string, FieldStatus>
  expandErrors?: Record<string, string>
}>()

const emit = defineEmits<{
  'update:modelValue': [values: Record<string, string>]
  'expand': [key: string]
}>()

function update(current: Record<string, string>, key: string, value: string) {
  emit('update:modelValue', { ...current, [key]: value })
}

function canExpand(field: PresetField): boolean {
  return field.type === 'text' && Boolean(field.expand?.enabled)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div
      v-for="field in preset.fields"
      :key="field.key"
      class="flex flex-col gap-1"
    >
      <div class="flex items-center justify-between gap-2">
        <label
          :for="`field-${field.key}`"
          class="text-xs font-bold text-highlighted"
        >
          {{ field.label }}
          <span
            v-if="field.required"
            class="text-error"
            aria-hidden="true"
          >*</span>
          <span
            v-if="field.required"
            class="sr-only"
          >required</span>
        </label>
        <UButton
          v-if="canExpand(field)"
          label="Expand with AI"
          icon="i-lucide-sparkles"
          size="xs"
          variant="soft"
          :loading="expandStatus?.[field.key] === 'pending'"
          :disabled="expandStatus?.[field.key] === 'pending' || !modelValue[field.key]?.trim()"
          @click="emit('expand', field.key)"
        />
      </div>
      <USelect
        v-if="field.type === 'select'"
        :id="`field-${field.key}`"
        :items="field.options"
        :model-value="modelValue[field.key] ?? ''"
        placeholder="Select"
        size="sm"
        :color="errors?.[field.key] ? 'error' : undefined"
        :aria-invalid="Boolean(errors?.[field.key])"
        :aria-describedby="errors?.[field.key] ? `field-${field.key}-error` : undefined"
        @update:model-value="(v: string) => update(modelValue, field.key, v)"
      />
      <UTextarea
        v-else-if="canExpand(field)"
        :id="`field-${field.key}`"
        :model-value="modelValue[field.key] ?? ''"
        :placeholder="`Enter ${field.label.toLowerCase()}`"
        :rows="3"
        autoresize
        size="sm"
        :color="errors?.[field.key] ? 'error' : undefined"
        :aria-invalid="Boolean(errors?.[field.key])"
        :aria-describedby="errors?.[field.key] ? `field-${field.key}-error` : undefined"
        @update:model-value="(v: string | number) => update(modelValue, field.key, String(v))"
      />
      <UInput
        v-else
        :id="`field-${field.key}`"
        :model-value="modelValue[field.key] ?? ''"
        :placeholder="`Enter ${field.label.toLowerCase()}`"
        size="sm"
        :color="errors?.[field.key] ? 'error' : undefined"
        :aria-invalid="Boolean(errors?.[field.key])"
        :aria-describedby="errors?.[field.key] ? `field-${field.key}-error` : undefined"
        @update:model-value="(v: string | number) => update(modelValue, field.key, String(v))"
      />
      <p
        v-if="errors?.[field.key]"
        :id="`field-${field.key}-error`"
        class="text-xs text-error"
      >
        {{ errors[field.key] }}
      </p>
      <p
        v-else-if="expandStatus?.[field.key] === 'error' && expandErrors?.[field.key]"
        class="text-xs text-error"
      >
        {{ expandErrors[field.key] }}
      </p>
    </div>
  </div>
</template>
