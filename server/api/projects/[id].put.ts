import { serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'
import { updateProject } from '~~/server/services/projects/service'
import {
  inputsSchema,
  projectIdSchema,
  parseBody,
  validatedParam,
} from '~~/server/utils/validation'

const bodySchema = z
  .object({
    inputs: inputsSchema.optional(),
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

  const id = validatedParam(event, 'id', projectIdSchema)
  const patch = await parseBody(event, bodySchema)

  const project = await updateProject(userId, id, patch)
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found', data: { code: 'project_not_found' } })
  }

  return { project }
})
