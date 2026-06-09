import type { Preset, PresetConstraints } from '#shared/schemas/preset'
import { extractTokens } from '#shared/schemas/preset'

export type PromptAssemblyErrorCode =
  | 'missing_required'
  | 'empty_required'
  | 'invalid_option'
  | 'unknown_token'
  | 'unresolved_token'

export interface PromptAssemblyError {
  code: PromptAssemblyErrorCode
  field?: string
  token?: string
  message: string
}

export type PromptAssemblyResult =
  | { ok: true, prompt: string }
  | { ok: false, errors: PromptAssemblyError[] }

// FINAL_PROMPT = TEMPLATE_WITH_REPLACED_TOKENS + LOCKED_CONSTRAINT_SUFFIX
// per PRD §- prompt assembly contract; the suffix is appended even when empty
// so the formula holds (in that case it contributes the empty string).
export function assemblePrompt(
  preset: Preset,
  inputs: Record<string, string>,
): PromptAssemblyResult {
  const errors: PromptAssemblyError[] = []

  for (const field of preset.fields) {
    const value = inputs[field.key]
    if (field.required) {
      if (value === undefined) {
        errors.push({
          code: 'missing_required',
          field: field.key,
          message: `Required field "${field.label}" is missing.`,
        })
        continue
      }
      if (value.trim() === '') {
        errors.push({
          code: 'empty_required',
          field: field.key,
          message: `Required field "${field.label}" is empty.`,
        })
        continue
      }
    }
    if (
      field.type === 'select'
      && value !== undefined
      && value !== ''
      && !field.options.includes(value)
    ) {
      errors.push({
        code: 'invalid_option',
        field: field.key,
        message: `Value "${value}" for "${field.label}" is not one of the allowed options.`,
      })
    }
  }

  const knownKeys = new Set(preset.fields.map(f => f.key))
  for (const token of extractTokens(preset.template)) {
    if (!knownKeys.has(token)) {
      errors.push({
        code: 'unknown_token',
        token,
        message: `Template references {{${token}}} which is not a defined field.`,
      })
    }
  }

  if (errors.length > 0) return { ok: false, errors }

  let body = preset.template
  for (const field of preset.fields) {
    const raw = inputs[field.key] ?? ''
    const replacement = raw.trim()
    // Callback form avoids `$&`/`$$` patterns in user input being interpreted
    // as backreferences against the search string.
    body = body.replaceAll(`{{${field.key}}}`, () => replacement)
  }

  const leftover = extractTokens(body)
  if (leftover.length > 0) {
    return {
      ok: false,
      errors: leftover.map(token => ({
        code: 'unresolved_token' as const,
        token,
        message: `Token {{${token}}} was not resolved after substitution.`,
      })),
    }
  }

  return { ok: true, prompt: `${body}${buildConstraintSuffix(preset.constraints)}` }
}

function buildConstraintSuffix(constraints: PresetConstraints): string {
  const parts: string[] = []
  if (constraints.mustPreserve.length > 0) {
    parts.push(`Preserve: ${constraints.mustPreserve.join(', ')}.`)
  }
  if (constraints.allowedChanges.length > 0) {
    parts.push(`Allowed changes: ${constraints.allowedChanges.join(', ')}.`)
  }
  if (constraints.qualityRules.length > 0) {
    parts.push(`Quality rules: ${constraints.qualityRules.join(', ')}.`)
  }
  return parts.length === 0 ? '' : ` ${parts.join(' ')}`
}
