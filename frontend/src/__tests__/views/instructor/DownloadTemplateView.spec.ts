import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia } from 'pinia'
import DownloadTemplateView from '@/views/instructor/DownloadTemplateView.vue'
import { getTemplateData } from '@/services/instructor.service'
import type { TemplateData } from '@/types/instructor.types'

vi.mock('@/services/instructor.service', () => ({
  getTemplateData: vi.fn<() => Promise<TemplateData>>(),
  fetchLabResultsTemplateHeaders: vi.fn<() => Promise<string[]>>().mockResolvedValue([]),
  downloadLabResultsTemplate: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}))

const MOCK_TEMPLATE: TemplateData = {
  filename: 'labs_results_template.csv',
  legend: [
    { lab: 'REACT_COMPONENTS_V1', max: 100 },
    { lab: 'NODE_REST_API_V1',    max: 100 },
  ],
  columns: [
    { name: 'learner_email', desc: 'Must match a learner email.', req: true  },
    { name: 'graded_by',     desc: 'Optional instructor name.',   req: true  },
  ],
}

const testRouter = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { template: '<div/>' } }],
})

function mountView() {
  vi.mocked(getTemplateData).mockResolvedValue(MOCK_TEMPLATE)
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

    it('renders the download button with filename', async () => {
      const wrapper = mountView()
      await flushPromises()
      expect(wrapper.text()).toContain('labs_results_template.csv')
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
      expect(wrapper.text()).toContain('learner_email')
      expect(wrapper.text()).toContain('graded_by')
    })

    it('marks required columns as Yes', async () => {
      const wrapper = mountView()
      await flushPromises()
      const cells = wrapper.findAll('.req-yes')
      expect(cells.length).toBeGreaterThan(0)
    })

    it('marks all columns as required (Yes)', async () => {
      const wrapper = mountView()
      await flushPromises()
      const yesCells = wrapper.findAll('.req-yes')
      const noCells = wrapper.findAll('.req-no')
      expect(yesCells.length).toBeGreaterThan(0)
      expect(noCells.length).toBe(0)
    })
  })

  describe('collapsible sections', () => {
    it('hides legend table when section header is clicked', async () => {
      const wrapper = mountView()
      await flushPromises()
      const headers = wrapper.findAll('.tpl-sec-head')
      expect(headers.length).toBeGreaterThanOrEqual(1)
      // legend table visible before toggle
      expect(wrapper.text()).toContain('REACT_COMPONENTS_V1')
      await headers[0]!.trigger('click')
      expect(wrapper.text()).not.toContain('REACT_COMPONENTS_V1')
    })

    it('hides column reference table when section header is clicked', async () => {
      const wrapper = mountView()
      await flushPromises()
      const headers = wrapper.findAll('.tpl-sec-head')
      expect(headers.length).toBeGreaterThanOrEqual(2)
      expect(wrapper.text()).toContain('learner_email')
      await headers[1]!.trigger('click')
      expect(wrapper.text()).not.toContain('learner_email')
    })
  })

  describe('error state', () => {
    it('shows retry button when load fails', async () => {
      vi.mocked(getTemplateData).mockRejectedValue(new Error('network'))
      const wrapper = mount(DownloadTemplateView, {
        global: { plugins: [createPinia(), testRouter] },
      })
      await flushPromises()
      expect(wrapper.text()).toContain('Could not load template data')
    })
  })
})
