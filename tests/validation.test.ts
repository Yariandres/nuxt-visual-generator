import { describe, expect, it } from 'vitest'
import {
  fieldKeySchema,
  inputsSchema,
  presetIdSchema,
  projectIdSchema,
  sanitizeText,
} from '~~/server/utils/validation'

describe('presetIdSchema', () => {
  it('accepts a safe slug', () => {
    expect(presetIdSchema.safeParse('visual_scene_v1').success).toBe(true)
  })

  it.each([
    '../../etc/passwd',
    'a/b',
    'a.b',
    'a\\b',
    '',
    'has space',
  ])('rejects a path-traversal / malformed id: %s', (id) => {
    expect(presetIdSchema.safeParse(id).success).toBe(false)
  })
})

describe('fieldKeySchema', () => {
  it('accepts an uppercase key', () => {
    expect(fieldKeySchema.safeParse('SUBJECT').success).toBe(true)
  })

  it.each(['subject', 'A-B', '1ABC', ''])('rejects a malformed key: %s', (key) => {
    expect(fieldKeySchema.safeParse(key).success).toBe(false)
  })
})

describe('projectIdSchema', () => {
  it('accepts a non-empty id within length', () => {
    expect(projectIdSchema.safeParse('cmrd6tb610002ms4kl1iaon46').success).toBe(true)
  })

  it('rejects empty and over-long ids', () => {
    expect(projectIdSchema.safeParse('').success).toBe(false)
    expect(projectIdSchema.safeParse('x'.repeat(65)).success).toBe(false)
  })
})

describe('sanitizeText', () => {
  it('strips control characters but keeps tab/newline', () => {
    const input = `a${String.fromCharCode(0)}b${String.fromCharCode(7)}c\td\ne`
    expect(sanitizeText(input)).toBe('abc\td\ne')
  })

  it('trims surrounding whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello')
  })

  it('leaves ordinary text untouched', () => {
    expect(sanitizeText('A red $5 shoe — 100% cotton')).toBe('A red $5 shoe — 100% cotton')
  })
})

describe('inputsSchema', () => {
  it('accepts and sanitizes valid inputs', () => {
    const result = inputsSchema.safeParse({ SUBJECT: `  a shoe${String.fromCharCode(0)}  ` })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.SUBJECT).toBe('a shoe')
  })

  it('rejects keys that are not valid field keys', () => {
    expect(inputsSchema.safeParse({ 'bad-key': 'x' }).success).toBe(false)
  })

  it('rejects values over the length cap', () => {
    expect(inputsSchema.safeParse({ SUBJECT: 'x'.repeat(5001) }).success).toBe(false)
  })
})
