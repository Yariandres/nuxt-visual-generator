import type { AnyPreset } from '#shared/schemas/preset'
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
// given preset (V1 or v2), then delegates the actual model call to the adapter.
// Keeps the `/api/expand` route thin (BL-020, BL-043). `inputs` carries the full
// field-value map so v2 can assemble sibling-field context.
export async function expandField(
  adapter: TextExpansionAdapter,
  preset: AnyPreset,
  fieldKey: string,
  value: string,
  inputs: Record<string, string> = {},
): Promise<ExpandFieldResult> {
  const req = 'fields' in preset
    ? buildV1Request(preset, fieldKey, value)
    : buildV2Request(preset, fieldKey, value, inputs)
  if (!req.ok) return req

  try {
    const result = await adapter.expand(req.request)
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

type BuildRequestResult =
  | { ok: true, request: Parameters<TextExpansionAdapter['expand']>[0] }
  | { ok: false, error: ExpansionError }

function buildV1Request(
  preset: Extract<AnyPreset, { fields: unknown }>,
  fieldKey: string,
  value: string,
): BuildRequestResult {
  const field = preset.fields.find(f => f.key === fieldKey)
  if (!field) {
    return { ok: false, error: { code: 'field_not_found', message: `Field "${fieldKey}" does not exist on preset "${preset.id}".` } }
  }
  if (field.type !== 'text') {
    return { ok: false, error: { code: 'wrong_field_type', message: `Field "${fieldKey}" is type "${field.type}"; only text fields support expansion.` } }
  }
  if (!field.expand || !field.expand.enabled) {
    return { ok: false, error: { code: 'field_not_expandable', message: `Field "${fieldKey}" does not have expansion enabled.` } }
  }
  return { ok: true, request: { promptTemplate: field.expand.promptTemplate, value, constraints: preset.constraints } }
}

function buildV2Request(
  preset: Extract<AnyPreset, { dynamicFields: unknown }>,
  fieldKey: string,
  value: string,
  inputs: Record<string, string>,
): BuildRequestResult {
  const field = preset.dynamicFields.find(f => f.key === fieldKey)
  if (!field) {
    return { ok: false, error: { code: 'field_not_found', message: `Field "${fieldKey}" does not exist on preset "${preset.id}".` } }
  }
  if (!field.aiEnabled || !field.aiExpansion) {
    return { ok: false, error: { code: 'field_not_expandable', message: `Field "${fieldKey}" does not have AI expansion enabled.` } }
  }
  const cfg = field.aiExpansion
  const contextText = buildContextText(preset, cfg.contextFields, inputs)
  return {
    ok: true,
    request: {
      value,
      instruction: cfg.instruction,
      includeFieldValue: cfg.includeFieldValue,
      contextText: contextText || undefined,
      model: cfg.model,
    },
  }
}

// Build a readable "LABEL: value" context block from the sibling fields named in
// `contextFields`, skipping any that are empty.
function buildContextText(
  preset: Extract<AnyPreset, { dynamicFields: unknown }>,
  contextFields: string[],
  inputs: Record<string, string>,
): string {
  const parts: string[] = []
  for (const key of contextFields) {
    const value = inputs[key]?.trim()
    if (!value) continue
    const label = preset.dynamicFields.find(f => f.key === key)?.label ?? key
    parts.push(`${label}: ${value}`)
  }
  return parts.join('\n')
}
