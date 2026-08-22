import { basename } from 'node:path'
import type { Storage } from 'unstorage'
import {
  presetSummary,
  validateAnyPreset,
  type AnyPreset,
  type PresetSummary,
  type PresetValidationError,
} from '#shared/schemas/preset'

// V1 dev-only: reads the repo's `engines/` `.rdt` files, bundled into the
// server output as the `assets:engines` server asset (see nuxt.config.ts) so
// they resolve in the Netlify serverless bundle too. The DB-backed `Preset`
// model (slug + version, JsonB definition) is the production source of truth;
// swap this loader to read from there before shipping (BL-039).
const PRESET_EXT = '.rdt'
// A preset id becomes a storage key; reject anything but a safe slug so a
// crafted id (e.g. `../../etc/passwd`) can never escape the engines mount.
// Routes also validate this, but the loader is the true sink so it guards too.
const SAFE_PRESET_ID = /^[A-Za-z0-9_]+$/

// Tests run as plain-node Vitest without a Nitro runtime, so they inject a
// filesystem-backed storage here. In dev/prod this stays undefined and the
// Nitro-provided `assets:engines` mount is used.
let enginesStorageOverride: Storage | undefined

export function _setEnginesStorageForTests(storage: Storage | undefined): void {
  enginesStorageOverride = storage
}

function enginesStorage(): Storage {
  return enginesStorageOverride ?? useStorage('assets:engines')
}

export interface PresetLoadError {
  file: string
  errors: PresetValidationError[]
}

export interface ListPresetsResult {
  presets: PresetSummary[]
  invalid: PresetLoadError[]
}

export type LoadPresetResult =
  | { ok: true, preset: AnyPreset }
  | { ok: false, reason: 'not_found' }
  | { ok: false, reason: 'invalid', errors: PresetValidationError[] }
  | { ok: false, reason: 'id_mismatch', expectedId: string, actualId: string }

export async function listPresets(): Promise<ListPresetsResult> {
  const keys = await listPresetKeys()
  const presets: PresetSummary[] = []
  const invalid: PresetLoadError[] = []

  for (const key of keys) {
    const expectedId = basename(key, PRESET_EXT)
    const result = await readAndValidate(key, expectedId)
    if (result.ok) {
      presets.push(presetSummary(result.preset))
      continue
    }
    invalid.push({
      file: key,
      errors:
        result.reason === 'invalid'
          ? result.errors
          : result.reason === 'id_mismatch'
            ? [{
                path: 'id',
                message: `key "${key}" implies id "${expectedId}" but preset.id is "${result.actualId}"`,
              }]
            : [{ path: '<root>', message: 'preset asset disappeared during listing' }],
    })
  }

  return { presets, invalid }
}

export async function loadPreset(id: string): Promise<LoadPresetResult> {
  if (!SAFE_PRESET_ID.test(id)) return { ok: false, reason: 'not_found' }
  return readAndValidate(`${id}${PRESET_EXT}`, id)
}

async function listPresetKeys(): Promise<string[]> {
  const keys = await enginesStorage().getKeys()
  return keys.filter(key => key.endsWith(PRESET_EXT))
}

async function readAndValidate(key: string, expectedId: string): Promise<LoadPresetResult> {
  // A `.rdt` asset can come back three ways depending on the driver: a raw
  // string (fs driver in dev), an already-parsed object (destr on a string),
  // or a `Uint8Array` of bytes (Nitro's bundled server assets in the Netlify
  // build). parseAndValidate normalizes all three. A missing key returns null.
  const raw = await enginesStorage().getItem(key)
  if (raw == null) return { ok: false, reason: 'not_found' }
  return parseAndValidate(raw, expectedId)
}

function parseAndValidate(raw: unknown, expectedId: string): LoadPresetResult {
  let parsed: unknown
  if (typeof raw === 'string' || raw instanceof Uint8Array || raw instanceof ArrayBuffer) {
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw)
    try {
      parsed = JSON.parse(text)
    } catch (err) {
      return {
        ok: false,
        reason: 'invalid',
        errors: [{ path: '<root>', message: `failed to parse JSON: ${(err as Error).message}` }],
      }
    }
  } else {
    parsed = raw
  }
  const result = validateAnyPreset(parsed)
  if (!result.ok) return { ok: false, reason: 'invalid', errors: result.errors }
  if (result.preset.id !== expectedId) {
    return {
      ok: false,
      reason: 'id_mismatch',
      expectedId,
      actualId: result.preset.id,
    }
  }
  return { ok: true, preset: result.preset }
}
