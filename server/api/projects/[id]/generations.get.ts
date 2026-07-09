import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { createSupabaseStorageAdapter } from '~~/server/services/storage/supabase'
import { listProjectGenerations } from '~~/server/services/generations/history'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  // `serverSupabaseUser` returns JWT claims; the user id is the `sub` claim.
  const userId = user?.sub
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Bad Request', data: { code: 'invalid_payload' } })

  const storage = createSupabaseStorageAdapter({ client: serverSupabaseServiceRole(event) })
  const result = await listProjectGenerations(storage, userId, id)
  if (!result.ok) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found', data: { code: 'project_not_found' } })
  }

  return { generations: result.generations }
})
