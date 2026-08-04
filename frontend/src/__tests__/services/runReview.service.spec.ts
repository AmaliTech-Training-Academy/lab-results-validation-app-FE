import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GradingSyncOverviewResponse } from '@/types/run.types'
import type { NotificationResponse } from '@/types/runReview.types'
import type { InstructorContact } from '@/types/domain.types'
import type { Paged } from '@/types/common.types'

vi.mock('@/services/mock/useMocks', () => ({ USE_MOCKS: false }))
vi.mock('@/services/http', () => ({
  http: { get: vi.fn<(path: string) => Promise<unknown>>(), post: vi.fn<(path: string) => Promise<unknown>>() },
}))

import { getRunReview, listNotifications } from '@/services/runReview.service'
import { http } from '@/services/http'

/** Real /overview payloads only nest `issues` under each file — there's no top-level `issues` array. */
function overview(over: Partial<GradingSyncOverviewResponse> = {}): GradingSyncOverviewResponse {
  return {
    jobId: 'job-1',
    cohortId: 'c1',
    jobStatus: 'COMPLETED',
    startedAt: '2026-08-04T14:10:36Z',
    completedAt: '2026-08-04T14:10:44Z',
    filesProcessed: 2,
    rowsRead: 60,
    committedNew: 0,
    updatedCount: 0,
    skippedInvalid: 5,
    skippedUnchanged: 0,
    conflictsCount: 0,
    files: [
      {
        workbookFilename: 'BE Lab Grading.xlsx',
        status: 'partial',
        rowsRead: 25,
        committedNew: 0,
        updatedCount: 0,
        skippedInvalid: 5,
        skippedUnchanged: 0,
        conflictsCount: 0,
        highFailureRate: true,
        failureRatePercent: 100,
        runAt: '2026-08-04T14:10:40Z',
        issues: [
          { file: 'BE Lab Grading.xlsx', location: 'sheet Module-5 row 5', rule: 'R5-UNKNOWN-REVIEWER', message: "Reviewer 'Eric Munyaneza' does not match any active instructor." },
          { file: 'BE Lab Grading.xlsx', location: 'sheet Module-5 row 9', rule: 'F2-INVALID-SCORE', message: "Total Score '49s%' is not numeric." },
        ],
        rejectionReasons: [
          { rule: 'R5-UNKNOWN-REVIEWER', count: 1 },
          { rule: 'F2-INVALID-SCORE', count: 1 },
        ],
      },
      {
        workbookFilename: 'FE Lab Grading.xlsx',
        status: 'completed',
        rowsRead: 35,
        committedNew: 0,
        updatedCount: 0,
        skippedInvalid: 0,
        skippedUnchanged: 0,
        conflictsCount: 0,
        highFailureRate: false,
        failureRatePercent: 0,
        runAt: '2026-08-04T14:10:41Z',
        issues: [],
        rejectionReasons: [],
      },
    ],
    ...over,
  }
}

describe('getRunReview (overview mapping)', () => {
  it('surfaces per-file issues in the run-level errorReport even though the API has no top-level `issues` field', async () => {
    vi.mocked(http.get).mockResolvedValue(overview())

    const review = await getRunReview('c1', 'job-1')

    expect(review.run.errorReport).toHaveLength(2)
    expect(review.run.errorReport?.map((i) => i.rule)).toEqual(['R5-UNKNOWN-REVIEWER', 'F2-INVALID-SCORE'])
    expect(review.files?.[0]?.issues).toHaveLength(2)
  })

  it('drops the informational blank-total-score rule from both the file and run-level issue lists', async () => {
    const dto = overview()
    dto.files[0]!.issues.push({ file: 'BE Lab Grading.xlsx', location: 'sheet Module-5 row 10', rule: 'F1-BLANK-TOTAL-SCORE', message: 'Total Score is blank.' })
    vi.mocked(http.get).mockResolvedValue(dto)

    const review = await getRunReview('c1', 'job-1')

    expect(review.run.errorReport?.some((i) => i.rule === 'F1-BLANK-TOTAL-SCORE')).toBe(false)
    expect(review.files?.[0]?.issues.some((i) => i.rule === 'F1-BLANK-TOTAL-SCORE')).toBe(false)
  })

  it('falls back to the top-level `issues` field when no per-file breakdown is present', async () => {
    vi.mocked(http.get).mockResolvedValue(
      overview({
        files: [],
        issues: [{ message: 'Cohort folder not found.' }],
      }),
    )

    const review = await getRunReview('c1', 'job-1')

    expect(review.run.errorReport).toEqual([{ message: 'Cohort folder not found.' }])
  })
})

