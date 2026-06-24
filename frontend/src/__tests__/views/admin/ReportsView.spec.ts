import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia } from 'pinia'
import ReportsView from '@/views/admin/ReportsView.vue'
import { getCsvUploads, getUploadReport } from '@/services/admin.service'
import { getInstructors } from '@/services/user.service'
import type { CsvUploadEntry, PagedCsvUploads, ValidationReport } from '@/types/report.types'
import type { PagedInstructors } from '@/types/user.types'

vi.mock('@/services/admin.service', () => ({
  getCsvUploads:         vi.fn<() => Promise<PagedCsvUploads>>(),
  getUploadReport:       vi.fn<(id: string) => Promise<ValidationReport>>(),
  downloadCorrectionsCsv: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}))

vi.mock('@/services/user.service', () => ({
  getInstructors: vi.fn<() => Promise<PagedInstructors>>().mockResolvedValue({
    content: [], totalElements: 0, page: 0, size: 200, totalPages: 1, last: true,
  }),
}))

const MOCK_ENTRY: CsvUploadEntry = {
  id: 'UP-ABC123',
  uploadedByEmail: 'jane.doe@example.com',
  filename: 'result.csv',   // ≤ 10 chars — truncateFilename leaves it unchanged
  fileSha256: 'abc123',
  uploadedAt: '2024-10-24T09:41:00Z',
  totalRows: 22,
  acceptedRows: 19,
  rejectedRows: 3,
  status: 'PARTIAL',
  createdAt: '2024-10-24T09:41:00Z',
  updatedAt: '2024-10-24T09:41:00Z',
}

const MOCK_PAGE: PagedCsvUploads = {
  content: [MOCK_ENTRY],
  page: 0,
  size: 10,
  totalElements: 1,
  totalPages: 1,
  last: true,
}

const MOCK_REPORT: ValidationReport = {
  uploadId:    'UP-ABC123',
  filename:    'result.csv',
  uploadedAt:  '2024-10-24T09:41:00Z',
  totalRows:   22,
  accepted:    19,
  rejected:    3,
  rejectedRows: [
    { row: 4, email: '', field: 'score', ruleId: 'V5', message: 'Score exceeds max.' },
  ],
}

const testRouter = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { template: '<div/>' } }],
})

function mountView() {
  vi.mocked(getCsvUploads).mockResolvedValue(MOCK_PAGE)
  vi.mocked(getUploadReport).mockResolvedValue(MOCK_REPORT)
  return mount(ReportsView, {
    global: { plugins: [createPinia(), testRouter] },
  })
}

