import type { AdminDashboardData } from '@/types/dashboard.types'
import type { AuditEntry, ValidationReport } from '@/types/report.types'

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

const MOCK_REPORT: ValidationReport = {
  uploadId: 'UP-4D7E2…',
  filename: 'lab_results_batch_Q3_final.csv',
  uploadedAt: 'Oct 24, 2023 at 14:32 PST',
  totalRows: 48,
  accepted: 43,
  rejected: 5,
  rejectedRows: [
    { row: 12, email: 'j.doe@example.com',          field: 'completion_date', ruleId: 'VAL-DATE-01', message: 'Invalid date format. Expected YYYY-MM-DD.'         },
    { row: 18, email: 'smith.a@domain.org',          field: 'score_module_1', ruleId: 'VAL-NUM-03',  message: 'Value exceeds maximum allowed score of 100.'       },
    { row: 24, email: 'williams_r@university.edu',   field: 'instructor_id',  ruleId: 'VAL-REQ-01',  message: 'Required field is missing or empty.'               },
    { row: 41, email: 'invalid.email@',              field: 'learner_email',  ruleId: 'VAL-FMT-02',  message: 'Malformed email address string.'                   },
  ],
}

export async function getAuditLog(): Promise<AuditEntry[]> {
  // TODO: replace with → return http.get<AuditEntry[]>('/admin/reports/audit')
  await delay(300)
  return MOCK_AUDIT
}

export async function getUploadReport(uploadId: string): Promise<ValidationReport> {
  // TODO: replace with → return http.get<ValidationReport>(`/admin/reports/${uploadId}`)
  await delay(200)
  return { ...MOCK_REPORT, uploadId }
}
