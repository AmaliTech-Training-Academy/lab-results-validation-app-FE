import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import CohortStandupView from '@/views/admin/CohortStandupView.vue'
import type { Cohort } from '@/types/domain.types'

vi.mock('@/services/cohorts.service', () => ({
  listCohorts: vi.fn<() => Promise<unknown>>(),
  getCohort: vi.fn<() => Promise<unknown>>(),
  createCohort: vi.fn<() => Promise<unknown>>(),
  lockCohort: vi.fn<() => Promise<unknown>>(),
  unlockCohort: vi.fn<() => Promise<unknown>>(),
  attachSharePointLink: vi.fn<() => Promise<unknown>>(),
  fetchStandupStatus: vi.fn<() => Promise<unknown>>(),
  hasStandupRun: vi.fn<() => Promise<unknown>>(),
  acceptCohortReference: vi.fn<() => Promise<unknown>>(),
  discardCohortReference: vi.fn<() => Promise<unknown>>(),
  triggerGate4: vi.fn<() => Promise<unknown>>(),
  standupStreamUrl: vi.fn<() => string>(() => 'http://mock/standup-stream'),
  gate4StreamUrl: vi.fn<() => string>(() => 'http://mock/gate4-stream'),
}))
// useStandupStream/useGate4Stream branch on USE_MOCKS (true by default without a local .env.local
// override) — force the real SSE branch so this test is deterministic regardless of where it runs.
vi.mock('@/services/mock/useMocks', () => ({
  USE_MOCKS: false,
}))
import * as cohortsSvc from '@/services/cohorts.service'

function cohort(over: Partial<Cohort> = {}): Cohort {
  return {
    id: 'c1', name: 'Cohort 7', startDate: '2026-06-01', endDate: '2026-12-01',
    lifecycleState: 'DRAFT', locked: false, active: true, sharepointFolderUrl: null, createdAt: '2026-06-01T00:00:00Z',
    ...over,
  }
}

class FakeEventSource {
  listeners = new Map<string, ((e: MessageEvent) => void)[]>()
  onerror: (() => void) | null = null
  constructor(public url: string) {
    FakeEventSource.instances.push(this)
  }
  addEventListener(name: string, cb: (e: MessageEvent) => void) {
    const list = this.listeners.get(name) ?? []
    list.push(cb)
    this.listeners.set(name, list)
  }
  emit(name: string, data: unknown) {
    for (const cb of this.listeners.get(name) ?? []) cb({ data: JSON.stringify(data) } as MessageEvent)
  }
  close() {}
  static instances: FakeEventSource[] = []
}

let router: Router
beforeEach(async () => {
  vi.clearAllMocks()
  // vi.clearAllMocks() clears call history but NOT a previously configured mockResolvedValue — a
  // test that leaves getCohort resolving REFERENCE_ACCEPTED (post-accept) would otherwise leak into
  // the next test's initial onMounted fetch, before that test's own setup runs. Reset the default here.
  vi.mocked(cohortsSvc.getCohort).mockResolvedValue(cohort())
  // Most tests start a fresh run themselves via "Run validation" — default the mount-time
  // FND-58 existence check to false so it doesn't auto-attach a stream before they do.
  vi.mocked(cohortsSvc.hasStandupRun).mockResolvedValue(false)
  FakeEventSource.instances = []
  vi.stubGlobal('EventSource', FakeEventSource)
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
})
afterEach(() => vi.restoreAllMocks())

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(CohortStandupView, { global: { plugins: [pinia, router] } })
  return { wrapper, pinia }
}

/** Drives Gates 1-3 to completion so the view lands on the "awaiting accept" panel. */
async function reachAwaitingAccept(wrapper: ReturnType<typeof mount>) {
  vi.mocked(cohortsSvc.getCohort).mockResolvedValue(cohort())
  vi.mocked(cohortsSvc.attachSharePointLink).mockResolvedValue(undefined)
  await flushPromises()

  await wrapper.find('input').setValue('https://sp/Cohort7')
  await wrapper.find('button').trigger('click') // "Run validation"
  await flushPromises()

  const es = FakeEventSource.instances[0]!
  es.emit('gate.passed', { gate: 1 })
  es.emit('gate.passed', { gate: 2 })
  es.emit('gate.passed', { gate: 3 })
  es.emit('pipeline.done', { status: 'COMPLETED', specs: 2, modules: 4, labs: 8, learners: 40, quizReferencePresent: true })
  await flushPromises()
}

