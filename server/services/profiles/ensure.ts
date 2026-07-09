import { prisma } from '~~/server/utils/prisma'

// Defensively guarantees a `profiles` row exists for an authenticated user.
// The `on_auth_user_created` trigger creates profiles for new signups, but
// accounts created before that trigger (or any case where it fails to fire)
// would have none, breaking foreign keys on generations/usage_events.
// Idempotent get-or-create keyed by the auth user id.
export async function ensureProfile(userId: string): Promise<void> {
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId },
    update: {},
  })
}
