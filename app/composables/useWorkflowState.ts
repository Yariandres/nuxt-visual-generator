import type { AnyPreset, PresetFormat } from '#shared/schemas/preset'

export type FieldStatus = 'idle' | 'pending' | 'error'
export type GenerateStatus = 'idle' | 'pending' | 'error'
export type ParamValue = string | boolean

export interface GeneratedOutput {
  id: string
  url: string
  prompt: string
  createdAt: string
  status: 'succeeded' | 'failed'
}

const RECENT_OUTPUT_LIMIT = 10

export function useWorkflowState() {
  const selectedPresetId = useState<string | null>('workflow:selectedPresetId', () => null)
  const selectedPreset = useState<AnyPreset | null>('workflow:selectedPreset', () => null)
  const inputs = useState<Record<string, string>>('workflow:inputs', () => ({}))
  const params = useState<Record<string, ParamValue>>('workflow:params', () => ({}))
  const expandStatus = useState<Record<string, FieldStatus>>('workflow:expandStatus', () => ({}))
  const expandErrors = useState<Record<string, string>>('workflow:expandErrors', () => ({}))
  const generateStatus = useState<GenerateStatus>('workflow:generateStatus', () => 'idle')
  const generateError = useState<string | null>('workflow:generateError', () => null)
  const recentOutputs = useState<GeneratedOutput[]>('workflow:recentOutputs', () => [])
  const attemptedSubmit = useState<boolean>('workflow:attemptedSubmit', () => false)
  const currentProjectId = useState<string | null>('workflow:currentProjectId', () => null)

  const presetFormat = computed<PresetFormat | null>(() => {
    const preset = selectedPreset.value
    if (!preset) return null
    return 'fields' in preset ? 'v1' : 'v2'
  })

  const validationErrors = computed<Record<string, string>>(() => {
    const preset = selectedPreset.value
    // v2 dynamicFields have no `required` flag -- tokenMap fallbacks cover
    // missing values, so there is nothing to block submission on.
    if (!preset || !('fields' in preset)) return {}
    const errors: Record<string, string> = {}
    for (const field of preset.fields) {
      if (!field.required) continue
      const value = inputs.value[field.key]
      if (value === undefined || value.trim() === '') {
        errors[field.key] = `${field.label} is required`
      }
    }
    return errors
  })

  const isValid = computed(() => Object.keys(validationErrors.value).length === 0)
  const visibleErrors = computed(() => (attemptedSubmit.value ? validationErrors.value : {}))

  function seedInputs(preset: AnyPreset): Record<string, string> {
    const seeded: Record<string, string> = {}
    if ('fields' in preset) {
      for (const field of preset.fields) seeded[field.key] = field.default ?? ''
    } else {
      for (const field of preset.dynamicFields) seeded[field.key] = ''
    }
    return seeded
  }

  // v2 params seed from each specialParam's declared default; V1 has none.
  function seedParams(preset: AnyPreset): Record<string, ParamValue> {
    const seeded: Record<string, ParamValue> = {}
    if (!('fields' in preset)) {
      for (const param of preset.specialParams) seeded[param.key] = param.default
    }
    return seeded
  }

  // Manually choosing a preset starts fresh, detached work: seed defaults and
  // drop any loaded-project association.
  function setPreset(preset: AnyPreset | null) {
    selectedPreset.value = preset
    inputs.value = preset ? seedInputs(preset) : {}
    params.value = preset ? seedParams(preset) : {}
    expandStatus.value = {}
    expandErrors.value = {}
    generateStatus.value = 'idle'
    generateError.value = null
    recentOutputs.value = []
    attemptedSubmit.value = false
    currentProjectId.value = null
  }

  // Restore a saved project: apply its preset, overlay saved inputs on top of
  // the preset defaults, and record the project id so subsequent saves update
  // it in place. Params reset to preset defaults (not yet persisted per project).
  function restoreProject(preset: AnyPreset, savedInputs: Record<string, string>, projectId: string) {
    selectedPreset.value = preset
    selectedPresetId.value = preset.id
    inputs.value = { ...seedInputs(preset), ...savedInputs }
    params.value = seedParams(preset)
    expandStatus.value = {}
    expandErrors.value = {}
    generateStatus.value = 'idle'
    generateError.value = null
    recentOutputs.value = []
    attemptedSubmit.value = false
    currentProjectId.value = projectId
  }

  function setParam(key: string, value: ParamValue) {
    params.value = { ...params.value, [key]: value }
  }

  function setCurrentProjectId(id: string | null) {
    currentProjectId.value = id
  }

  function attemptSubmit(): boolean {
    attemptedSubmit.value = true
    return isValid.value
  }

  function setInput(key: string, value: string) {
    inputs.value = { ...inputs.value, [key]: value }
  }

  function setExpandStatus(key: string, status: FieldStatus, message: string | null = null) {
    expandStatus.value = { ...expandStatus.value, [key]: status }
    expandErrors.value = { ...expandErrors.value, [key]: status === 'error' ? (message ?? '') : '' }
  }

  function setGenerateStatus(status: GenerateStatus, error: string | null = null) {
    generateStatus.value = status
    generateError.value = status === 'error' ? error : null
  }

  function addRecentOutput(output: GeneratedOutput) {
    recentOutputs.value = [output, ...recentOutputs.value].slice(0, RECENT_OUTPUT_LIMIT)
  }

  // Replace the recent-outputs list wholesale, e.g. when loading a project's
  // persisted generation history.
  function setRecentOutputs(outputs: GeneratedOutput[]) {
    recentOutputs.value = outputs.slice(0, RECENT_OUTPUT_LIMIT)
  }

  return {
    selectedPresetId,
    selectedPreset,
    presetFormat,
    inputs,
    params,
    expandStatus,
    expandErrors,
    generateStatus,
    generateError,
    recentOutputs,
    currentProjectId,
    validationErrors,
    visibleErrors,
    isValid,
    attemptedSubmit,
    setPreset,
    restoreProject,
    setCurrentProjectId,
    setInput,
    setParam,
    setExpandStatus,
    setGenerateStatus,
    addRecentOutput,
    setRecentOutputs,
    attemptSubmit,
  }
}
