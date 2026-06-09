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
  const generateStatus = useState<GenerateStatus>('workflow:generateStatus', () => 'idle')
  const generateError = useState<string | null>('workflow:generateError', () => null)
  const recentOutputs = useState<GeneratedOutput[]>('workflow:recentOutputs', () => [])
  const attemptedSubmit = useState<boolean>('workflow:attemptedSubmit', () => false)

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

  // Recent outputs are scoped per workflow session; switching preset is treated
  // as switching projects until BL-027 lands actual project records.
  function setPreset(preset: Preset | null) {
    selectedPreset.value = preset
    inputs.value = preset ? seedInputs(preset) : {}
    expandStatus.value = {}
    generateStatus.value = 'idle'
    generateError.value = null
    recentOutputs.value = []
    attemptedSubmit.value = false
  }

  function attemptSubmit(): boolean {
    attemptedSubmit.value = true
    return isValid.value
  }

  function setInput(key: string, value: string) {
    inputs.value = { ...inputs.value, [key]: value }
  }

  function setExpandStatus(key: string, status: FieldStatus) {
    expandStatus.value = { ...expandStatus.value, [key]: status }
  }

  function setGenerateStatus(status: GenerateStatus, error: string | null = null) {
    generateStatus.value = status
    generateError.value = status === 'error' ? error : null
  }

  function addRecentOutput(output: GeneratedOutput) {
    recentOutputs.value = [output, ...recentOutputs.value].slice(0, RECENT_OUTPUT_LIMIT)
  }

  return {
    selectedPresetId,
    selectedPreset,
    inputs,
    expandStatus,
    generateStatus,
    generateError,
    recentOutputs,
    validationErrors,
    visibleErrors,
    isValid,
    attemptedSubmit,
    setPreset,
    setInput,
    setExpandStatus,
    setGenerateStatus,
    addRecentOutput,
    attemptSubmit,
  }
}
