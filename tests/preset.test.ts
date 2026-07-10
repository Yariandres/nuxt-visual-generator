import { describe, expect, it } from 'vitest'
import { validatePreset } from '#shared/schemas/preset'
import { styleSelectField, subjectTextField, validPresetInput } from './fixtures'

describe('validatePreset', () => {
  it('accepts a well-formed preset', () => {
    const result = validatePreset(validPresetInput())
    expect(result.ok).toBe(true)
  })

  it('rejects a preset missing a required top-level field', () => {
    const { name, ...withoutName } = validPresetInput()
    void name
    const result = validatePreset(withoutName)
    expect(result.ok).toBe(false)
  })

  it('rejects a template token with no matching field', () => {
    const result = validatePreset({
      ...validPresetInput(),
      template: 'A {{SUBJECT}} in {{GHOST}} style.',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.message.includes('GHOST'))).toBe(true)
    }
  })

  it('rejects a field never referenced in the template', () => {
    const result = validatePreset({
      ...validPresetInput(),
      fields: [subjectTextField(), styleSelectField(), { key: 'EXTRA', label: 'Extra', type: 'text', required: false }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.message.includes('EXTRA'))).toBe(true)
    }
  })

  it('rejects a select default not among its options', () => {
    const result = validatePreset({
      ...validPresetInput(),
      fields: [subjectTextField(), { ...styleSelectField(), default: 'neon' }],
    })
    expect(result.ok).toBe(false)
  })

  it('rejects duplicate field keys', () => {
    const result = validatePreset({
      ...validPresetInput(),
      fields: [subjectTextField(), subjectTextField()],
    })
    expect(result.ok).toBe(false)
  })

  it('rejects an expand.promptTemplate missing the {{value}} placeholder', () => {
    const result = validatePreset({
      ...validPresetInput(),
      fields: [
        { ...subjectTextField(), expand: { enabled: true, promptTemplate: 'no placeholder here' } },
        styleSelectField(),
      ],
    })
    expect(result.ok).toBe(false)
  })

  it('rejects a field key that breaks the key format', () => {
    const result = validatePreset({
      ...validPresetInput(),
      template: 'A {{subject}} in {{STYLE}} style.',
      fields: [{ ...subjectTextField(), key: 'subject' }, styleSelectField()],
    })
    expect(result.ok).toBe(false)
  })
})
