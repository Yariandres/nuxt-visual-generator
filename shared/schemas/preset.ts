import { z } from 'zod'

const FIELD_KEY_RE = /^[A-Z][A-Z0-9_]*$/
const TOKEN_RE = /\{\{([A-Z][A-Z0-9_]*)\}\}/g
const ASPECT_RATIO_RE = /^\d+:\d+$/
const VALUE_PLACEHOLDER = '{{value}}'

const expandConfigSchema = z.object({
  enabled: z.boolean(),
  promptTemplate: z
    .string()
    .min(1)
    .refine(v => v.includes(VALUE_PLACEHOLDER), {
      message: 'expand.promptTemplate must contain the literal "{{value}}" placeholder',
    }),
})

const textFieldSchema = z.object({
  key: z.string().regex(FIELD_KEY_RE, 'field key must match /^[A-Z][A-Z0-9_]*$/'),
  label: z.string().min(1),
  type: z.literal('text'),
  required: z.boolean(),
  default: z.string().optional(),
  expand: expandConfigSchema.optional(),
})

// Strict so a stray `expand` block on a select is rejected -- expansion
// only makes sense for free-text inputs.
const selectFieldSchema = z
  .object({
    key: z.string().regex(FIELD_KEY_RE, 'field key must match /^[A-Z][A-Z0-9_]*$/'),
    label: z.string().min(1),
    type: z.literal('select'),
    required: z.boolean(),
    options: z
      .array(z.string().min(1))
      .min(1, 'select fields require at least one non-empty option'),
    default: z.string().optional(),
  })
  .strict()

const fieldSchema = z.discriminatedUnion('type', [textFieldSchema, selectFieldSchema])

const presetConstraintsSchema = z.object({
  mustPreserve: z.array(z.string().min(1)),
  allowedChanges: z.array(z.string().min(1)),
  qualityRules: z.array(z.string().min(1)),
})

const presetOutputSchema = z.object({
  type: z.literal('image'),
  defaultAspectRatio: z
    .string()
    .regex(ASPECT_RATIO_RE, 'defaultAspectRatio must match /^\\d+:\\d+$/'),
})

// Cross-cutting checks only fire once every leaf schema passes -- callers
// will see leaf errors first and these only after the leaves are valid.
export const presetSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.string().min(1),
    template: z.string().min(1),
    fields: z.array(fieldSchema).min(1),
    constraints: presetConstraintsSchema,
    output: presetOutputSchema,
  })
  .superRefine((preset, ctx) => {
    const seen = new Set<string>()
    preset.fields.forEach((f, i) => {
      if (seen.has(f.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fields', i, 'key'],
          message: `duplicate field key "${f.key}"`,
        })
      }
      seen.add(f.key)
    })

    const tokens = extractTokens(preset.template)
    const tokenSet = new Set(tokens)
    const keySet = new Set(preset.fields.map(f => f.key))

    tokens.forEach((tok) => {
      if (!keySet.has(tok)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['template'],
          message: `template references {{${tok}}} but no field has key "${tok}"`,
        })
      }
    })

    preset.fields.forEach((f, i) => {
      if (!tokenSet.has(f.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fields', i, 'key'],
          message: `field "${f.key}" is declared but never referenced as {{${f.key}}} in template`,
        })
      }
      if (f.type === 'select' && f.default !== undefined && !f.options.includes(f.default)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fields', i, 'default'],
          message: `default "${f.default}" must be one of field options`,
        })
      }
    })
  })

export function extractTokens(template: string): string[] {
  const tokens: string[] = []
  for (const match of template.matchAll(TOKEN_RE)) {
    tokens.push(match[1])
  }
  return tokens
}

// z.infer outputs are `type` aliases by construction; rewriting them as
// `interface` would either duplicate the schema or break discriminated-union
// narrowing. Hand-written interfaces are reserved for non-schema-backed shapes
// (PresetValidationError below).
export type Preset = z.infer<typeof presetSchema>
export type PresetField = z.infer<typeof fieldSchema>
export type PresetTextField = z.infer<typeof textFieldSchema>
export type PresetSelectField = z.infer<typeof selectFieldSchema>
export type PresetExpandConfig = z.infer<typeof expandConfigSchema>
export type PresetConstraints = z.infer<typeof presetConstraintsSchema>
export type PresetOutput = z.infer<typeof presetOutputSchema>

