import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the Prisma singleton so ownership logic is tested without a database.
const { findUnique, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}))
vi.mock('~~/server/utils/prisma', () => ({
  prisma: { project: { findUnique, update } },
}))

const { getProject, updateProject } = await import('~~/server/services/projects/service')

function ownedRow(userId: string) {
  return {
    id: 'p1',
    name: 'My project',
    presetVersion: '1.0.0',
    inputs: { SUBJECT: 'a shoe' },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    preset: { slug: 'test_preset' },
    userId,
  }
}

beforeEach(() => {
  findUnique.mockReset()
  update.mockReset()
})

describe('getProject ownership', () => {
  it('returns a mapped view for the owner (preset slug, not cuid)', async () => {
    findUnique.mockResolvedValue(ownedRow('u1'))
    const view = await getProject('u1', 'p1')
    expect(view).not.toBeNull()
    expect(view?.presetId).toBe('test_preset')
    expect(view?.inputs).toEqual({ SUBJECT: 'a shoe' })
  })

  it('returns null when the project belongs to another user', async () => {
    findUnique.mockResolvedValue(ownedRow('u2'))
    expect(await getProject('u1', 'p1')).toBeNull()
  })

  it('returns null when the project does not exist', async () => {
    findUnique.mockResolvedValue(null)
    expect(await getProject('u1', 'missing')).toBeNull()
  })
})

describe('updateProject ownership', () => {
  it('does not update a project owned by another user', async () => {
    findUnique.mockResolvedValue({ userId: 'u2' })
    const result = await updateProject('u1', 'p1', { name: 'hax' })
    expect(result).toBeNull()
    expect(update).not.toHaveBeenCalled()
  })

  it('updates when the caller owns the project', async () => {
    findUnique.mockResolvedValue({ userId: 'u1' })
    update.mockResolvedValue(ownedRow('u1'))
    const result = await updateProject('u1', 'p1', { inputs: { SUBJECT: 'new' } })
    expect(result).not.toBeNull()
    expect(update).toHaveBeenCalledOnce()
  })
})
