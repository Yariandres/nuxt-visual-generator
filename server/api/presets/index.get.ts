import { serverSupabaseUser } from '#supabase/server'
import { listPresets } from '~~/server/services/presets/loader'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const result = await listPresets()
  for (const bad of result.invalid) {
    console.warn(`[presets] dropping invalid file ${bad.file}:`, bad.errors)
  }
  return { presets: result.presets }
})
