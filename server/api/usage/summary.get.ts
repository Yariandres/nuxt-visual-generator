import { serverSupabaseUser } from '#supabase/server'
import { getUsageSummary } from '~~/server/services/usage/summary'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  // `serverSupabaseUser` returns JWT claims; the user id is the `sub` claim.
  const userId = user?.sub
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  return { summary: await getUsageSummary(userId) }
})
