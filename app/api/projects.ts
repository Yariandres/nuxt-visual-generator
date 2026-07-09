export interface ProjectView {
  id: string
  name: string | null
  presetId: string
  presetVersion: string
  inputs: Record<string, string>
  createdAt: string
  updatedAt: string
}

interface ProjectResponse {
  project: ProjectView
}

export async function createProject(
  presetId: string,
  inputs: Record<string, string>,
  name?: string,
): Promise<ProjectView> {
  const { project } = await $fetch<ProjectResponse>('/api/projects', {
    method: 'POST',
    body: { presetId, inputs, ...(name ? { name } : {}) },
  })
  return project
}

export async function fetchProject(id: string): Promise<ProjectView> {
  const { project } = await $fetch<ProjectResponse>(`/api/projects/${encodeURIComponent(id)}`)
  return project
}

export async function updateProject(
  id: string,
  patch: { inputs?: Record<string, string>, name?: string },
): Promise<ProjectView> {
  const { project } = await $fetch<ProjectResponse>(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: patch,
  })
  return project
}
