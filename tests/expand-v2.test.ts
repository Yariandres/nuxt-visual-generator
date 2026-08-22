import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { validatePresetV2, type PresetV2 } from '#shared/schemas/preset'
import type { TextExpansionAdapter, TextExpansionRequest } from '~~/server/services/ai/types'
import { expandField } from '~~/server/services/ai/expand'

const ROOT = resolve(__dirname, '..')

function designEngine(): PresetV2 {
  const input = JSON.parse(readFileSync(resolve(ROOT, 'engines', 'visualisation_design_end.rdt'), 'utf8'))
  const result = validatePresetV2(input)
  if (!result.ok) throw new Error('fixture invalid')
  return result.preset
}

function captureAdapter() {
  const calls: TextExpansionRequest[] = []
  const adapter: TextExpansionAdapter = {
    expand: vi.fn(async (req: TextExpansionRequest) => {
      calls.push(req)
      return { text: 'expanded', meta: { provider: 'openai', model: req.model ?? 'gpt-4.1-mini' }, usage: {} }
    }),
  }
  return { adapter, calls }
}

describe('expandField — v2 dynamicFields (BL-043)', () => {
  it('builds a v2 request with the field instruction, model, and sibling context', async () => {
    const { adapter, calls } = captureAdapter()
    const result = await expandField(adapter, designEngine(), 'theme', 'welcome pack', {
      theme: 'welcome pack',
      mood: 'airy and optimistic',
      lighting: 'soft key light',
      colorPalette: 'pale ivory',
    })
    expect(result.ok).toBe(true)
    const req = calls[0]!
    // per-field model + full instruction (v2 mode marker)
    expect(req.model).toBe('gpt-4.1-mini')
    expect(req.instruction).toContain('Expand only the THEME field')
    expect(req.includeFieldValue).toBe(true)
    // theme's contextFields are mood, colorPalette, lighting -> present, theme excluded
    expect(req.contextText).toContain('airy and optimistic')
    expect(req.contextText).toContain('pale ivory')
    expect(req.contextText).not.toContain('welcome pack')
  })

  it('omits empty sibling context values', async () => {
    const { adapter, calls } = captureAdapter()
    await expandField(adapter, designEngine(), 'theme', 'x', { theme: 'x', mood: '', lighting: 'soft', colorPalette: '' })
    const req = calls[0]!
    expect(req.contextText).toContain('soft')
    expect(req.contextText).not.toContain('Mood')
  })

  it('rejects a field without AI expansion enabled', async () => {
    // craft a preset whose field has aiEnabled:false
    const preset = designEngine()
    const noAi = { ...preset, dynamicFields: preset.dynamicFields.map(f => ({ ...f, aiEnabled: false })) } as PresetV2
    const { adapter } = captureAdapter()
    const result = await expandField(adapter, noAi, 'theme', 'x')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('field_not_expandable')
    expect(adapter.expand).not.toHaveBeenCalled()
  })

  it('rejects an unknown field', async () => {
    const { adapter } = captureAdapter()
    const result = await expandField(adapter, designEngine(), 'ghost', 'x')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('field_not_found')
    expect(adapter.expand).not.toHaveBeenCalled()
  })
})
