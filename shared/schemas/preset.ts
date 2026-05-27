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

export function validatePreset(input: unknown): PresetValidationResult {
  const result = presetSchema.safeParse(input)
  if (result.success) return { ok: true, preset: result.data }
  const errors = result.error.issues.map<PresetValidationError>(issue => ({
    path: issue.path.length === 0 ? '<root>' : issue.path.join('.'),
    message: issue.message,
  }))
  return { ok: false, errors }
}

export interface PresetSummary {
  id: string
  name: string
  version: string
}

export function presetSummary(preset: Preset): PresetSummary {
  return { id: preset.id, name: preset.name, version: preset.version }
}