export interface PresetValidationError {
  path: string
  message: string
}

export type PresetValidationResult =
  | { ok: true, preset: Preset }
  | { ok: false, errors: PresetValidationError[] }

function mapIssues(error: z.ZodError): PresetValidationError[] {
  return error.issues.map<PresetValidationError>(issue => ({
    path: issue.path.length === 0 ? '<root>' : issue.path.join('.'),
    message: issue.message,
  }))
}

export function validatePreset(input: unknown): PresetValidationResult {
  const result = presetSchema.safeParse(input)
  if (result.success) return { ok: true, preset: result.data }
  return { ok: false, errors: mapIssues(result.error) }
}

export interface PresetSummary {
  id: string
  name: string
  version: string
}

// Accepts either format: V1 carries `name`, v2 carries `label`. Callers that
// only ever pass V1 presets are unaffected.
export function presetSummary(preset: AnyPreset): PresetSummary {
  const name = 'name' in preset ? preset.name : preset.label
  return { id: preset.id, name, version: preset.version }
}

// ---------------------------------------------------------------------------
// Engine v2 — the client's token-resolution `.rdt` format (BL-040).
//
// Unlike V1 (one `template` + flat `fields[]`), a v2 preset is a master
// template whose every `{{TOKEN}}` is filled from a named source via `tokenMap`:
// a locked block (`engineBlocks`/`coreFiles`), a user field, a param's prompt
// fragment, or whitelisted computed logic. See docs/engine-v2-plan.md.
// ---------------------------------------------------------------------------

// v2 keys (fields, params, block names) are camelCase identifiers -- decoupled
// from the ALL_CAPS `{{TOKEN}}`s, which are wired to keys through `tokenMap`.
const V2_KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/
// A `tokenMap` key is the literal token *including* its braces, e.g.
// "{{ENGINE_INTENT}}"; the inner name follows the V1 token convention.
const TOKENMAP_KEY_RE = /^\{\{[A-Z][A-Z0-9_]*\}\}$/
// Preset id stays a safe slug (also enforced by the loader as the storage-key
// sink); the filename/id match is checked at load time.
const SAFE_PRESET_ID_RE = /^[A-Za-z0-9_]+$/

// Computed tokens run engine-side logic rather than reading a stored value. The
// set is deliberately whitelisted (client-confirmed: `colorBlock` is the only
// one); an unknown `computed` key is a validation error, not a silent no-op.
export const COMPUTED_TOKEN_KEYS = ['colorBlock'] as const

const v2KeySchema = z.string().regex(V2_KEY_RE, 'key must match /^[a-zA-Z][a-zA-Z0-9_]*$/')

const aiExpansionSchema = z.object({
  model: z.string().min(1),
  instruction: z.string().min(1),
  includeFieldValue: z.boolean(),
  contextFields: z.array(z.string().min(1)),
})

// Optional per-field output block (seen on `colorPalette`): section title +
// static instructions the assembler can wrap the field value in.
const promptBlockSchema = z.object({
  title: z.string().min(1),
  instructions: z.string().min(1),
})

const textareaFieldSchema = z.object({
  key: v2KeySchema,
  label: z.string().min(1),
  type: z.literal('textarea'),
  placeholder: z.string().optional(),
  aiEnabled: z.boolean(),
  aiExpansion: aiExpansionSchema.optional(),
  promptBlock: promptBlockSchema.optional(),
})

// Single-member union today; kept as a discriminatedUnion so slider/multiselect
// field types can be added later without reshaping the schema.
const dynamicFieldSchema = z.discriminatedUnion('type', [textareaFieldSchema])

const selectOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  // Each option injects its own prompt fragment when selected -- the core of
  // the v2 params model (V1 select options were plain strings).
  prompt: z.string().min(1),
})

const selectParamSchema = z.object({
  key: v2KeySchema,
  label: z.string().min(1),
  type: z.literal('select'),
  default: z.string().min(1),
  options: z.array(selectOptionSchema).min(1, 'select params require at least one option'),
})

const checkboxBranchSchema = z.object({ prompt: z.string().min(1) })

const checkboxParamSchema = z.object({
  key: v2KeySchema,
  label: z.string().min(1),
  type: z.literal('checkbox'),
  default: z.boolean(),
  checkboxLabel: z.string().min(1),
  true: checkboxBranchSchema,
  false: checkboxBranchSchema,
})

