import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { InstructorContact } from '@/types/domain.types'

describe('instructors.service — real API', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('GET /instructors/{id} and returns the response as-is', async () => {
    vi.doMock('@/services/mock/useMocks', () => ({ USE_MOCKS: false }))
    const get = vi.fn<(path: string) => Promise<unknown>>()
    vi.doMock('@/services/http', () => ({ http: { get } }))
    const instructor: InstructorContact = { id: 'ins-abc', instructorId: 'INS-001', email: 'sarah.jenkins@amalitech.com', fullName: 'Sarah Jenkins', active: true }
    get.mockResolvedValue(instructor)

    const { getInstructor } = await import('@/services/instructors.service')
    const result = await getInstructor('ins-abc')

    expect(get).toHaveBeenCalledWith('/instructors/ins-abc')
    expect(result).toEqual(instructor)
  })
})

describe('instructors.service — mock mode', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('@/services/mock/useMocks', () => ({ USE_MOCKS: true }))
  })

  it('resolves by the internal id', async () => {
    const { getInstructor } = await import('@/services/instructors.service')
    const { referenceByCohort } = await import('@/services/mock/fixtures')
    const known = referenceByCohort['coh-stood']!.instructors[0]!

    const result = await getInstructor(known.id)

    expect(result.instructorId).toBe(known.instructorId)
    expect(result.fullName).toBe(known.fullName)
  })

  it('also resolves by the human-readable instructorId, not just the internal id', async () => {
    const { getInstructor } = await import('@/services/instructors.service')
    const { referenceByCohort } = await import('@/services/mock/fixtures')
    const known = referenceByCohort['coh-stood']!.instructors[0]!

    const result = await getInstructor(known.instructorId)

    expect(result.id).toBe(known.id)
  })

  it('throws when no instructor in any cohort matches the id', async () => {
    const { getInstructor } = await import('@/services/instructors.service')

    await expect(getInstructor('does-not-exist')).rejects.toThrow('Instructor not found')
  })
})