describe('CohortStandupView — reload resumes an existing run (FND-58)', () => {
  it('re-attaches the Gates 1-3 stream on mount and rebuilds the awaiting-accept panel from replay, without a "Run validation" click', async () => {
    vi.mocked(cohortsSvc.hasStandupRun).mockResolvedValue(true)
    const { wrapper } = mountView()
    await flushPromises()

    // No "Run validation" click here — this is what a page reload mid/post-run looks like.
    expect(cohortsSvc.hasStandupRun).toHaveBeenCalledWith('c1')
    expect(FakeEventSource.instances).toHaveLength(1)

    const es = FakeEventSource.instances[0]!
    // The backend replays a job's full stored history on a fresh connection — simulate that replay.
    es.emit('gate.passed', { gate: 1 })
    es.emit('gate.passed', { gate: 2 })
    es.emit('gate.passed', { gate: 3 })
    es.emit('pipeline.done', { status: 'COMPLETED', specs: 2, modules: 4, labs: 8, learners: 40, quizReferencePresent: true })
    await flushPromises()

    expect(wrapper.text()).toContain('review and accept')
    // Gates 1-3 all replayed to 'passed' — none is left stuck on the initial "Pending" placeholder
    // (Accept/Gate 4 correctly still read Pending — they haven't happened yet).
    const gateStates = wrapper.findAll('.step-state').map((s) => s.text()).slice(0, 3)
    expect(gateStates).toEqual(['Passed', 'Passed', 'Passed'])
  })

  it('does not attach a stream for a cohort that has never been run — the intake form still shows', async () => {
    vi.mocked(cohortsSvc.hasStandupRun).mockResolvedValue(false)
    const { wrapper } = mountView()
    await flushPromises()

    expect(FakeEventSource.instances).toHaveLength(0)
    expect(wrapper.text()).toContain('SharePoint folder link')
  })
})

describe('CohortStandupView — Accept error handling (§ FND-34)', () => {
  it('shows the backend\'s real error inline and re-enables Accept when accept fails, instead of going silent', async () => {
    const { wrapper } = mountView()
    await reachAwaitingAccept(wrapper)
    expect(wrapper.text()).toContain('review and accept')

    vi.mocked(cohortsSvc.acceptCohortReference).mockRejectedValue(new Error('Reference bundle failed integrity check: 3 labs missing a module link'))
    const acceptBtn = wrapper.findAll('button').find((b) => b.text().includes('Accept reference data'))!
    await acceptBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Reference bundle failed integrity check: 3 labs missing a module link')
    // Still on the awaiting-accept panel, not stuck mid-request and not silently advanced to Gate 4.
    expect(wrapper.text()).toContain('review and accept')
    expect(wrapper.find('button:disabled').exists()).toBe(false)
    expect(cohortsSvc.triggerGate4).not.toHaveBeenCalled()
  })

  it('clears the stale error and proceeds to Gate 4 once a retry succeeds', async () => {
    const { wrapper } = mountView()
    await reachAwaitingAccept(wrapper)

    vi.mocked(cohortsSvc.acceptCohortReference).mockRejectedValueOnce(new Error('Reference bundle failed integrity check'))
    await wrapper.findAll('button').find((b) => b.text().includes('Accept reference data'))!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Reference bundle failed integrity check')

    vi.mocked(cohortsSvc.acceptCohortReference).mockResolvedValue(undefined)
    vi.mocked(cohortsSvc.getCohort).mockResolvedValue(cohort({ lifecycleState: 'REFERENCE_ACCEPTED' }))
    vi.mocked(cohortsSvc.triggerGate4).mockResolvedValue(undefined)
    await wrapper.findAll('button').find((b) => b.text().includes('Accept reference data'))!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('Reference bundle failed integrity check')
    expect(cohortsSvc.triggerGate4).toHaveBeenCalledWith('c1')
  })
})

