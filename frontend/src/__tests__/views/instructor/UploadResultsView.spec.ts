import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia } from 'pinia'
import UploadResultsView from '@/views/instructor/UploadResultsView.vue'
import { uploadCsv } from '@/services/instructor.service'

vi.mock('@/services/instructor.service', () => ({
  uploadCsv: vi.fn<(f: File) => Promise<{ uploadId: string }>>(),
}))

const testRouter = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/',         component: { template: '<div/>' } },
    { path: '/instructor/uploads', name: 'instructor-uploads', component: { template: '<div/>' } },
    { path: '/instructor/template', name: 'instructor-template', component: { template: '<div/>' } },
  ],
})

function makeFile(name = 'results.csv') {
  return new File(['col1,col2\nval1,val2'], name, { type: 'text/csv' })
}

function mountView() {
  return mount(UploadResultsView, {
    global: { plugins: [createPinia(), testRouter] },
  })
}

describe('UploadResultsView', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('rendering', () => {
    it('renders the page heading', () => {
      const wrapper = mountView()
      expect(wrapper.find('h1').text()).toBe('Upload results')
    })

    it('renders the dropzone in idle state', () => {
      const wrapper = mountView()
      expect(wrapper.text()).toContain('Drop your CSV here')
    })
  })

  describe('button state', () => {
    it('disables the Validate & upload button with no file selected', () => {
      const wrapper = mountView()
      const btn = wrapper.find('button[disabled]')
      expect(btn.exists()).toBe(true)
    })

    it('enables the button after a CSV file is selected', async () => {
      const wrapper = mountView()
      const input = wrapper.find('input[type="file"]')
      Object.defineProperty(input.element, 'files', {
        value: [makeFile()],
        configurable: true,
      })
      await input.trigger('change')
      const buttons = wrapper.findAll('button')
      const validateBtn = buttons.find((b) => b.text().includes('Validate'))
      expect(validateBtn?.attributes('disabled')).toBeUndefined()
    })

    it('shows filename in dropzone after file is selected', async () => {
      const wrapper = mountView()
      const input = wrapper.find('input[type="file"]')
      Object.defineProperty(input.element, 'files', {
        value: [makeFile('lab_results.csv')],
        configurable: true,
      })
      await input.trigger('change')
      expect(wrapper.text()).toContain('lab_results.csv')
    })
  })

  describe('upload flow', () => {
    it('switches to processing state while uploading', async () => {
      vi.mocked(uploadCsv).mockResolvedValue({ uploadId: 'UP-TEST01' })
      const wrapper = mountView()
      const input = wrapper.find('input[type="file"]')
      Object.defineProperty(input.element, 'files', {
        value: [makeFile()],
        configurable: true,
      })
      await input.trigger('change')

      const buttons = wrapper.findAll('button')
      const validateBtn = buttons.find((b) => b.text().includes('Validate'))!
      await validateBtn.trigger('click')

      expect(wrapper.text()).toContain('Validating')
    })

    it('redirects to instructor-uploads with uploadId on success', async () => {
      vi.mocked(uploadCsv).mockResolvedValue({ uploadId: 'UP-TEST01' })
      const pushSpy = vi.spyOn(testRouter, 'push').mockResolvedValue(undefined as never)
      const wrapper = mountView()
      const input = wrapper.find('input[type="file"]')
      Object.defineProperty(input.element, 'files', {
        value: [makeFile()],
        configurable: true,
      })
      await input.trigger('change')

      const buttons = wrapper.findAll('button')
      const validateBtn = buttons.find((b) => b.text().includes('Validate'))!
      await validateBtn.trigger('click')
      await flushPromises()

      expect(pushSpy).toHaveBeenCalledWith({
        name: 'instructor-uploads',
        query: { uploadId: 'UP-TEST01' },
      })
      pushSpy.mockRestore()
    })
  })
})
