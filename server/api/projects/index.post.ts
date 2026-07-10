import { serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'
import { loadPreset } from '~~/server/services/presets/loader'
import { createProject } from '~~/server/services/projects/service'
import { inputsSchema, presetIdSchema, parseBody } from '~~/server/utils/validation'

const bodySchema = z.object({
  presetId: presetIdSchema,
  inputs: inputsSchema,
  name: z.string().trim().min(1).max(200).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  // `serverSupabaseUser` returns JWT claims; the user id is the `sub` claim.
  const userId = user?.sub
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const body = await parseBody(event, bodySchema)

  const presetResult = await loadPreset(body.presetId)
  if (!presetResult.ok) {
    if (presetResult.reason === 'not_found') {
      throw createError({ statusCode: 404, statusMessage: 'Preset not found', data: { code: 'preset_not_found' } })
    }
    console.error(`[projects] preset "${body.presetId}" failed to load:`, presetResult)
    throw createError({ statusCode: 500, statusMessage: 'Preset is malformed', data: { code: 'invalid_preset' } })
  }

  const project = await createProject({
    userId,
    preset: presetResult.preset,
    inputs: body.inputs,
    name: body.name,
  })

  setResponseStatus(event, 201)
  return { project }
})
