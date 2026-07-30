import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia } from 'pinia'
import CohortStandupView from '@/views/admin/CohortStandupView.vue'
import type { Cohort } from '@/types/domain.types'
import type { StandupStatus } from '@/types/standup.types'

vi.mock('@/services/cohorts.service', () => ({
  listCohorts: vi.fn<() => Promise<unknown>>(),
  getCohort: vi.fn<() => Promise<unknown>>(),
  getCohortReference: vi.fn<() => Promise<unknown>>(),
  createCohort: vi.fn<() => Promise<unknown>>(),
  attachSharePointLink: vi.fn<() => Promise<unknown>>(),
  standupStreamUrl: vi.fn<() => string>(() => 'http://mock/standup-stream'),
  fetchStandupStatus: vi.fn<() => Promise<unknown>>(),
  triggerGate4: vi.fn<() => Promise<unknown>>(),
  gate4StreamUrl: vi.fn<() => string>(() => 'http://mock/gate4-stream'),
  acceptCohortReference: vi.fn<() => Promise<unknown>>(),
  discardCohortReference: vi.fn<() => Promise<unknown>>(),
  lockCohort: vi.fn<() => Promise<unknown>>(),
  unlockCohort: vi.fn<() => Promise<unknown>>(),
}))
// Both stream composables branch on USE_MOCKS (true by default without a
// local .env.local override) to poll `fetchStandupStatus`/simulate locally
// instead of opening a real EventSource — force it on so this test is
// deterministic regardless of where it runs, and never touches EventSource.
vi.mock('@/services/mock/fixtures', () => ({ USE_MOCKS: true }))
import * as svc from '@/services/cohorts.service'

function draftCohort(over: Partial<Cohort> = {}): Cohort {
  return {
    id: 'c1', name: 'Cohort 1', startDate: '2026-01-01', endDate: '2026-06-01',
    lifecycleState: 'DRAFT', locked: false, active: true,
    sharepointFolderUrl: null, referenceAcceptedAt: null,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...over,
  }
}

const RUNNING: StandupStatus = {
  overall: 'running',
  gates: [{ id: 'gate1', label: 'Gate 1', status: 'running', errors: [] }],
}

let router: Router
beforeEach(async () => {
  vi.clearAllMocks()
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/cohorts', name: 'admin-cohorts', component: { template: '<div/>' } },
      { path: '/admin/cohorts/:id/standup', name: 'admin-cohort-standup', component: { template: '<div/>' } },
      { path: '/admin/cohorts/:id', name: 'admin-cohort-detail', component: { template: '<div/>' } },
    ],
  })
  router.push({ name: 'admin-cohort-standup', params: { id: 'c1' } })
  await router.isReady()
  vi.mocked(svc.getCohort).mockResolvedValue(draftCohort())
  vi.mocked(svc.fetchStandupStatus).mockResolvedValue(RUNNING)
})
afterEach(() => vi.restoreAllMocks())

function mountView() {
  return mount(CohortStandupView, { global: { plugins: [createPinia(), router] } })
}

describe('CohortStandupView', () => {
  it('blocks submission with a local message when the link is empty', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('button').trigger('click') // "Run validation" is the only button in the intake card
    await flushPromises()

    expect(wrapper.text()).toContain('Enter the SharePoint folder link.')
    expect(svc.attachSharePointLink).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('surfaces the backend validation message and re-enables the form on failure', async () => {
    vi.mocked(svc.attachSharePointLink).mockRejectedValue(new Error('Folder URL is invalid'))
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('input').setValue('https://sp/Cohort1')
    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Folder URL is invalid')
    // Stayed on the intake card and re-enabled the button — the failed attach never reached the stream.
    expect(wrapper.text()).toContain('Run validation')
    expect(svc.fetchStandupStatus).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('starts the gate stream once the link is attached successfully', async () => {
    vi.mocked(svc.attachSharePointLink).mockResolvedValue(undefined)
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('input').setValue('https://sp/Cohort1')
    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(svc.attachSharePointLink).toHaveBeenCalledWith('c1', { folderUrl: 'https://sp/Cohort1' })
    expect(wrapper.text()).not.toContain('Folder URL is invalid')
    expect(svc.fetchStandupStatus).toHaveBeenCalledWith('c1')
    wrapper.unmount()
  })
})