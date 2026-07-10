import type { Preset } from '#shared/schemas/preset'

// Field builders return fresh, mutable objects so tests can compose valid and
// invalid variants without shared state.
export function subjectTextField() {
  return {
    key: 'SUBJECT',
    label: 'Subject',
    type: 'text',
    required: true,
    expand: { enabled: true, promptTemplate: 'Expand: {{value}}' },
  }
}

export function styleSelectField() {
  return {
    key: 'STYLE',
    label: 'Style',
    type: 'select',
    required: true,
    options: ['photoreal', 'minimal'],
    default: 'photoreal',
  }
}

export function validPresetInput() {
  return {
    id: 'test_preset',
    name: 'Test Preset',
    version: '1.0.0',
    template: 'A {{SUBJECT}} in {{STYLE}} style.',
    fields: [subjectTextField(), styleSelectField()],
    constraints: {
      mustPreserve: ['shape'],
      allowedChanges: ['lighting'],
      qualityRules: ['no distortion'],
    },
    output: { type: 'image', defaultAspectRatio: '16:9' },
  }
}

export function validPreset(): Preset {
  return validPresetInput() as unknown as Preset
}
