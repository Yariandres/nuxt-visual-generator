import type { AnyPreset } from '#shared/schemas/preset'

export async function fetchPreset(id: string): Promise<AnyPreset> {
  return await $fetch<AnyPreset>(`/api/presets/${encodeURIComponent(id)}`)
}
