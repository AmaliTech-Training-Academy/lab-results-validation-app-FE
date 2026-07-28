import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia } from 'pinia'
import CohortsView from '@/views/admin/CohortsView.vue'
import type { Cohort } from '@/types/domain.types'

vi.mock('@/services/cohorts.service', () => ({
  listCohorts: vi.fn<() => Promise<unknown>>(),
  createCohort: vi.fn<() => Promise<unknown>>(),
  getCohort: vi.fn<() => Promise<unknown>>(),
  lockCohort: vi.fn<() => Promise<unknown>>(),
  unlockCohort: vi.fn<() => Promise<unknown>>(),
}))
import * as svc from '@/services/cohorts.service'

function cohort(over: Partial<Cohort> = {}): Cohort {
  return {
    id: 'c1', name: 'Cohort 1', startDate: '2026-01-01', endDate: '2026-06-01',
    lifecycleState: 'DRAFT', locked: false, active: true,
    sharepointFolderUrl: null, referenceAcceptedAt: null,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...over,
  }
}

let router: Router
beforeEach(() => {
  vi.clearAllMocks()
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/cohorts', name: 'admin-cohorts', component: { template: '<div/>' } },
      { path: '/admin/cohorts/:id/standup', name: 'admin-cohort-standup', component: { template: '<div/>' } },
      { path: '/admin/cohorts/:id', name: 'admin-cohort-detail', component: { template: '<div/>' } },
    ],
  })
})
afterEach(() => vi.restoreAllMocks())

function mountView() {
  return mount(CohortsView, { global: { plugins: [createPinia(), router] } })
}

describe('CohortsView', () => {
  it('renders a row per cohort with its state chip', async () => {
    vi.mocked(svc.listCohorts).mockResolvedValue([
      cohort({ id: 'c1', lifecycleState: 'DRAFT' }),
      cohort({ id: 'c2', name: 'Cohort 2', lifecycleState: 'STOOD_UP' }),
      cohort({ id: 'c3', name: 'Cohort 3', lifecycleState: 'STOOD_UP', locked: true }),
    ])
    const wrapper = mountView()
    await flushPromises()
    const rows = wrapper.findAll('tr.row-click')
    expect(rows).toHaveLength(3)
    const text = wrapper.text()
    expect(text).toContain('Draft')
    expect(text).toContain('Stood up')
    expect(text).toContain('Locked')
  })

  it('routes DRAFT cohorts to stand-up and STOOD_UP to detail', async () => {
    vi.mocked(svc.listCohorts).mockResolvedValue([
      cohort({ id: 'draft-1', lifecycleState: 'DRAFT' }),
      cohort({ id: 'stood-1', lifecycleState: 'STOOD_UP' }),
    ])
    const push = vi.spyOn(router, 'push')
    const wrapper = mountView()
    await flushPromises()
    const rows = wrapper.findAll('tr.row-click')
    await rows[0]!.trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'admin-cohort-standup', params: { id: 'draft-1' } })
    await rows[1]!.trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'admin-cohort-detail', params: { id: 'stood-1' } })
  })

  it('opens the create drawer from the header action', async () => {
    vi.mocked(svc.listCohorts).mockResolvedValue([])
    const wrapper = mountView()
    await flushPromises()

    // Drawer starts closed.
    expect(document.body.textContent).not.toContain('A cohort is a time-bound group')

    await wrapper.findAll('button').find((b) => b.text().includes('New cohort'))!.trigger('click')
    await flushPromises()

    // VDrawer teleports to <body>; its subtitle confirms it opened.
    expect(document.body.textContent).toContain('A cohort is a time-bound group')
  })
})
