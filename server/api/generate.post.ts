import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { z } from 'zod'
import { loadPreset } from '~~/server/services/presets/loader'
import { createGeminiImageGenerationAdapter } from '~~/server/services/ai/gemini'
import { createSupabaseStorageAdapter } from '~~/server/services/storage/supabase'
import { runGeneration } from '~~/server/services/generation/run'

const bodySchema = z.object({
  presetId: z.string().min(1),
  inputs: z.record(z.string(), z.string()),
  projectId: z.string().min(1).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

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
  const { presetId, inputs, projectId } = parsed.data

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
    { userId: user.id, projectId, preset: presetResult.preset, inputs },
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
