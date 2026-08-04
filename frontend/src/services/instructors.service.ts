import { http } from './http'
import { USE_MOCKS } from './mock/useMocks'
import type { InstructorContact } from '@/types/domain.types'

export async function getInstructor(id: string): Promise<InstructorContact> {
  if (USE_MOCKS) {
    const { mockDelay, referenceByCohort } = await import('./mock/fixtures')
    const instructor = Object.values(referenceByCohort)
      .flatMap((r) => r.instructors)
      .find((i) => i.id === id || i.instructorId === id)
    if (!instructor) throw new Error('Instructor not found')
    return mockDelay(instructor)
  }
  return http.get<InstructorContact>(`/instructors/${id}`)
}
