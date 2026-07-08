import type { Preset } from '#shared/schemas/preset'
import type {
  TextExpansionAdapter,
  TextExpansionUsage,
} from './types'

export type ExpansionErrorCode =
  | 'field_not_found'
  | 'wrong_field_type'
  | 'field_not_expandable'
  | 'provider_failure'

export interface ExpansionError {
  code: ExpansionErrorCode
  message: string
}

export type ExpandFieldResult =
  | {
    ok: true
    text: string
    provider: string
    model: string
    usage?: TextExpansionUsage
  }
  | { ok: false, error: ExpansionError }

// Orchestrates a field expansion: validates the field supports expansion on the
// given preset, then delegates the actual model call to the adapter. Keeps the
// `/api/expand` route thin (BL-020).
export async function expandField(
  adapter: TextExpansionAdapter,
  preset: Preset,
  fieldKey: string,
  value: string,
): Promise<ExpandFieldResult> {
  const field = preset.fields.find(f => f.key === fieldKey)
  if (!field) {
    return {
      ok: false,
      error: {
        code: 'field_not_found',
        message: `Field "${fieldKey}" does not exist on preset "${preset.id}".`,
      },
    }
  }
  if (field.type !== 'text') {
    return {
      ok: false,
      error: {
        code: 'wrong_field_type',
        message: `Field "${fieldKey}" is type "${field.type}"; only text fields support expansion.`,
      },
    }
  }
  if (!field.expand || !field.expand.enabled) {
    return {
      ok: false,
      error: {
        code: 'field_not_expandable',
        message: `Field "${fieldKey}" does not have expansion enabled.`,
      },
    }
  }

  try {
    const result = await adapter.expand({
      promptTemplate: field.expand.promptTemplate,
      value,
      constraints: preset.constraints,
    })
    return {
      ok: true,
      text: result.text,
      provider: result.meta.provider,
      model: result.meta.model,
      usage: result.usage,
    }
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'provider_failure',
        message: err instanceof Error ? err.message : 'Provider call failed.',
      },
    }
  }
}
