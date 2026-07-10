import type { Preset } from '#shared/schemas/preset'

export type FieldStatus = 'idle' | 'pending' | 'error'
export type GenerateStatus = 'idle' | 'pending' | 'error'

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
  const selectedPreset = useState<Preset | null>('workflow:selectedPreset', () => null)
  const inputs = useState<Record<string, string>>('workflow:inputs', () => ({}))
  const expandStatus = useState<Record<string, FieldStatus>>('workflow:expandStatus', () => ({}))
  const expandErrors = useState<Record<string, string>>('workflow:expandErrors', () => ({}))
  const generateStatus = useState<GenerateStatus>('workflow:generateStatus', () => 'idle')
  const generateError = useState<string | null>('workflow:generateError', () => null)
  const recentOutputs = useState<GeneratedOutput[]>('workflow:recentOutputs', () => [])
  const attemptedSubmit = useState<boolean>('workflow:attemptedSubmit', () => false)
  const currentProjectId = useState<string | null>('workflow:currentProjectId', () => null)

  const validationErrors = computed<Record<string, string>>(() => {
    const preset = selectedPreset.value
    if (!preset) return {}
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

  function seedInputs(preset: Preset): Record<string, string> {
    const seeded: Record<string, string> = {}
    for (const field of preset.fields) {
      seeded[field.key] = field.default ?? ''
    }
    return seeded
  }

  // Manually choosing a preset starts fresh, detached work: seed defaults and
  // drop any loaded-project association.
  function setPreset(preset: Preset | null) {
    selectedPreset.value = preset
    inputs.value = preset ? seedInputs(preset) : {}
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
  // it in place.
  function restoreProject(preset: Preset, savedInputs: Record<string, string>, projectId: string) {
    selectedPreset.value = preset
    selectedPresetId.value = preset.id
    inputs.value = { ...seedInputs(preset), ...savedInputs }
    expandStatus.value = {}
    expandErrors.value = {}
    generateStatus.value = 'idle'
    generateError.value = null
    recentOutputs.value = []
    attemptedSubmit.value = false
    currentProjectId.value = projectId
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
    inputs,
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
    setExpandStatus,
    setGenerateStatus,
    addRecentOutput,
    setRecentOutputs,
    attemptSubmit,
  }
}