describe('ReportsView', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('list view', () => {
    it('renders the "Audit log" heading', async () => {
      const wrapper = mountView()
      await flushPromises()
      expect(wrapper.find('h1').text()).toBe('Audit log')
    })

    it('renders a row for each upload entry', async () => {
      const wrapper = mountView()
      await flushPromises()
      expect(wrapper.text()).toContain('result.csv')
      expect(wrapper.text()).toContain('Jane Doe')
    })

    it('shows the entry status label', async () => {
      const wrapper = mountView()
      await flushPromises()
      expect(wrapper.text()).toContain('Partial')
    })

    it('shows error state with retry button when load fails', async () => {
      vi.mocked(getCsvUploads).mockRejectedValue(new Error('network error'))
      const wrapper = mount(ReportsView, {
        global: { plugins: [createPinia(), testRouter] },
      })
      await flushPromises()
      expect(wrapper.text()).toContain('Could not load audit log')
      expect(wrapper.find('button[class*="btn"]').exists()).toBe(true)
    })

    it('retry button reloads data', async () => {
      vi.mocked(getCsvUploads).mockRejectedValueOnce(new Error('network'))
      vi.mocked(getCsvUploads).mockResolvedValue(MOCK_PAGE)
      const wrapper = mount(ReportsView, {
        global: { plugins: [createPinia(), testRouter] },
      })
      await flushPromises()
      expect(wrapper.text()).toContain('Could not load audit log')

      const retryBtn = wrapper.findAll('button').find((b) => b.text().includes('Try again'))!
      await retryBtn.trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('result.csv')
    })

    it('renders a "Details" link for each entry', async () => {
      const wrapper = mountView()
      await flushPromises()
      const detailLinks = wrapper.findAll('button.link').filter((b) => b.text() === 'Details')
      expect(detailLinks).toHaveLength(1)
    })
  })

  describe('pagination', () => {
    it('shows the entry count summary', async () => {
      const wrapper = mountView()
      await flushPromises()
      expect(wrapper.text()).toContain('1 entries')
    })

    it('disables the previous button on page 0', async () => {
      const wrapper = mountView()
      await flushPromises()
      const prevBtn = wrapper.find('button[aria-label="Previous"]')
      expect(prevBtn.attributes('disabled')).toBeDefined()
    })

    it('disables the next button on the last page', async () => {
      const wrapper = mountView()
      await flushPromises()
      const nextBtn = wrapper.find('button[aria-label="Next"]')
      expect(nextBtn.attributes('disabled')).toBeDefined()
    })

    it('calls getCsvUploads with page 1 when next is clicked on a multi-page result', async () => {
      vi.mocked(getCsvUploads).mockResolvedValue({
        ...MOCK_PAGE, totalPages: 3, totalElements: 25, last: false,
      })
      const wrapper = mount(ReportsView, {
        global: { plugins: [createPinia(), testRouter] },
      })
      await flushPromises()

      vi.mocked(getCsvUploads).mockClear()
      const nextBtn = wrapper.find('button[aria-label="Next"]')
      await nextBtn.trigger('click')
      await flushPromises()

      expect(vi.mocked(getCsvUploads)).toHaveBeenCalledWith(1, 10, expect.any(Object))
    })
  })

  describe('filters', () => {
    it('renders the status filter select', async () => {
      const wrapper = mountView()
      await flushPromises()
      const select = wrapper.find('select.status-select')
      expect(select.exists()).toBe(true)
    })

    it('shows clear filters button when a filter is active', async () => {
      const wrapper = mountView()
      await flushPromises()
      // second .status-select is the status dropdown
      const statusSelect = wrapper.findAll('select.status-select')[1]!
      await statusSelect.setValue('PARTIAL')
      await flushPromises()
      expect(wrapper.text()).toContain('Clear')
    })

    it('calls getCsvUploads with status filter when status changes', async () => {
      const wrapper = mountView()
      await flushPromises()
      vi.mocked(getCsvUploads).mockClear()

      // second .status-select is the status dropdown (first is instructor filter)
      const selects = wrapper.findAll('select.status-select')
      const statusSelect = selects[1]!
      await statusSelect.setValue('COMPLETED')
      await flushPromises()

      expect(vi.mocked(getCsvUploads)).toHaveBeenCalledWith(0, 10, expect.objectContaining({ status: 'COMPLETED' }))
    })
  })

  describe('report view', () => {
    it('switches to report view when "Details" is clicked', async () => {
      const wrapper = mountView()
      await flushPromises()
      const detailBtn = wrapper.findAll('button.link').find((b) => b.text() === 'Details')!
      await detailBtn.trigger('click')
      await flushPromises()
      expect(wrapper.find('h1').text()).toBe('Validation report')
    })

    it('renders total, accepted, and rejected summary cards', async () => {
      const wrapper = mountView()
      await flushPromises()
      const detailBtn = wrapper.findAll('button.link').find((b) => b.text() === 'Details')!
      await detailBtn.trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('TOTAL ROWS EVALUATED')
      expect(wrapper.text()).toContain('ACCEPTED')
      expect(wrapper.text()).toContain('REJECTED')
    })

    it('renders the filename in the report header', async () => {
      const wrapper = mountView()
      await flushPromises()
      const detailBtn = wrapper.findAll('button.link').find((b) => b.text() === 'Details')!
      await detailBtn.trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('result.csv')
    })

    it('renders rejected row entries', async () => {
      const wrapper = mountView()
      await flushPromises()
      const detailBtn = wrapper.findAll('button.link').find((b) => b.text() === 'Details')!
      await detailBtn.trigger('click')
      await flushPromises()
      const rows = wrapper.findAll('tbody tr')
      expect(rows.length).toBeGreaterThanOrEqual(MOCK_REPORT.rejectedRows.length)
    })

    it('back button returns to list view', async () => {
      const wrapper = mountView()
      await flushPromises()
      const detailBtn = wrapper.findAll('button.link').find((b) => b.text() === 'Details')!
      await detailBtn.trigger('click')
      await flushPromises()

      const backBtn = wrapper.findAll('button.link').find((b) => b.text().includes('Back to audit log'))!
      await backBtn.trigger('click')
      expect(wrapper.find('h1').text()).toBe('Audit log')
    })
  })
})
