import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  detectPresetFormat,
  validateAnyPreset,
  validatePresetV2,
} from '#shared/schemas/preset'
import { validPresetInput } from './fixtures'

const ROOT = resolve(__dirname, '..')

// The three client-authored `.rdt` files currently live untracked in the repo
// root (they move into engines/ at BL-045). BL-040 must validate them as-is.
function loadClientRdt(file: string): unknown {
  return JSON.parse(readFileSync(resolve(ROOT, file), 'utf8'))
}

const CLIENT_FILES = [
  'package_visualization_engine.rdt',
  'visualisation_design_end.rdt',
  'foto_lifestyle_from_set.rdt',
]

// A minimal well-formed v2 preset used as a base for negative cases.
function validV2Input() {
  return {
    id: 'sample_engine',
    label: 'Sample Engine',
    version: '2.0.0',
    engineBlocks: { intent: 'Locked intent block.' },
    dynamicFields: [
      {
        key: 'theme',
        label: 'Theme',
        type: 'textarea',
        aiEnabled: true,
        aiExpansion: {
          model: 'gpt-4.1-mini',
          instruction: 'Expand the theme.',
          includeFieldValue: true,
          contextFields: [],
        },
      },
    ],
    specialParams: [
      {
        key: 'ratio',
        label: 'Ratio',
        type: 'select',
        default: '1:1',
        options: [
          { value: '1:1', label: '1:1', prompt: 'square framing' },
          { value: '9:16', label: '9:16', prompt: 'tall framing' },
        ],
      },
    ],
    promptAssembly: {
      template: 'INTENT:\n\n{{INTENT}}\n\nTHEME:\n\n{{THEME}}\n\nFORMAT:\n\n{{ASPECT_RULES}}',
    },
    tokenMap: {
      '{{INTENT}}': { source: 'engine', key: 'intent' },
      '{{THEME}}': { source: 'field', key: 'theme', fallback: 'No theme.' },
      '{{ASPECT_RULES}}': { source: 'param', key: 'ratio', mode: 'prompt' },
    },
  }
}

describe('validatePresetV2 — real client presets', () => {
  it.each(CLIENT_FILES)('validates %s', (file) => {
    const input = loadClientRdt(file)
    expect(detectPresetFormat(input)).toBe('v2')
    const result = validateAnyPreset(input)
    if (!result.ok) console.error(file, result.errors)
    expect(result.ok).toBe(true)
    expect(result.ok && result.format).toBe('v2')
  })

  it('normalizes coreFiles into engineBlocks', () => {
    const result = validatePresetV2(loadClientRdt('visualisation_design_end.rdt'))
    expect(result.ok).toBe(true)
    if (result.ok) {
      // coreFiles is folded away; its keys are reachable via engineBlocks.
      expect('coreFiles' in result.preset).toBe(false)
      expect(result.preset.engineBlocks.subjectLock).toBeDefined()
      expect(result.preset.engineBlocks.outputStyle).toBeDefined()
    }
  })
})

describe('format discrimination', () => {
  it('routes a V1 preset to the v1 schema', () => {
    expect(detectPresetFormat(validPresetInput())).toBe('v1')
    const result = validateAnyPreset(validPresetInput())
    expect(result.ok && result.format).toBe('v1')
  })

  it('routes a v2 preset to the v2 schema', () => {
    expect(detectPresetFormat(validV2Input())).toBe('v2')
    const result = validateAnyPreset(validV2Input())
    expect(result.ok && result.format).toBe('v2')
  })
})

describe('validatePresetV2 — cross-validation', () => {
  it('accepts the minimal valid v2 preset', () => {
    expect(validatePresetV2(validV2Input()).ok).toBe(true)
  })

  it('rejects a template token with no tokenMap entry', () => {
    const input = validV2Input()
    input.promptAssembly.template += '\n\n{{GHOST}}'
    const result = validatePresetV2(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some(e => e.message.includes('GHOST'))).toBe(true)
  })

  it('rejects a field-source token referencing an unknown field', () => {
    const input = validV2Input()
    input.tokenMap['{{THEME}}'] = { source: 'field', key: 'nope', fallback: 'x' }
    const result = validatePresetV2(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some(e => e.message.includes('nope'))).toBe(true)
  })

  it('rejects an engine-source token referencing an unknown block', () => {
    const input = validV2Input()
    input.tokenMap['{{INTENT}}'] = { source: 'engine', key: 'missingBlock' }
    const result = validatePresetV2(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some(e => e.message.includes('missingBlock'))).toBe(true)
  })

  it('rejects a param-source token referencing an unknown param', () => {
    const input = validV2Input()
    input.tokenMap['{{ASPECT_RULES}}'] = { source: 'param', key: 'nope', mode: 'prompt' }
    const result = validatePresetV2(input)
    expect(result.ok).toBe(false)
  })

  it('rejects a non-whitelisted computed key', () => {
    const input = validV2Input()
    input.promptAssembly.template += '\n\n{{X}}'
    // @ts-expect-error intentionally invalid computed key for the test
    input.tokenMap['{{X}}'] = { source: 'computed', key: 'notColorBlock' }
    const result = validatePresetV2(input)
    expect(result.ok).toBe(false)
  })

  it('requires colorPalette + includeColorBlock when computed colorBlock is used', () => {
    const input = validV2Input()
    input.promptAssembly.template += '\n\n{{COLOR_BLOCK}}'
    input.tokenMap['{{COLOR_BLOCK}}'] = { source: 'computed', key: 'colorBlock' }
    const result = validatePresetV2(input)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.message.includes('colorPalette'))).toBe(true)
      expect(result.errors.some(e => e.message.includes('includeColorBlock'))).toBe(true)
    }
  })

  it('rejects a duplicate dynamicField key', () => {
    const input = validV2Input()
    input.dynamicFields.push({ ...input.dynamicFields[0] })
    expect(validatePresetV2(input).ok).toBe(false)
  })

  it('rejects a select param default not among its options', () => {
    const input = validV2Input()
    input.specialParams[0].default = 'not-an-option'
    expect(validatePresetV2(input).ok).toBe(false)
  })

  it('rejects aiEnabled without aiExpansion config', () => {
    const input = validV2Input()
    input.dynamicFields[0].aiEnabled = true
    delete (input.dynamicFields[0] as Record<string, unknown>).aiExpansion
    expect(validatePresetV2(input).ok).toBe(false)
  })

  it('rejects a contextField that is not a declared field', () => {
    const input = validV2Input()
    input.dynamicFields[0].aiExpansion.contextFields = ['ghostField']
    const result = validatePresetV2(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some(e => e.message.includes('ghostField'))).toBe(true)
  })
})
