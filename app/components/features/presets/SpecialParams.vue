<script setup lang="ts">
import type { PresetV2SpecialParam } from '#shared/schemas/preset'
import type { ParamValue } from '~/composables/useWorkflowState'

const props = defineProps<{
  params: PresetV2SpecialParam[]
  modelValue: Record<string, ParamValue>
}>()

const emit = defineEmits<{
  'update:modelValue': [values: Record<string, ParamValue>]
}>()

function update(key: string, value: ParamValue) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

// Nuxt UI USelect wants `{ label, value }` items.
function selectItems(param: Extract<PresetV2SpecialParam, { type: 'select' }>) {
  return param.options.map(o => ({ label: o.label, value: o.value }))
}
</script>

<template>
  <div class="grid grid-cols-2 gap-x-3 gap-y-4">
    <template
      v-for="param in params"
      :key="param.key"
    >
      <!-- select -->
      <div
        v-if="param.type === 'select'"
        class="flex flex-col gap-1"
      >
        <label
          :for="`param-${param.key}`"
          class="text-xs font-bold text-highlighted"
        >{{ param.label }}</label>
        <USelect
          :id="`param-${param.key}`"
          :items="selectItems(param)"
          :model-value="(modelValue[param.key] as string) ?? param.default"
          value-key="value"
          placeholder="Select"
          size="sm"
          @update:model-value="(v: string) => update(param.key, v)"
        />
      </div>

      <!-- checkbox -->
      <div
        v-else-if="param.type === 'checkbox'"
        class="col-span-2 flex flex-col gap-1"
      >
        <label class="text-xs font-bold text-highlighted">{{ param.label }}</label>
        <UCheckbox
          :model-value="(modelValue[param.key] as boolean) ?? param.default"
          :label="param.checkboxLabel"
          size="sm"
          @update:model-value="(v: boolean | 'indeterminate') => update(param.key, v === true)"
        />
      </div>
    </template>
  </div>
</template>
