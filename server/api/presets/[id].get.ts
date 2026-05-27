import { serverSupabaseUser } from '#supabase/server'
import { loadPreset } from '~~/server/services/presets/loader'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { code: 'missing_id' },
    })
  }

  const result = await loadPreset(id)
  if (result.ok) return result.preset

  if (result.reason === 'not_found') {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      data: { code: 'not_found' },
    })
  }

  console.error(`[presets] failed to serve "${id}":`, result)
  throw createError({
    statusCode: 500,
    statusMessage: 'Preset is malformed',
    data:
      result.reason === 'invalid'
        ? { code: 'invalid_preset', errors: result.errors }
        : { code: 'id_mismatch', expectedId: result.expectedId, actualId: result.actualId },
  })
})