// Only `select` + `checkbox` for v2 (client-confirmed); union left open for
// future param types.
const specialParamSchema = z.discriminatedUnion('type', [selectParamSchema, checkboxParamSchema])

const tokenResolverSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('core'), key: z.string().min(1), fallback: z.string().optional() }),
  z.object({ source: z.literal('engine'), key: z.string().min(1), fallback: z.string().optional() }),
  z.object({ source: z.literal('field'), key: z.string().min(1), fallback: z.string().optional() }),
  z.object({
    source: z.literal('param'),
    key: z.string().min(1),
    fallback: z.string().optional(),
    mode: z.literal('prompt').optional(),
  }),
  // `key` is whitelisted at the leaf: an unknown computed key fails here.
  z.object({ source: z.literal('computed'), key: z.enum(COMPUTED_TOKEN_KEYS) }),
])

// Locked rule blocks: `key -> string`. The string is the block content (or, in
// one client file, a path the assembler resolves) -- either is a string here.
const blockRecordSchema = z.record(z.string(), z.string())

const presetV2Base = z.object({
  id: z.string().regex(SAFE_PRESET_ID_RE, 'id must match /^[A-Za-z0-9_]+$/'),
  label: z.string().min(1),
  version: z.string().min(1),
  // `engineBlocks` is canonical; `coreFiles` is an accepted alias, merged into
  // `engineBlocks` on load (see normalizeV2). At least the referenced keys must
  // exist -- cross-validation below enforces that.
  engineBlocks: blockRecordSchema.optional(),
  coreFiles: blockRecordSchema.optional(),
  dynamicFields: z.array(dynamicFieldSchema),
  specialParams: z.array(specialParamSchema),
  promptAssembly: z.object({ template: z.string().min(1) }),
  tokenMap: z.record(
    z.string().regex(TOKENMAP_KEY_RE, 'tokenMap key must be a token including braces, e.g. {{ENGINE_INTENT}}'),
    tokenResolverSchema,
  ),
})

function mergedBlocks(p: z.infer<typeof presetV2Base>): Record<string, string> {
  return { ...(p.coreFiles ?? {}), ...(p.engineBlocks ?? {}) }
}

// Canonical output shape: `coreFiles` folded into `engineBlocks`, which is then
// always present.
function normalizeV2(p: z.infer<typeof presetV2Base>) {
  const { coreFiles: _coreFiles, engineBlocks: _engineBlocks, ...rest } = p
  return { ...rest, engineBlocks: mergedBlocks(p) }
}

export const presetV2Schema = presetV2Base
  .superRefine((preset, ctx) => {
    const blocks = mergedBlocks(preset)

    const fieldKeys = new Set<string>()
    preset.dynamicFields.forEach((f, i) => {
      if (fieldKeys.has(f.key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dynamicFields', i, 'key'], message: `duplicate dynamicField key "${f.key}"` })
      }
      fieldKeys.add(f.key)
      if (f.aiEnabled && !f.aiExpansion) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dynamicFields', i, 'aiExpansion'], message: `field "${f.key}" has aiEnabled:true but no aiExpansion config` })
      }
    })

    // contextFields must reference other declared dynamicFields.
    preset.dynamicFields.forEach((f, i) => {
      f.aiExpansion?.contextFields.forEach((cf, ci) => {
        if (!fieldKeys.has(cf)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dynamicFields', i, 'aiExpansion', 'contextFields', ci], message: `contextField "${cf}" is not a declared dynamicField key` })
        }
      })
    })

    const paramKeys = new Set<string>()
    preset.specialParams.forEach((p, i) => {
      if (paramKeys.has(p.key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['specialParams', i, 'key'], message: `duplicate specialParam key "${p.key}"` })
      }
      paramKeys.add(p.key)
      if (p.type === 'select' && !p.options.some(o => o.value === p.default)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['specialParams', i, 'default'], message: `default "${p.default}" must be one of the option values` })
      }
    })

    // Every `{{TOKEN}}` in the template must have a tokenMap entry.
    const templateTokens = extractTokens(preset.promptAssembly.template)
    const mapTokenNames = new Set(Object.keys(preset.tokenMap).map(stripTokenBraces))
    templateTokens.forEach((tok) => {
      if (!mapTokenNames.has(tok)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['promptAssembly', 'template'], message: `template references {{${tok}}} but tokenMap has no entry for it` })
      }
    })

    // Every tokenMap resolver must point at something that exists.
    for (const [token, resolver] of Object.entries(preset.tokenMap)) {
      const path = ['tokenMap', token]
      if (resolver.source === 'core' || resolver.source === 'engine') {
        if (!(resolver.key in blocks)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `${token}: ${resolver.source} block "${resolver.key}" is not defined in engineBlocks/coreFiles` })
        }
      } else if (resolver.source === 'field') {
        if (!fieldKeys.has(resolver.key)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `${token}: field "${resolver.key}" is not a declared dynamicField` })
        }
      } else if (resolver.source === 'param') {
        if (!paramKeys.has(resolver.key)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `${token}: param "${resolver.key}" is not a declared specialParam` })
        }
      }
      // `computed` keys are already whitelisted by the leaf enum.
    }

    // The one computed key, colorBlock, is built from the `colorPalette` field
    // gated by the `includeColorBlock` checkbox -- both must exist when used.
    const usesColorBlock = Object.values(preset.tokenMap).some(r => r.source === 'computed' && r.key === 'colorBlock')
    if (usesColorBlock) {
      if (!preset.dynamicFields.some(f => f.key === 'colorPalette')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tokenMap'], message: `computed "colorBlock" requires a "colorPalette" dynamicField` })
      }
      if (!preset.specialParams.some(p => p.key === 'includeColorBlock' && p.type === 'checkbox')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tokenMap'], message: `computed "colorBlock" requires an "includeColorBlock" checkbox param` })
      }
    }
  })
  .transform(normalizeV2)

