import { describe, expect, it } from 'vitest'
import { assemblePrompt } from '~~/server/services/prompt/assemble'
import { validPreset } from './fixtures'

const CONSTRAINT_SUFFIX
  = ' Preserve: shape. Allowed changes: lighting. Quality rules: no distortion.'

describe('assemblePrompt', () => {
  it('replaces tokens and appends the constraint suffix (FINAL_PROMPT formula)', () => {
    const result = assemblePrompt(validPreset(), { SUBJECT: 'a red shoe', STYLE: 'photoreal' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.prompt).toBe(`A a red shoe in photoreal style.${CONSTRAINT_SUFFIX}`)
    }
  })

  it('trims input values when substituting', () => {
    const result = assemblePrompt(validPreset(), { SUBJECT: '  a red shoe  ', STYLE: 'photoreal' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.prompt.startsWith('A a red shoe in')).toBe(true)
  })

  it('treats "$&" in user input literally, not as a regex backreference', () => {
    const result = assemblePrompt(validPreset(), { SUBJECT: 'a $& b', STYLE: 'photoreal' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.prompt.includes('a $& b')).toBe(true)
  })

  it('fails when a required field is missing', () => {
    const result = assemblePrompt(validPreset(), { STYLE: 'photoreal' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.code === 'missing_required' && e.field === 'SUBJECT')).toBe(true)
    }
  })

  it('fails when a required field is empty/whitespace', () => {
    const result = assemblePrompt(validPreset(), { SUBJECT: '   ', STYLE: 'photoreal' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.code === 'empty_required' && e.field === 'SUBJECT')).toBe(true)
    }
  })

  it('fails when a select value is not an allowed option', () => {
    const result = assemblePrompt(validPreset(), { SUBJECT: 'a red shoe', STYLE: 'neon' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.code === 'invalid_option' && e.field === 'STYLE')).toBe(true)
    }
  })

  it('fails on a template token that has no defined field', () => {
    const preset = { ...validPreset(), template: 'A {{SUBJECT}} in {{GHOST}} style.' }
    const result = assemblePrompt(preset, { SUBJECT: 'a red shoe', STYLE: 'photoreal' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.code === 'unknown_token' && e.token === 'GHOST')).toBe(true)
    }
  })
})
