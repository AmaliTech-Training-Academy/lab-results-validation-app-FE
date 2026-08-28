import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia } from 'pinia'
import MyUploadsView from '@/views/instructor/MyUploadsView.vue'
import { getMyUploads, getUploadReport } from '@/services/instructor.service'
import type { MyUpload } from '@/types/dashboard.types'
import type { ValidationReport } from '@/types/report.types'

vi.mock('@/services/instructor.service', () => ({
  getMyUploads:    vi.fn<() => Promise<MyUpload[]>>(),
  getUploadReport: vi.fn<(id: string) => Promise<ValidationReport>>(),
}))

const MOCK_UPLOADS: MyUpload[] = [
  { file: 'results_oct.csv', date: 'Oct 24, 2024', accepted: 19, rejected: 3, tone: 'warning', status: 'Partial Success', hasReport: true,  uploadId: 'UP-AAA111' },
  { file: 'results_sep.csv', date: 'Sep 30, 2024', accepted: 22, rejected: 0, tone: 'success', status: 'Success',         hasReport: false },
]

const MOCK_REPORT: ValidationReport = {
  uploadId:    'UP-AAA111',
  filename:    'results_oct.csv',
  uploadedAt:  'Oct 24, 2024 at 09:41 AM',
  totalRows:   22,
  accepted:    19,
  rejected:    3,
  rejectedRows: [
    { row: 4,  email: 'a@test.org', field: 'score',          ruleId: 'V5', message: 'Score exceeds max.'   },
    { row: 11, email: 'b@test.org', field: 'submitted_on',   ruleId: 'V7', message: 'Invalid date format.' },
    { row: 19, email: 'c@test.org', field: 'attempt_number', ruleId: 'V6', message: 'Must be 1 or 2.'     },
  ],
}

async function mountView(query: Record<string, string> = {}) {
  vi.mocked(getMyUploads).mockResolvedValue(MOCK_UPLOADS)
  vi.mocked(getUploadReport).mockResolvedValue(MOCK_REPORT)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/instructor/uploads', name: 'instructor-uploads', component: { template: '<div/>' } },
      { path: '/instructor/upload',  name: 'instructor-upload',  component: { template: '<div/>' } },
    ],
  })

  const search = new URLSearchParams(query).toString()
  await router.push(`/instructor/uploads${search ? '?' + search : ''}`)

  const wrapper = mount(MyUploadsView, { global: { plugins: [createPinia(), router] } })
  return { wrapper, router }
}

describe('MyUploadsView', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('list view (no uploadId query)', () => {
    it('renders "My uploads" heading', async () => {
      const { wrapper } = await mountView()
      await flushPromises()
      expect(wrapper.find('h1').text()).toBe('My uploads')
    })

    it('renders a row for each upload', async () => {
      const { wrapper } = await mountView()
      await flushPromises()
      expect(wrapper.text()).toContain('results_oct.csv')
      expect(wrapper.text()).toContain('results_sep.csv')
    })

    it('renders "View report →" only for uploads with a report and uploadId', async () => {
      const { wrapper } = await mountView()
      await flushPromises()
      const reportLinks = wrapper.findAll('.link').filter((l) => l.text().includes('View report'))
      expect(reportLinks).toHaveLength(1)
    })

    it('shows a dash for uploads without a report', async () => {
      const { wrapper } = await mountView()
      await flushPromises()
      expect(wrapper.text()).toContain('—')
    })
  })

  describe('detail view (uploadId query present)', () => {
    it('calls getUploadReport with the query uploadId', async () => {
      await mountView({ uploadId: 'UP-AAA111' })
      await flushPromises()
      expect(vi.mocked(getUploadReport)).toHaveBeenCalledWith('UP-AAA111')
    })

    it('renders "Validation report" heading', async () => {
      const { wrapper } = await mountView({ uploadId: 'UP-AAA111' })
      await flushPromises()
      expect(wrapper.find('h1').text()).toBe('Validation report')
    })

    it('renders the filename in the report header', async () => {
      const { wrapper } = await mountView({ uploadId: 'UP-AAA111' })
      await flushPromises()
      expect(wrapper.text()).toContain('results_oct.csv')
    })

    it('renders total, accepted, and rejected summary cards', async () => {
      const { wrapper } = await mountView({ uploadId: 'UP-AAA111' })
      await flushPromises()
      expect(wrapper.text()).toContain('TOTAL ROWS EVALUATED')
      expect(wrapper.text()).toContain('ACCEPTED')
      expect(wrapper.text()).toContain('REJECTED')
    })

    it('renders all rejected row entries', async () => {
      const { wrapper } = await mountView({ uploadId: 'UP-AAA111' })
      await flushPromises()
      const rows = wrapper.findAll('tbody tr')
      expect(rows.length).toBeGreaterThanOrEqual(MOCK_REPORT.rejectedRows.length)
    })

    it('renders the partial commit callout', async () => {
      const { wrapper } = await mountView({ uploadId: 'UP-AAA111' })
      await flushPromises()
      expect(wrapper.text()).toContain('Partial commit status')
    })
  })

  describe('back navigation', () => {
    it('clears the uploadId query param and returns to the uploads list when back link is clicked', async () => {
      const { wrapper, router } = await mountView({ uploadId: 'UP-AAA111' })
      await flushPromises()
      expect(wrapper.find('h1').text()).toBe('Validation report')

      const backLink = wrapper.find('.link')
      await backLink.trigger('click')
      await flushPromises()

      expect(router.currentRoute.value.query.uploadId).toBeUndefined()
      expect(wrapper.find('h1').text()).toBe('My uploads')
    })
  })
})
