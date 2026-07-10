import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { z } from 'zod'
import { loadPreset } from '~~/server/services/presets/loader'
import { createGeminiImageGenerationAdapter } from '~~/server/services/ai/gemini'
import { createSupabaseStorageAdapter } from '~~/server/services/storage/supabase'
import { runGeneration } from '~~/server/services/generation/run'
import {
  inputsSchema,
  presetIdSchema,
  projectIdSchema,
  parseBody,
} from '~~/server/utils/validation'

const bodySchema = z.object({
  presetId: presetIdSchema,
  inputs: inputsSchema,
  projectId: projectIdSchema.optional(),
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  // `serverSupabaseUser` returns JWT claims; the user id is the `sub` claim.
  const userId = user?.sub
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const { presetId, inputs, projectId } = await parseBody(event, bodySchema)

  const presetResult = await loadPreset(presetId)
  if (!presetResult.ok) {
    if (presetResult.reason === 'not_found') {
      throw createError({ statusCode: 404, statusMessage: 'Preset not found', data: { code: 'preset_not_found' } })
    }
    console.error(`[generate] preset "${presetId}" failed to load:`, presetResult)
    throw createError({ statusCode: 500, statusMessage: 'Preset is malformed', data: { code: 'invalid_preset' } })
  }

  const config = useRuntimeConfig()
  if (!config.geminiApiKey) {
    throw createError({ statusCode: 500, statusMessage: 'Gemini is not configured', data: { code: 'gemini_not_configured' } })
  }

  const imageAdapter = createGeminiImageGenerationAdapter({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
  })
  const storage = createSupabaseStorageAdapter({ client: serverSupabaseServiceRole(event) })

  const result = await runGeneration(
    { imageAdapter, storage, provider: 'gemini', model: config.geminiModel },
    { userId, projectId, preset: presetResult.preset, inputs },
  )

  if (!result.ok) {
    throw createError({
      statusCode: result.error.status,
      statusMessage: result.error.message,
      data: { code: result.error.code, ...(result.error.details ? { errors: result.error.details } : {}) },
    })
  }

  return { generation: result.generation, url: result.url }
})
