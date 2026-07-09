import { serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'
import { loadPreset } from '~~/server/services/presets/loader'
import { createProject } from '~~/server/services/projects/service'

const bodySchema = z.object({
  presetId: z.string().min(1),
  inputs: z.record(z.string(), z.string()),
  name: z.string().trim().min(1).max(200).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  // `serverSupabaseUser` returns JWT claims; the user id is the `sub` claim.
  const userId = user?.sub
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: {
        code: 'invalid_payload',
        errors: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      },
    })
  }

  const presetResult = await loadPreset(parsed.data.presetId)
  if (!presetResult.ok) {
    if (presetResult.reason === 'not_found') {
      throw createError({ statusCode: 404, statusMessage: 'Preset not found', data: { code: 'preset_not_found' } })
    }
    console.error(`[projects] preset "${parsed.data.presetId}" failed to load:`, presetResult)
    throw createError({ statusCode: 500, statusMessage: 'Preset is malformed', data: { code: 'invalid_preset' } })
  }

  const project = await createProject({
    userId,
    preset: presetResult.preset,
    inputs: parsed.data.inputs,
    name: parsed.data.name,
  })

  setResponseStatus(event, 201)
  return { project }
})
