import { readdir, readFile } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'
import {
  presetSummary,
  validatePreset,
  type Preset,
  type PresetSummary,
  type PresetValidationError,
} from '#shared/schemas/preset'

// V1 dev-only: reads from the repo's `engines/` dir at runtime. The
// DB-backed `Preset` model (slug + version, JsonB definition) is the
// production source of truth; swap this loader to read from there before
// shipping. Do not rely on filesystem loading in prod.
const ENGINES_DIR = resolve(process.cwd(), 'engines')
const PRESET_EXT = '.rdt'

export interface PresetLoadError {
  file: string
  errors: PresetValidationError[]
}

export interface ListPresetsResult {
  presets: PresetSummary[]
  invalid: PresetLoadError[]
}

export type LoadPresetResult =
  | { ok: true, preset: Preset }
  | { ok: false, reason: 'not_found' }
  | { ok: false, reason: 'invalid', errors: PresetValidationError[] }
  | { ok: false, reason: 'id_mismatch', expectedId: string, actualId: string }

export async function listPresets(): Promise<ListPresetsResult> {
  const files = await listPresetFiles()
  const presets: PresetSummary[] = []
  const invalid: PresetLoadError[] = []

  for (const file of files) {
    const expectedId = basename(file, PRESET_EXT)
    const result = await readAndValidate(file, expectedId)
    if (result.ok) {
      presets.push(presetSummary(result.preset))
      continue
    }
    invalid.push({
      file,
      errors:
        result.reason === 'invalid'
          ? result.errors
          : result.reason === 'id_mismatch'
            ? [{
                path: 'id',
                message: `filename "${file}" implies id "${expectedId}" but preset.id is "${result.actualId}"`,
              }]
            : [{ path: '<root>', message: 'preset file disappeared during listing' }],
    })
  }

  return { presets, invalid }
}

export async function loadPreset(id: string): Promise<LoadPresetResult> {
  const file = `${id}${PRESET_EXT}`
  let raw: string
  try {
    raw = await readFile(resolve(ENGINES_DIR, file), 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ok: false, reason: 'not_found' }
    }
    throw err
  }
  return parseAndValidate(raw, id)
}

async function listPresetFiles(): Promise<string[]> {
  try {
    const entries = await readdir(ENGINES_DIR)
    return entries.filter(name => extname(name) === PRESET_EXT)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

async function readAndValidate(file: string, expectedId: string): Promise<LoadPresetResult> {
  let raw: string
  try {
    raw = await readFile(resolve(ENGINES_DIR, file), 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ok: false, reason: 'not_found' }
    }
    throw err
  }
  return parseAndValidate(raw, expectedId)
}

function parseAndValidate(raw: string, expectedId: string): LoadPresetResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    return {
      ok: false,
      reason: 'invalid',
      errors: [{ path: '<root>', message: `failed to parse JSON: ${(err as Error).message}` }],
    }
  }
  const result = validatePreset(parsed)
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
