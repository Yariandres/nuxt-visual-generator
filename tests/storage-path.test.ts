import { describe, expect, it } from 'vitest'
import { buildObjectPath, extForMimeType, normalizeExt } from '~~/server/services/storage/path'

describe('buildObjectPath', () => {
  it('follows the PRD object-path convention', () => {
    const path = buildObjectPath({ userId: 'u1', projectId: 'p1', generationId: 'g1', ext: 'png' })
    expect(path).toBe('user/u1/project/p1/generation/g1.png')
  })

  it('uses the _none segment when the generation has no project', () => {
    const path = buildObjectPath({ userId: 'u1', projectId: null, generationId: 'g1', ext: 'png' })
    expect(path).toBe('user/u1/project/_none/generation/g1.png')
  })

  it('normalizes the extension (strips leading dot, lowercases)', () => {
    const path = buildObjectPath({ userId: 'u1', generationId: 'g1', ext: '.PNG' })
    expect(path).toBe('user/u1/project/_none/generation/g1.png')
  })
})

describe('normalizeExt', () => {
  it('strips a leading dot and lowercases', () => {
    expect(normalizeExt('.JPG')).toBe('jpg')
  })

  it('throws on an empty extension', () => {
    expect(() => normalizeExt('   ')).toThrow()
  })
})

describe('extForMimeType', () => {
  it('maps known image mime types', () => {
    expect(extForMimeType('image/png')).toBe('png')
    expect(extForMimeType('image/jpeg')).toBe('jpg')
    expect(extForMimeType('image/webp')).toBe('webp')
  })

  it('is case-insensitive', () => {
    expect(extForMimeType('IMAGE/PNG')).toBe('png')
  })

  it('throws on an unsupported mime type', () => {
    expect(() => extForMimeType('image/tiff')).toThrow()
  })
})
