import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { _setEnginesStorageForTests, listPresets, loadPreset } from '~~/server/services/presets/loader'

// The loader reads presets through Nitro's `assets:engines` server-asset mount,
// which does not exist in plain-node Vitest. Point it at the real `engines/`
// dir via an unstorage fs driver so these tests exercise the same code path.
const enginesDir = resolve(fileURLToPath(new URL('..', import.meta.url)), 'engines')

beforeAll(() => {
  _setEnginesStorageForTests(createStorage({ driver: fsDriver({ base: enginesDir }) }))
})

afterAll(() => {
  _setEnginesStorageForTests(undefined)
})

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

// Nitro's bundled server assets (the Netlify build) return `getItem` as a
// Uint8Array of bytes, not a string — unlike the fs driver used above. This
// skew previously made prod report every preset as malformed. Reproduce the
// bytes driver so the loader's decode path stays covered.
describe('loadPreset with a bytes-backed (bundled) storage', () => {
  const bytes = new Uint8Array(readFileSync(resolve(enginesDir, 'visual_scene_v1.rdt')))

  beforeAll(() => {
    _setEnginesStorageForTests(createStorage({
      driver: {
        name: 'bundled-bytes',
        options: {},
        getKeys: async () => ['visual_scene_v1.rdt'],
        hasItem: async key => key === 'visual_scene_v1.rdt',
        getItem: async key => (key === 'visual_scene_v1.rdt' ? bytes : null),
      },
    }))
  })

  afterAll(() => {
    _setEnginesStorageForTests(createStorage({ driver: fsDriver({ base: enginesDir }) }))
  })

  it('loads a preset returned as raw bytes', async () => {
    const result = await loadPreset('visual_scene_v1')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.preset.id).toBe('visual_scene_v1')
  })

  it('lists presets returned as raw bytes', async () => {
    const { presets, invalid } = await listPresets()
    expect(invalid).toEqual([])
    expect(presets.map(p => p.id)).toContain('visual_scene_v1')
  })
})
