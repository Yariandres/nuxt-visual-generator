import type { Prisma } from '@prisma/client'
import type { Preset } from '#shared/schemas/preset'
import { prisma } from '~~/server/utils/prisma'

export interface PersistedPreset {
  id: string
  version: string
}

// Bridges filesystem `.rdt` presets (BL-011) into the DB `presets` table so
// Generation/Project foreign keys resolve. Idempotent get-or-create keyed by
// (slug, version) -- slug is the `.rdt` id. Stores the full validated preset
// JSON as the definition, matching BL-013's "DB is the source of truth" path.
export async function ensurePresetRecord(preset: Preset): Promise<PersistedPreset> {
  const definition = preset as unknown as Prisma.InputJsonValue
  const row = await prisma.preset.upsert({
    where: { slug_version: { slug: preset.id, version: preset.version } },
    create: {
      slug: preset.id,
      name: preset.name,
      version: preset.version,
      definition,
    },
    update: {
      name: preset.name,
      definition,
    },
    select: { id: true, version: true },
  })
  return row
}
