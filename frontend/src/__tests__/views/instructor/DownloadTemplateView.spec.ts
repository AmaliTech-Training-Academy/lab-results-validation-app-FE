import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia } from 'pinia'
import DownloadTemplateView from '@/views/instructor/DownloadTemplateView.vue'
import { getInstructorModulesWithLabs } from '@/services/instructor.service'
import type { InstructorModuleLabs } from '@/services/instructor.service'

vi.mock('@/services/instructor.service', () => ({
  getInstructorModulesWithLabs: vi.fn<() => Promise<InstructorModuleLabs[]>>(),
  fetchLabResultsTemplateHeaders: vi.fn<() => Promise<string[]>>().mockResolvedValue([]),
  downloadLabTemplate: vi.fn<() => Promise<string>>().mockResolvedValue('lab-template.csv'),
}))

const MOCK_MODULE_LABS: InstructorModuleLabs[] = [
  {
    moduleId: 'mod-1',
    moduleName: 'React & Frontend',
    specializationName: 'Frontend Development',
    labs: [
      { id: 'lab-1', moduleId: 'mod-1', title: 'REACT_COMPONENTS_V1', maxScore: 100, hasResults: false },
      { id: 'lab-2', moduleId: 'mod-1', title: 'NODE_REST_API_V1',    maxScore: 100, hasResults: false },
    ],
  },
]

const testRouter = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { template: '<div/>' } }],
})

function mountView() {
  vi.mocked(getInstructorModulesWithLabs).mockResolvedValue(MOCK_MODULE_LABS)
  return mount(DownloadTemplateView, {
    global: { plugins: [createPinia(), testRouter] },
  })
}

describe('DownloadTemplateView', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('rendering', () => {
    it('renders the page heading', async () => {
      const wrapper = mountView()
      await flushPromises()
      expect(wrapper.find('h1').text()).toBe('Download template')
    })

    it('renders download button disabled until a lab is selected', async () => {
      const wrapper = mountView()
      await flushPromises()
      expect(wrapper.text()).toContain('Select a lab above to download')
    })

    it('renders legend rows', async () => {
      const wrapper = mountView()
      await flushPromises()
      expect(wrapper.text()).toContain('REACT_COMPONENTS_V1')
      expect(wrapper.text()).toContain('NODE_REST_API_V1')
    })

    it('renders column reference rows', async () => {
      const wrapper = mountView()
      await flushPromises()
      await wrapper.findAll('.tpl-sec-head')[1]!.trigger('click')
      expect(wrapper.text()).toContain('learner_email')
      expect(wrapper.text()).toContain('graded_by')
    })

    it('marks required columns as Yes', async () => {
      const wrapper = mountView()
      await flushPromises()
      await wrapper.findAll('.tpl-sec-head')[1]!.trigger('click')
      const cells = wrapper.findAll('.req-yes')
      expect(cells.length).toBeGreaterThan(0)
    })

    it('marks all columns as required (Yes)', async () => {
      const wrapper = mountView()
      await flushPromises()
      await wrapper.findAll('.tpl-sec-head')[1]!.trigger('click')
      const yesCells = wrapper.findAll('.req-yes')
      const noCells  = wrapper.findAll('.req-no')
      expect(yesCells.length).toBeGreaterThan(0)
      expect(noCells.length).toBe(0)
    })
  })

  describe('lab selection', () => {
    it('updates download button text when a lab row is clicked', async () => {
      const wrapper = mountView()
      await flushPromises()
      await wrapper.find('tr.lab-row').trigger('click')
      expect(wrapper.text()).toContain('Download template for REACT_COMPONENTS_V1')
    })
  })

  describe('collapsible sections', () => {
    it('hides legend table when section header is clicked', async () => {
      const wrapper = mountView()
      await flushPromises()
      const headers = wrapper.findAll('.tpl-sec-head')
      expect(headers.length).toBeGreaterThanOrEqual(1)
      expect(wrapper.text()).toContain('REACT_COMPONENTS_V1')
      await headers[0]!.trigger('click')
      expect(wrapper.text()).not.toContain('REACT_COMPONENTS_V1')
    })

    it('toggles column reference table when section header is clicked', async () => {
      const wrapper = mountView()
      await flushPromises()
      const headers = wrapper.findAll('.tpl-sec-head')
      expect(headers.length).toBeGreaterThanOrEqual(2)
      expect(wrapper.text()).not.toContain('learner_email')
      await headers[1]!.trigger('click')
      expect(wrapper.text()).toContain('learner_email')
      await headers[1]!.trigger('click')
      expect(wrapper.text()).not.toContain('learner_email')
    })
  })

  describe('error state', () => {
    it('shows retry button when load fails', async () => {
      vi.mocked(getInstructorModulesWithLabs).mockRejectedValue(new Error('network'))
      const wrapper = mount(DownloadTemplateView, {
        global: { plugins: [createPinia(), testRouter] },
      })
      await flushPromises()
      expect(wrapper.text()).toContain('Could not load template data')
    })
  })
})
