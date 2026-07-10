import { serverSupabaseUser } from '#supabase/server'
import { getProject } from '~~/server/services/projects/service'
import { projectIdSchema, validatedParam } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  // `serverSupabaseUser` returns JWT claims; the user id is the `sub` claim.
  const userId = user?.sub
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const id = validatedParam(event, 'id', projectIdSchema)

  const project = await getProject(userId, id)
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found', data: { code: 'project_not_found' } })
  }

  return { project }
})