describe('CohortStandupView — Gate 1-3 error formatting (§ FND-37)', () => {
  it('renders a gate.failed structured error as readable text, not a raw object dump', async () => {
    vi.mocked(cohortsSvc.getCohort).mockResolvedValue(cohort())
    vi.mocked(cohortsSvc.attachSharePointLink).mockResolvedValue(undefined)
    const { wrapper } = mountView()
    await flushPromises()

    await wrapper.find('input').setValue('https://sp/Cohort7')
    await wrapper.find('button').trigger('click') // "Run validation"
    await flushPromises()

    // The real backend's gate.failed payload for gates 1-3: errors is GateError[] ({file, location,
    // rule, message}), not string[] — location holds a raw URL for this Gate 1 rule.
    const es = FakeEventSource.instances[0]!
    es.emit('gate.failed', {
      gate: 1,
      errors: [{
        file: 'link',
        location: 'https://contoso.sharepoint.com/bad/link',
        rule: 'G1-INVALID-URL',
        message: 'The URL is not a valid SharePoint link. Expected format: https://<tenant>.sharepoint.com/...',
      }],
    })
    await flushPromises()

    expect(wrapper.text()).toContain('link · https://contoso.sharepoint.com/bad/link · G1-INVALID-URL — The URL is not a valid SharePoint link.')
    expect(wrapper.text()).not.toContain('[object Object]')
    expect(wrapper.html()).not.toContain('&quot;file&quot;')
  })

  it('omits blank fields cleanly for a Gate 2 error, which never sets file/location', async () => {
    vi.mocked(cohortsSvc.getCohort).mockResolvedValue(cohort())
    vi.mocked(cohortsSvc.attachSharePointLink).mockResolvedValue(undefined)
    const { wrapper } = mountView()
    await flushPromises()

    await wrapper.find('input').setValue('https://sp/Cohort7')
    await wrapper.find('button').trigger('click')
    await flushPromises()

    const es = FakeEventSource.instances[0]!
    es.emit('gate.passed', { gate: 1 })
    es.emit('gate.failed', { gate: 2, errors: [{ file: null, location: null, rule: 'G2-MISSING-FOLDER', message: "Folder 'Scores' was not found." }] })
    await flushPromises()

    expect(wrapper.text()).toContain("G2-MISSING-FOLDER — Folder 'Scores' was not found.")
  })
})

describe('CohortStandupView — Gate 4 trigger failure after a successful accept', () => {
  it('shows the backend error inline when accept succeeds but starting Gate 4 fails, instead of going silent', async () => {
    const { wrapper } = mountView()
    await reachAwaitingAccept(wrapper)

    vi.mocked(cohortsSvc.acceptCohortReference).mockResolvedValue(undefined)
    vi.mocked(cohortsSvc.getCohort).mockResolvedValue(cohort({ lifecycleState: 'REFERENCE_ACCEPTED' }))
    vi.mocked(cohortsSvc.triggerGate4).mockRejectedValue(new Error('Instructor database file could not be parsed'))
    await wrapper.findAll('button').find((b) => b.text().includes('Accept reference data'))!.trigger('click')
    await flushPromises()

    // The commit itself went through — this isn't the "awaiting accept" panel anymore — but the
    // Gate 4 trigger failure is surfaced, not swallowed into a generic toast.
    expect(wrapper.text()).not.toContain('review and accept')
    expect(wrapper.text()).toContain('Could not start Gate 4 validation')
    expect(wrapper.text()).toContain('Instructor database file could not be parsed')
    expect(FakeEventSource.instances).toHaveLength(1) // never opened a Gate 4 stream for a trigger that failed
  })

  it('clears the error and starts Gate 4 once "Retry Gate 4" succeeds', async () => {
    const { wrapper } = mountView()
    await reachAwaitingAccept(wrapper)

    vi.mocked(cohortsSvc.acceptCohortReference).mockResolvedValue(undefined)
    vi.mocked(cohortsSvc.getCohort).mockResolvedValue(cohort({ lifecycleState: 'REFERENCE_ACCEPTED' }))
    vi.mocked(cohortsSvc.triggerGate4).mockRejectedValueOnce(new Error('Instructor database file could not be parsed'))
    await wrapper.findAll('button').find((b) => b.text().includes('Accept reference data'))!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Could not start Gate 4 validation')

    vi.mocked(cohortsSvc.triggerGate4).mockResolvedValue(undefined)
    await wrapper.findAll('button').find((b) => b.text().includes('Retry Gate 4'))!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('Could not start Gate 4 validation')
    expect(FakeEventSource.instances).toHaveLength(2) // the retry opened the Gate 4 stream
  })
})
