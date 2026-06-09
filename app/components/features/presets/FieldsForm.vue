<script setup lang="ts">
import type { Preset } from '#shared/schemas/preset'

defineProps<{
  preset: Preset
  modelValue: Record<string, string>
  errors?: Record<string, string>
}>()

const emit = defineEmits<{
  'update:modelValue': [values: Record<string, string>]
}>()

function update(current: Record<string, string>, key: string, value: string) {
  emit('update:modelValue', { ...current, [key]: value })
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div
      v-for="field in preset.fields"
      :key="field.key"
      class="flex flex-col gap-1"
    >
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
    </div>
  </div>
</template>