function stripTokenBraces(token: string): string {
  return token.replace(/^\{\{/, '').replace(/\}\}$/, '')
}

export type PresetV2 = z.infer<typeof presetV2Schema>
export type PresetV2DynamicField = z.infer<typeof dynamicFieldSchema>
export type PresetV2TextareaField = z.infer<typeof textareaFieldSchema>
export type PresetV2SpecialParam = z.infer<typeof specialParamSchema>
export type PresetV2SelectParam = z.infer<typeof selectParamSchema>
export type PresetV2CheckboxParam = z.infer<typeof checkboxParamSchema>
export type PresetV2AiExpansion = z.infer<typeof aiExpansionSchema>
export type PresetV2TokenResolver = z.infer<typeof tokenResolverSchema>
export type ComputedTokenKey = (typeof COMPUTED_TOKEN_KEYS)[number]

export type PresetV2ValidationResult =
  | { ok: true, preset: PresetV2 }
  | { ok: false, errors: PresetValidationError[] }

export function validatePresetV2(input: unknown): PresetV2ValidationResult {
  const result = presetV2Schema.safeParse(input)
  if (result.success) return { ok: true, preset: result.data }
  return { ok: false, errors: mapIssues(result.error) }
}

// ---------------------------------------------------------------------------
// Format discrimination
// ---------------------------------------------------------------------------

export type PresetFormat = 'v1' | 'v2'
export type AnyPreset = Preset | PresetV2

// v2 files carry no explicit schemaVersion and one is even version "1.0.0", so
// the format is detected structurally: any of the v2-only keys marks a v2 file.
export function detectPresetFormat(input: unknown): PresetFormat {
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>
    if (
      'tokenMap' in o
      || 'promptAssembly' in o
      || 'dynamicFields' in o
      || 'specialParams' in o
      || 'engineBlocks' in o
      || 'coreFiles' in o
    ) {
      return 'v2'
    }
  }
  return 'v1'
}

export type AnyPresetValidationResult =
  | { ok: true, format: 'v1', preset: Preset }
  | { ok: true, format: 'v2', preset: PresetV2 }
  | { ok: false, format: PresetFormat, errors: PresetValidationError[] }

// Single entry point that routes to the right schema by detected format. The
// loader/API layer switches onto this as the v2 pipeline lands (BL-041/045).
export function validateAnyPreset(input: unknown): AnyPresetValidationResult {
  const format = detectPresetFormat(input)
  if (format === 'v2') {
    const result = validatePresetV2(input)
    return result.ok
      ? { ok: true, format: 'v2', preset: result.preset }
      : { ok: false, format: 'v2', errors: result.errors }
  }
  const result = validatePreset(input)
  return result.ok
    ? { ok: true, format: 'v1', preset: result.preset }
    : { ok: false, format: 'v1', errors: result.errors }
}
