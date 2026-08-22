import type {
  Preset,
  PresetConstraints,
  PresetV2,
  PresetV2SpecialParam,
  PresetV2TextareaField,
} from '#shared/schemas/preset'
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

// ---------------------------------------------------------------------------
// Engine v2 — tokenMap prompt assembly (BL-041).
//
// A v2 preset's `promptAssembly.template` is a master string of `{{TOKEN}}`s;
// each token is resolved through `tokenMap` from one of five sources:
//   core / engine → a locked block string (both read the normalized engineBlocks)
//   field         → a dynamicField value, else the resolver's `fallback`
//   param         → the selected select-option / checkbox-branch `prompt` fragment
//   computed      → engine-side logic (only `colorBlock`)
// The schema (BL-040) already cross-validates the wiring, but this assembler is
// the real sink so it re-guards and reports actionable errors.
// ---------------------------------------------------------------------------

export type PromptAssemblyV2ErrorCode =
  | 'unknown_token'
  | 'unknown_block'
  | 'unknown_field'
  | 'unknown_param'
  | 'invalid_param_option'
  | 'unresolved_token'

export interface PromptAssemblyV2Error {
  code: PromptAssemblyV2ErrorCode
  token?: string
  key?: string
  message: string
}

export type PromptAssemblyV2Result =
  | { ok: true, prompt: string }
  | { ok: false, errors: PromptAssemblyV2Error[] }

// select params resolve to a string value; checkbox params to a boolean. A
// missing entry falls back to the param's own `default`.
export type ParamValue = string | boolean
export type ParamValues = Record<string, ParamValue | undefined>
export type FieldValues = Record<string, string | undefined>

// Resolve the prompt fragment a param contributes. Returns the param's default
// branch when the caller supplied no value. A select value that isn't one of the
// declared options is a hard error (server-side option validation).
function resolveParamFragment(
  param: PresetV2SpecialParam,
  values: ParamValues,
): { ok: true, fragment: string } | { ok: false, error: PromptAssemblyV2Error } {
  const supplied = values[param.key]
  if (param.type === 'checkbox') {
    const on = typeof supplied === 'boolean' ? supplied : supplied === undefined ? param.default : supplied === 'true'
    return { ok: true, fragment: on ? param.true.prompt : param.false.prompt }
  }
  // select
  const value = supplied === undefined ? param.default : String(supplied)
  const option = param.options.find(o => o.value === value)
  if (!option) {
    return {
      ok: false,
      error: {
        code: 'invalid_param_option',
        key: param.key,
        message: `Value "${value}" for param "${param.label}" is not one of the allowed options.`,
      },
    }
  }
  return { ok: true, fragment: option.prompt }
}

// The one computed token: when the `includeColorBlock` checkbox is on, emit a
// color-palette section built from the `colorPalette` field (using its optional
// promptBlock for the section title + instructions); otherwise emit nothing.
function resolveColorBlock(
  preset: PresetV2,
  fields: FieldValues,
  params: ParamValues,
): string {
  const toggle = preset.specialParams.find(
    (p): p is Extract<PresetV2SpecialParam, { type: 'checkbox' }> =>
      p.key === 'includeColorBlock' && p.type === 'checkbox',
  )
  const on = toggle
    ? (() => {
        const supplied = params[toggle.key]
        return typeof supplied === 'boolean' ? supplied : supplied === undefined ? toggle.default : supplied === 'true'
      })()
    : false
  if (!on) return ''

  const field = preset.dynamicFields.find(
    (f): f is PresetV2TextareaField => f.key === 'colorPalette',
  )
  const value = (fields.colorPalette ?? '').trim()
  const title = field?.promptBlock?.title ?? 'COLOR PALETTE'
  const instructions = field?.promptBlock?.instructions ?? ''

  const parts = [`${title}:`]
  if (value) parts.push(value)
  if (instructions) parts.push(instructions)
  return parts.join('\n\n')
}

export function assemblePromptV2(
  preset: PresetV2,
  fields: FieldValues,
  params: ParamValues = {},
): PromptAssemblyV2Result {
  const errors: PromptAssemblyV2Error[] = []
  const fieldKeys = new Set(preset.dynamicFields.map(f => f.key))
  const paramByKey = new Map(preset.specialParams.map(p => [p.key, p]))
  const replacements = new Map<string, string>()

  for (const bareToken of extractTokens(preset.promptAssembly.template)) {
    const token = `{{${bareToken}}}`
    if (replacements.has(token)) continue
    const resolver = preset.tokenMap[token]
    if (!resolver) {
      errors.push({ code: 'unknown_token', token, message: `Template references ${token} which has no tokenMap entry.` })
      continue
    }

    switch (resolver.source) {
      case 'core':
      case 'engine': {
        const block = preset.engineBlocks[resolver.key]
        if (block === undefined) {
          if (resolver.fallback !== undefined) {
            replacements.set(token, resolver.fallback)
          } else {
            errors.push({ code: 'unknown_block', token, key: resolver.key, message: `${token}: block "${resolver.key}" is not defined in engineBlocks.` })
          }
        } else {
          replacements.set(token, block)
        }
        break
      }
      case 'field': {
        if (!fieldKeys.has(resolver.key)) {
          errors.push({ code: 'unknown_field', token, key: resolver.key, message: `${token}: field "${resolver.key}" is not a declared dynamicField.` })
          break
        }
        const value = (fields[resolver.key] ?? '').trim()
        replacements.set(token, value !== '' ? value : (resolver.fallback ?? ''))
        break
      }
      case 'param': {
        const param = paramByKey.get(resolver.key)
        if (!param) {
          errors.push({ code: 'unknown_param', token, key: resolver.key, message: `${token}: param "${resolver.key}" is not a declared specialParam.` })
          break
        }
        const resolved = resolveParamFragment(param, params)
        if (resolved.ok) replacements.set(token, resolved.fragment)
        else errors.push({ ...resolved.error, token })
        break
      }
      case 'computed': {
        // `key` is whitelisted to `colorBlock` by the schema.
        replacements.set(token, resolveColorBlock(preset, fields, params))
        break
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors }

  // Callback form keeps `$&`/`$$` in resolved content from being read as
  // replacement patterns.
  let body = preset.promptAssembly.template
  for (const [token, value] of replacements) {
    body = body.replaceAll(token, () => value)
  }

  const leftover = extractTokens(body)
  if (leftover.length > 0) {
    return {
      ok: false,
      errors: leftover.map(bareToken => ({
        code: 'unresolved_token' as const,
        token: `{{${bareToken}}}`,
        message: `Token {{${bareToken}}} was not resolved after substitution.`,
      })),
    }
  }

  // Empty computed/field resolutions can leave runs of blank lines (e.g. a
  // hidden colorBlock between two `---` rules); collapse them so the persisted
  // prompt stays clean and deterministic.
  const prompt = body.replace(/\n{3,}/g, '\n\n').trim()
  return { ok: true, prompt }
}
