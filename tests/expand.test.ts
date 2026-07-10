import { describe, expect, it, vi } from 'vitest'
import type { Preset } from '#shared/schemas/preset'
import type { TextExpansionAdapter } from '~~/server/services/ai/types'
import { expandField } from '~~/server/services/ai/expand'
import { validPreset } from './fixtures'

function successAdapter(): TextExpansionAdapter {
  return {
    expand: vi.fn(async () => ({
      text: 'expanded text',
      meta: { provider: 'openai', model: 'gpt-4o-mini' },
      usage: { promptTokens: 10, completionTokens: 20 },
    })),
  }
}

function throwingAdapter(): TextExpansionAdapter {
  return { expand: vi.fn(async () => { throw new Error('boom') }) }
}

describe('expandField', () => {
  it('expands a supported text field and returns provider/model from meta', async () => {
    const adapter = successAdapter()
    const result = await expandField(adapter, validPreset(), 'SUBJECT', 'a shoe')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.text).toBe('expanded text')
      expect(result.provider).toBe('openai')
      expect(result.model).toBe('gpt-4o-mini')
    }
    expect(adapter.expand).toHaveBeenCalledWith(
      expect.objectContaining({ promptTemplate: 'Expand: {{value}}', value: 'a shoe' }),
    )
  })

  it('rejects a field that does not exist without calling the adapter', async () => {
    const adapter = successAdapter()
    const result = await expandField(adapter, validPreset(), 'NOPE', 'x')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('field_not_found')
    expect(adapter.expand).not.toHaveBeenCalled()
  })

  it('rejects a non-text (select) field', async () => {
    const adapter = successAdapter()
    const result = await expandField(adapter, validPreset(), 'STYLE', 'x')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('wrong_field_type')
    expect(adapter.expand).not.toHaveBeenCalled()
  })

  it('rejects a text field without expansion enabled', async () => {
    const preset = {
      ...validPreset(),
      template: 'A {{PLAIN}} thing.',
      fields: [{ key: 'PLAIN', label: 'Plain', type: 'text', required: true }],
    } as unknown as Preset
    const adapter = successAdapter()
    const result = await expandField(adapter, preset, 'PLAIN', 'x')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('field_not_expandable')
    expect(adapter.expand).not.toHaveBeenCalled()
  })

  it('maps an adapter failure to provider_failure', async () => {
    const result = await expandField(throwingAdapter(), validPreset(), 'SUBJECT', 'a shoe')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('provider_failure')
  })
})
