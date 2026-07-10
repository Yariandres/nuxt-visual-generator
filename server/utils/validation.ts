import { createError, getRouterParam, readBody } from 'h3'
import type { H3Event } from 'h3'
import { z } from 'zod'

export const MAX_INPUT_VALUE_LENGTH = 5000

// Preset ids map to filesystem `.rdt` filenames in the loader, so restrict to a
// safe slug (no `.`, `/`, `\`) to prevent path traversal.
export const presetIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_]+$/, 'preset id must be alphanumeric or underscore')

export const fieldKeySchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]*$/, 'field key must match /^[A-Z][A-Z0-9_]*$/')

export const projectIdSchema = z.string().min(1).max(64)

// Control-character code points to strip, built numerically to avoid embedding
// literal control bytes in source. Keeps tab (9), newline (10), CR (13).
const ALLOWED_CONTROL = new Set([9, 10, 13])
const STRIPPED_CONTROL = new Set<number>()
for (let code = 0; code <= 0x1f; code++) {
  if (!ALLOWED_CONTROL.has(code)) STRIPPED_CONTROL.add(code)
}
STRIPPED_CONTROL.add(0x7f)

// Strips control characters and trims, so user text can't smuggle control bytes
// into a stored prompt.
export function sanitizeText(value: string): string {
  let out = ''
  for (const ch of value) {
    const cp = ch.codePointAt(0)
    if (cp === undefined || !STRIPPED_CONTROL.has(cp)) out += ch
  }
  return out.trim()
}

// Input maps: keys must be valid field keys, values are length-capped and
// sanitized. Empty values are allowed (draft/optional fields).
export const inputsSchema = z.record(
  fieldKeySchema,
  z.string().max(MAX_INPUT_VALUE_LENGTH).transform(sanitizeText),
)

function toValidationData(error: z.ZodError) {
  return {
    code: 'invalid_payload' as const,
    errors: error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
  }
}

// Consistent 400 shape across every route.
export function validationError(error: z.ZodError) {
  return createError({ statusCode: 400, statusMessage: 'Bad Request', data: toValidationData(error) })
}

// Named to avoid colliding with h3's auto-imported `readValidatedBody` (which
// has a different signature).
export async function parseBody<S extends z.ZodType>(
  event: H3Event,
  schema: S,
): Promise<z.infer<S>> {
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw validationError(parsed.error)
  return parsed.data
}

export function validatedParam<S extends z.ZodType>(
  event: H3Event,
  name: string,
  schema: S,
): z.infer<S> {
  const parsed = schema.safeParse(getRouterParam(event, name))
  if (!parsed.success) throw validationError(parsed.error)
  return parsed.data
}
