import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { _setEnginesStorageForTests, loadPreset } from '~~/server/services/presets/loader'

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
