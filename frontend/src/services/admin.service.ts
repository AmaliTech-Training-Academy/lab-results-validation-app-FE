import { http } from '@/services/http'
import type { AdminDashboardData } from '@/types/dashboard.types'
import type { AuditEntry, CsvUploadEntry, CsvUploadErrorReport, PagedCsvUploads, ValidationReport } from '@/types/report.types'

// ---------------------------------------------------------------------------
// Mock data — DELETE and replace service bodies when wiring the real API
// ---------------------------------------------------------------------------
const MOCK_DASHBOARD: AdminDashboardData = {
  stats: [
    {
      label: 'Cohorts',
      value: '6',
      chipIcon: 'graduation-cap',
      chipBg: '#FFE9E3',
      chipFg: '#A83900',
      footDot: '#1A6B3C',
      footText: '4 Active · 2 Completed',
    },
    {
      label: 'Learners',
      value: '142',
      chipIcon: 'user',
      chipBg: '#CAE6FF',
      chipFg: '#08283B',
      footDot: '#1A6B3C',
      footText: '138 Active · 4 Archived',
    },
    {
      label: 'Instructors',
      value: '8',
      chipIcon: 'id-card',
      chipBg: '#FDF0D5',
      chipFg: '#7A4A00',
      footDot: '#1A6B3C',
      footText: '7 Active',
    },
  ],

  recentUploads: [
    { instructor: 'Sarah Jenkins',   file: 'js_fundamentals_w3.csv',    accepted: 28, rejected: 0,  tone: 'success', status: 'Completed' },
    { instructor: 'Marcus Chen',     file: 'react_hooks_lab2.csv',      accepted: 21, rejected: 7,  tone: 'warning', status: 'Partial'   },
    { instructor: 'Elena Rodriguez', file: 'node_rest_api_w4.csv',      accepted: 34, rejected: 0,  tone: 'success', status: 'Completed' },
    { instructor: 'Marcus Chen',     file: 'db_design_corrections.csv', accepted: 19, rejected: 3,  tone: 'warning', status: 'Partial'   },
    { instructor: 'David Osei',      file: 'ts_generics_final.csv',     accepted: 25, rejected: 0,  tone: 'success', status: 'Completed' },
  ],

  attentionItems: [
    {
      instructor: 'James Wilson',
      file: 'algorithms_cohortB_w2.csv',
      pct: '78% Rejected',
      detail: '5 Accepted / 18 Rejected',
    },
    {
      instructor: 'Anita Mensah',
      file: 'sql_joins_lab_raw.csv',
      pct: '60% Rejected',
      detail: '12 Accepted / 18 Rejected',
    },
  ],
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
// ---------------------------------------------------------------------------

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  // TODO: replace with → return http.get<AdminDashboardData>('/admin/dashboard')
  await delay(300)
  return MOCK_DASHBOARD
}

// ---------------------------------------------------------------------------
// Audit log + validation report mock data
// ---------------------------------------------------------------------------
const MOCK_AUDIT: AuditEntry[] = [
  { id: 'UP-8F2A9…', instructor: 'Dr. Alan Grant',    file: 'lab_results_q3.csv',            uploadedAt: 'Oct 24, 09:41 AM', totalRows: 1240, accepted: 1240, rejected: 0,    status: 'success', statusLabel: 'Completed' },
  { id: 'UP-4D7E2…', instructor: 'Dr. Ellie Sattler', file: 'botany_extract_v2.xlsx',         uploadedAt: 'Oct 23, 14:22 PM', totalRows: 850,  accepted: 812,  rejected: 38,   status: 'warning', statusLabel: 'Partial'   },
  { id: 'UP-9C1B4…', instructor: 'Dr. Ian Malcolm',   file: 'chaos_theory_sim_final.csv',     uploadedAt: 'Oct 23, 11:05 AM', totalRows: 5000, accepted: 0,    rejected: 5000, status: 'danger',  statusLabel: 'Failed'    },
  { id: 'UP-2A5F8…', instructor: 'Dr. Henry Wu',      file: 'genetics_batch_04.csv',          uploadedAt: 'Oct 22, 16:45 PM', totalRows: 3200, accepted: 3200, rejected: 0,    status: 'success', statusLabel: 'Completed' },
  { id: 'UP-7E3B1…', instructor: 'Dr. Alan Grant',    file: 'excavation_logs_site_b.xlsx',    uploadedAt: 'Oct 21, 08:15 AM', totalRows: 450,  accepted: 448,  rejected: 2,    status: 'warning', statusLabel: 'Partial'   },
]


export async function getAuditLog(): Promise<AuditEntry[]> {
  // TODO: replace with → return http.get<AuditEntry[]>('/admin/reports/audit')
  await delay(300)
  return MOCK_AUDIT
}

export interface CsvUploadFilters {
  startDate?: string
  endDate?: string
  uploadedByEmail?: string
  status?: string
  search?: string
}

export async function getCsvUploads(page = 0, size = 10, filters: CsvUploadFilters = {}): Promise<PagedCsvUploads> {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (filters.startDate)       params.set('startDate',       filters.startDate)
  if (filters.endDate)         params.set('endDate',         filters.endDate)
  if (filters.uploadedByEmail) params.set('uploadedByEmail', filters.uploadedByEmail)
  if (filters.status)          params.set('status',          filters.status)
  if (filters.search)          params.set('search',          filters.search)
  return http.get<PagedCsvUploads>(`/admin/csv-uploads?${params.toString()}`)
}

export async function getUploadReport(uploadId: string): Promise<ValidationReport> {
  const [details, errorReport] = await Promise.all([
    http.get<CsvUploadEntry>(`/admin/csv-uploads/${uploadId}`),
    http.get<CsvUploadErrorReport>(`/admin/csv-uploads/${uploadId}/error-report`),
  ])

  return {
    uploadId,
    filename:    details.filename,
    uploadedAt:  details.uploadedAt,
    totalRows:   details.totalRows,
    accepted:    details.acceptedRows,
    rejected:    details.rejectedRows,
    rejectedRows: errorReport.errors.map((e) => ({
      row:    e.rowNumber,
      email:  '',
      field:  e.field   ?? '—',
      ruleId: e.rule    ?? '—',
      message: e.message,
    })),
  }
}

export async function downloadCorrectionsCsv(uploadId: string, fallbackFilename = 'corrections.csv'): Promise<void> {
  const token = localStorage.getItem('auth_token')
  const headers: HeadersInit = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`/api/v1/lab-results/uploads/${uploadId}/corrections`, {
    method: 'GET',
    headers,
    credentials: 'include',
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    let message = `HTTP ${res.status}`
    if (errText) {
      try {
        const errJson = JSON.parse(errText) as Record<string, unknown>
        if (typeof errJson.message === 'string') message = errJson.message
      } catch { message = errText || message }
    }
    throw new Error(message)
  }

  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = disposition.match(/filename[^;=\n]*=(['"]?)([^'";\n]+)\1/)
  const filename = match?.[2]?.trim() ?? fallbackFilename

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
