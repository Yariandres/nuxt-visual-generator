import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validatePresetV2, type PresetV2 } from '#shared/schemas/preset'
import { assemblePromptV2 } from '~~/server/services/prompt/assemble'

const ROOT = resolve(__dirname, '..')

function loadPresetV2(file: string): PresetV2 {
  const input = JSON.parse(readFileSync(resolve(ROOT, 'engines', file), 'utf8'))
  const result = validatePresetV2(input)
  if (!result.ok) throw new Error(`fixture ${file} is invalid: ${JSON.stringify(result.errors)}`)
  return result.preset
}

const packageEngine = () => loadPresetV2('package_visualization_engine.rdt')
const designEngine = () => loadPresetV2('visualisation_design_end.rdt')
const lifestyleEngine = () => loadPresetV2('lifestyle_from_set_engine.rdt')

describe('assemblePromptV2 — source resolution', () => {
  it('resolves engine blocks, field values, and default param fragments', () => {
    const result = assemblePromptV2(packageEngine(), { accentTheme: 'autumn leaves and warm tones' }, {})
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const { prompt } = result
    // engine block
    expect(prompt).toContain('Create a premium photorealistic advertising key visual')
    // field value
    expect(prompt).toContain('autumn leaves and warm tones')
    // param defaults: ratio 3:4, boxMode floating, lidMode absent, itemScaleBoost 10-15%, accentSystem on
    expect(prompt).toContain('composition optimized for a vertical 3:4 frame')
    expect(prompt).toContain('the box is floating in the air')
    expect(prompt).toContain('lid mode is absent')
    expect(prompt).toContain('visually enlarge items by approximately 10–15 percent')
    expect(prompt).toContain('include a minimal photorealistic supporting accent layer')
    // no tokens left behind
    expect(prompt).not.toMatch(/\{\{[A-Z0-9_]+\}\}/)
  })

  it('applies supplied param selections over defaults', () => {
    const result = assemblePromptV2(
      packageEngine(),
      { accentTheme: 'x' },
      { boxMode: 'grounded', accentSystemEnabled: false, ratio: '16:9' },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.prompt).toContain('the box is grounded and stable')
    expect(result.prompt).toContain('do not include any accent elements')
    expect(result.prompt).toContain('composition optimized for a wide horizontal frame')
    expect(result.prompt).not.toContain('the box is floating in the air')
  })

  it('uses the tokenMap fallback when a field value is missing', () => {
    const result = assemblePromptV2(packageEngine(), {}, {})
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.prompt).toContain('Accent style not provided.')
  })

  it('rejects a select param value that is not an allowed option', () => {
    const result = assemblePromptV2(packageEngine(), { accentTheme: 'x' }, { ratio: '2:1' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0].code).toBe('invalid_param_option')
    expect(result.errors[0].key).toBe('ratio')
  })

  it('assembles the lifestyle preset with checkbox + multi-select params', () => {
    const result = assemblePromptV2(
      lifestyleEngine(),
      { theme: 'welcome pack on a desk', mood: 'relaxed', lighting: 'soft daylight' },
      { peopleMode: 'hands', objectUsageMode: 'all', cameraStyle: 'dynamic', logoProvided: false },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.prompt).toContain('people may appear only as hands')
    expect(result.prompt).toContain('use all identifiable uploaded items exactly once')
    expect(result.prompt).toContain('more energetic but still believable photographic angle')
    // checkbox false branch
    expect(result.prompt).toContain('no dedicated logo file is provided')
    expect(result.prompt).not.toMatch(/\{\{[A-Z0-9_]+\}\}/)
  })
})

describe('assemblePromptV2 — computed colorBlock', () => {
  const fields = {
    theme: 'spring welcome pack',
    mood: 'airy and optimistic',
    lighting: 'soft diffused key light',
    colorPalette: 'pale ivory, soft sage',
  }

  it('emits the color section when includeColorBlock is on (default)', () => {
    const result = assemblePromptV2(designEngine(), fields, {})
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.prompt).toContain('COLOR PALETTE / COLOR DIRECTION:')
    expect(result.prompt).toContain('pale ivory, soft sage')
    expect(result.prompt).toContain('Use this palette as a directional guide')
  })

  it('omits the color section and leaves no blank-line gap when off', () => {
    const result = assemblePromptV2(designEngine(), fields, { includeColorBlock: false })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.prompt).not.toContain('COLOR PALETTE / COLOR DIRECTION')
    expect(result.prompt).not.toContain("Use this palette as a directional guide")
    // whitespace collapsed: never three-plus consecutive newlines
    expect(result.prompt).not.toMatch(/\n{3,}/)
  })
})

describe('assemblePromptV2 — guards', () => {
  it('reports an unknown token when the template references a token with no map entry', () => {
    const broken = {
      ...designEngine(),
      promptAssembly: { template: 'A {{GHOST}} token.' },
    } as PresetV2
    const result = assemblePromptV2(broken, {}, {})
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0].code).toBe('unknown_token')
    expect(result.errors[0].token).toBe('{{GHOST}}')
  })
})
