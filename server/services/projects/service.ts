import type { Prisma } from '@prisma/client'
import type { Preset } from '#shared/schemas/preset'
import { prisma } from '~~/server/utils/prisma'
import { ensureProfile } from '~~/server/services/profiles/ensure'
import { ensurePresetRecord } from '~~/server/services/presets/persist'

export interface ProjectView {
  id: string
  name: string | null
  // The filesystem preset slug the client works with, not the DB cuid.
  presetId: string
  presetVersion: string
  inputs: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface UpdateProjectPatch {
  inputs?: Record<string, string>
  name?: string
}

// Shared shape so create/get/update all return an identical view. `satisfies`
// keeps the precise result type Prisma infers.
const projectSelect = {
  id: true,
  name: true,
  presetVersion: true,
  inputs: true,
  createdAt: true,
  updatedAt: true,
  preset: { select: { slug: true } },
} satisfies Prisma.ProjectSelect

interface ProjectRow {
  id: string
  name: string | null
  presetVersion: string
  inputs: Prisma.JsonValue
  createdAt: Date
  updatedAt: Date
  preset: { slug: string }
}

function toView(row: ProjectRow): ProjectView {
  return {
    id: row.id,
    name: row.name,
    presetId: row.preset.slug,
    presetVersion: row.presetVersion,
    inputs: (row.inputs ?? {}) as unknown as Record<string, string>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export interface CreateProjectInput {
  userId: string
  preset: Preset
  inputs: Record<string, string>
  name?: string
}

export async function createProject(input: CreateProjectInput): Promise<ProjectView> {
  await ensureProfile(input.userId)
  const dbPreset = await ensurePresetRecord(input.preset)
  const row = await prisma.project.create({
    data: {
      userId: input.userId,
      presetId: dbPreset.id,
      presetVersion: input.preset.version,
      name: input.name ?? null,
      inputs: input.inputs as Prisma.InputJsonValue,
    },
    select: projectSelect,
  })
  return toView(row)
}

export async function getProject(userId: string, projectId: string): Promise<ProjectView | null> {
  const row = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ...projectSelect, userId: true },
  })
  // 404 for both missing and not-owned so ownership never leaks existence.
  if (!row || row.userId !== userId) return null
  return toView(row)
}

export async function updateProject(
  userId: string,
  projectId: string,
  patch: UpdateProjectPatch,
): Promise<ProjectView | null> {
  const existing = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  })
  if (!existing || existing.userId !== userId) return null

  const row = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(patch.inputs !== undefined ? { inputs: patch.inputs as Prisma.InputJsonValue } : {}),
      ...(patch.name !== undefined ? { name: patch.name } : {}),
    },
    select: projectSelect,
  })
  return toView(row)
}
