import { describe, expect, it } from 'vitest'
import { loadPreset } from '~~/server/services/presets/loader'

describe('loadPreset path-traversal guard', () => {
  it.each([
    '../../etc/passwd',
    'a/b',
    'a.b',
    '..%2f..%2fetc',
  ])('returns not_found for a malformed id without touching the filesystem: %s', async (id) => {
    const result = await loadPreset(id)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('not_found')
  })

  it('still loads a valid local preset', async () => {
    const result = await loadPreset('visual_scene_v1')
    expect(result.ok).toBe(true)
  })
})
