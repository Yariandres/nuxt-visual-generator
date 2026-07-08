export interface GenerateResult {
  generation: {
    id: string
    status: 'succeeded' | 'failed' | 'pending'
    finalPrompt: string
    provider: string
    model: string
    mimeType: string | null
    createdAt: string
    completedAt: string | null
  }
  url: string
}

export async function generateImage(
  presetId: string,
  inputs: Record<string, string>,
  projectId?: string,
): Promise<GenerateResult> {
  return await $fetch<GenerateResult>('/api/generate', {
    method: 'POST',
    body: { presetId, inputs, ...(projectId ? { projectId } : {}) },
  })
}
