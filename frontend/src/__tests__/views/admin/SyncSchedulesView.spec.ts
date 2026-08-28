import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia } from 'pinia'
import SyncSchedulesView from '@/views/admin/SyncSchedulesView.vue'
import type { SyncScheduleResponse } from '@/types/syncSchedule.types'
import type { Cohort } from '@/types/domain.types'

vi.mock('@/services/syncSchedules.service', () => ({
  listSyncSchedules: vi.fn<() => Promise<unknown>>(),
  getSyncSchedule: vi.fn<() => Promise<unknown>>(),
  createSyncSchedule: vi.fn<() => Promise<unknown>>(),
  updateSyncSchedule: vi.fn<() => Promise<unknown>>(),
  removeSyncSchedule: vi.fn<() => Promise<unknown>>(),
}))
vi.mock('@/services/cohorts.service', () => ({
  listCohorts: vi.fn<() => Promise<unknown>>(),
  getCohort: vi.fn<() => Promise<unknown>>(),
  createCohort: vi.fn<() => Promise<unknown>>(),
  lockCohort: vi.fn<() => Promise<unknown>>(),
  unlockCohort: vi.fn<() => Promise<unknown>>(),
}))
import * as svc from '@/services/syncSchedules.service'
import * as cohortsSvc from '@/services/cohorts.service'

function schedule(over: Partial<SyncScheduleResponse> = {}): SyncScheduleResponse {
  return {
    id: 's1',
    name: 'Nightly sync',
    cohortId: null,
    frequency: 'DAILY',
    timeOfDay: '02:00',
    dayOfWeek: null,
    timezone: 'GMT',
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  }
}

function cohort(over: Partial<Cohort> = {}): Cohort {
  return {
    id: 'c1', name: 'Cohort 1', startDate: '2026-01-01', endDate: '2026-06-01',
    lifecycleState: 'DRAFT', locked: false, active: true,
    sharepointFolderUrl: null, referenceAcceptedAt: null,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...over,
  }
}

let router: Router
let activeWrapper: ReturnType<typeof mount> | null = null
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/admin/sync-schedules', name: 'admin-sync-schedules', component: { template: '<div/>' } }],
  })
})
afterEach(() => {
  activeWrapper?.unmount()
  activeWrapper = null
  vi.restoreAllMocks()
})

function mountView() {
  activeWrapper = mount(SyncSchedulesView, { global: { plugins: [createPinia(), router] } })
  return activeWrapper
}

describe('SyncSchedulesView', () => {
  it('renders a row per schedule, resolving cohort names and the all-eligible pill', async () => {
    vi.mocked(svc.listSyncSchedules).mockResolvedValue([
      schedule({ id: 's1', name: 'Nightly sync', cohortId: null }),
      schedule({ id: 's2', name: 'Weekly sync', cohortId: 'c1', frequency: 'WEEKLY', dayOfWeek: 'MONDAY' }),
    ])
    const wrapper = mountView()
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('Nightly sync')
    expect(text).toContain('All eligible cohorts')
    expect(text).toContain('Weekly sync')
    expect(text).toContain('Cohort 1')
    expect(text).toContain('Weekly · Monday')
  })

  it('opens the create drawer from the header action', async () => {
    vi.mocked(svc.listSyncSchedules).mockResolvedValue([])
    const wrapper = mountView()
    await flushPromises()

    expect(document.body.textContent).not.toContain('New sync schedule')

    await wrapper.findAll('button').find((b) => b.text().includes('New schedule'))!.trigger('click')
    await flushPromises()

    expect(document.body.textContent).toContain('New sync schedule')
  })

  it('keeps the day-of-week field in the DOM but disables it when frequency is DAILY', async () => {
    vi.mocked(svc.listSyncSchedules).mockResolvedValue([])
    const wrapper = mountView()
    await flushPromises()
    await wrapper.findAll('button').find((b) => b.text().includes('New schedule'))!.trigger('click')
    await flushPromises()

    expect(document.body.textContent).toContain('Day of week')

    const drawer = document.body.querySelector('.drawer')!
    const frequencySelect = Array.from(drawer.querySelectorAll('select')).find((s) =>
      Array.from(s.options).some((o) => o.value === 'DAILY'),
    ) as HTMLSelectElement
    const daySelect = Array.from(drawer.querySelectorAll('select')).find((s) =>
      Array.from(s.options).some((o) => o.value === 'MONDAY'),
    ) as HTMLSelectElement

    expect(daySelect.disabled).toBe(false)

    frequencySelect.value = 'DAILY'
    frequencySelect.dispatchEvent(new Event('change'))
    await flushPromises()

    // Field stays in the DOM (no layout jump) — just greyed out and disabled.
    expect(document.body.textContent).toContain('Day of week')
    expect(daySelect.disabled).toBe(true)
  })

  it('deletes a schedule only after the user confirms via the delete modal', async () => {
    vi.mocked(svc.listSyncSchedules).mockResolvedValue([schedule({ id: 's1' })])
    vi.mocked(svc.removeSyncSchedule).mockResolvedValue(undefined)
    const wrapper = mountView()
    await flushPromises()

    // Delete lives in the row's ⋮ kebab, whose menu teleports to <body>.
    async function openDeleteViaKebab() {
      await wrapper.find('button[aria-label="Row actions"]').trigger('click')
      await flushPromises()
      const del = Array.from(document.body.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Delete schedule'),
      )
      del!.click()
      await flushPromises()
    }
    function modalButton(text: string): HTMLButtonElement {
      const modal = document.body.querySelector('.modal')!
      return Array.from(modal.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as HTMLButtonElement
    }

    // Cancel: no delete call.
    await openDeleteViaKebab()
    expect(document.body.textContent).toContain('Delete sync schedule')
    modalButton('Cancel').click()
    await flushPromises()
    expect(svc.removeSyncSchedule).not.toHaveBeenCalled()

    // Confirm: delete goes through.
    await openDeleteViaKebab()
    modalButton('Delete').click()
    await flushPromises()
    expect(svc.removeSyncSchedule).toHaveBeenCalledWith('s1')
  })
})
