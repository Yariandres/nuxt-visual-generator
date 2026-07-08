export interface ExpandResult {
  text: string
  provider: string
  model: string
}

export async function expandField(
  presetId: string,
  fieldKey: string,
  value: string,
): Promise<ExpandResult> {
  return await $fetch<ExpandResult>('/api/expand', {
    method: 'POST',
    body: { presetId, fieldKey, value },
  })
}