function notificationDto(over: Partial<NotificationResponse> = {}): NotificationResponse {
  return {
    id: 'nt-1',
    cohortId: 'c1',
    syncJobId: 'run-1',
    ingestionRunId: 'run-1',
    type: 'instructor_digest',
    recipientKind: 'instructor',
    recipientInstructorId: 'ins-abc',
    recipientUserId: null,
    dispatchPolicy: 'HELD',
    subject: null,
    status: 'PENDING',
    errorDetail: null,
    sentAt: null,
    dismissedBy: null,
    dismissedAt: null,
    createdAt: '2026-08-04T14:10:36Z',
    issues: [],
    ...over,
  }
}

const INSTRUCTOR: InstructorContact = { id: 'ins-abc', instructorId: 'INS-001', email: 'sarah.jenkins@amalitech.com', fullName: 'Sarah Jenkins', active: true }

describe('listNotifications (instructor recipient enrichment)', () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset()
  })

  it('resolves recipientInstructorId to a name/email via GET /instructors/{id}', async () => {
    const page: Paged<NotificationResponse> = { content: [notificationDto()], number: 0, size: 20, totalElements: 1, totalPages: 1, last: true }
    vi.mocked(http.get).mockImplementation((path: string) =>
      path.startsWith('/instructors/') ? Promise.resolve(INSTRUCTOR) : Promise.resolve(page),
    )

    const result = await listNotifications({ cohortId: 'c1' })

    expect(http.get).toHaveBeenCalledWith('/instructors/ins-abc')
    expect(result.content[0]?.recipientName).toBe('Sarah Jenkins')
    expect(result.content[0]?.recipientEmail).toBe('sarah.jenkins@amalitech.com')
  })

  it('dedupes the instructor lookup when multiple notifications share the same recipient', async () => {
    const page: Paged<NotificationResponse> = {
      content: [notificationDto({ id: 'nt-1' }), notificationDto({ id: 'nt-2' })],
      number: 0, size: 20, totalElements: 2, totalPages: 1, last: true,
    }
    vi.mocked(http.get).mockImplementation((path: string) =>
      path.startsWith('/instructors/') ? Promise.resolve(INSTRUCTOR) : Promise.resolve(page),
    )

    await listNotifications({ cohortId: 'c1' })

    expect(vi.mocked(http.get).mock.calls.filter(([path]) => path.startsWith('/instructors/'))).toHaveLength(1)
  })

  it('leaves the raw id as the fallback when the instructor lookup fails', async () => {
    const page: Paged<NotificationResponse> = { content: [notificationDto()], number: 0, size: 20, totalElements: 1, totalPages: 1, last: true }
    vi.mocked(http.get).mockImplementation((path: string) =>
      path.startsWith('/instructors/') ? Promise.reject(new Error('not found')) : Promise.resolve(page),
    )

    const result = await listNotifications({ cohortId: 'c1' })

    expect(result.content[0]?.recipientName).toBeUndefined()
    expect(result.content[0]?.recipientInstructorId).toBe('ins-abc')
  })

  it('does not attempt a lookup for admin recipients', async () => {
    const page: Paged<NotificationResponse> = {
      content: [notificationDto({ recipientKind: 'admin', recipientInstructorId: null, recipientUserId: 'usr-1' })],
      number: 0, size: 20, totalElements: 1, totalPages: 1, last: true,
    }
    vi.mocked(http.get).mockResolvedValue(page)

    await listNotifications({ cohortId: 'c1' })

    expect(vi.mocked(http.get).mock.calls.filter(([path]) => path.startsWith('/instructors/'))).toHaveLength(0)
  })
})
