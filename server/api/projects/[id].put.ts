import { serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'
import { updateProject } from '~~/server/services/projects/service'

const bodySchema = z
  .object({
    inputs: z.record(z.string(), z.string()).optional(),
    name: z.string().trim().min(1).max(200).optional(),
  })
  .refine(d => d.inputs !== undefined || d.name !== undefined, {
    message: 'Provide inputs or name to update.',
  })

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  // `serverSupabaseUser` returns JWT claims; the user id is the `sub` claim.
  const userId = user?.sub
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Bad Request', data: { code: 'invalid_payload' } })

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

  const project = await updateProject(userId, id, parsed.data)
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found', data: { code: 'project_not_found' } })
  }

  return { project }
})
