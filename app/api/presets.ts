import type { Preset } from '#shared/schemas/preset'

export async function fetchPreset(id: string): Promise<Preset> {
  return await $fetch<Preset>(`/api/presets/${encodeURIComponent(id)}`)
}
