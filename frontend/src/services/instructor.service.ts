import type { InstructorDashboardData, MyUpload } from '@/types/dashboard.types'
import type { TemplateData } from '@/types/instructor.types'
import type { ValidationReport } from '@/types/report.types'

// ---------------------------------------------------------------------------
// Mock data — DELETE and replace service bodies when wiring the real API
// ---------------------------------------------------------------------------
const MOCK_DASHBOARD: InstructorDashboardData = {
  modules: [
    {
      name: 'React & Component Design',
      cohort: 'GTP 2024-A',
      specialization: 'Frontend Development',
      submitted: 22,
    },
    {
      name: 'Node.js & REST APIs',
      cohort: 'GTP 2024-B',
      specialization: 'Backend Engineering',
      submitted: 17,
    },
  ],

  recentUploads: [
    { file: 'react_state_lab_oct.csv',    date: 'Oct 24, 2024', accepted: 19, rejected: 3,  tone: 'warning', status: 'Partial Success', hasReport: true,  uploadId: 'UP-A1B2C3' },
    { file: 'node_api_cohortB_w3.csv',    date: 'Oct 20, 2024', accepted: 17, rejected: 0,  tone: 'success', status: 'Success',         hasReport: false },
    { file: 'react_hooks_cohortA_w2.csv', date: 'Oct 15, 2024', accepted: 22, rejected: 0,  tone: 'success', status: 'Success',         hasReport: false },
    { file: 'node_express_initial.csv',   date: 'Oct 08, 2024', accepted: 0,  rejected: 21, tone: 'danger',  status: 'Failed',          hasReport: true,  uploadId: 'UP-D4E5F6' },
  ],
}

const MOCK_TEMPLATE: TemplateData = {
  filename: 'labs_results_template.csv',
  legend: [
    { lab: 'REACT_COMPONENTS_V1',   max: 100 },
    { lab: 'REACT_STATE_HOOKS',     max: 100 },
    { lab: 'REACT_ROUTING_LAB',     max: 80  },
    { lab: 'NODE_REST_API_V1',      max: 100 },
    { lab: 'NODE_AUTH_MIDDLEWARE',  max: 120 },
    { lab: 'NODE_DB_INTEGRATION',   max: 150 },
  ],
  columns: [
    { name: 'learner_email',   desc: "Must match a learner's email exactly (case-insensitive).",    req: true  },
    { name: 'lab_title',       desc: 'Exact title from the legend above.',                          req: true  },
    { name: 'score',           desc: 'Numeric score achieved. Must not exceed max score.',          req: true  },
    { name: 'submitted_on',    desc: 'Date in YYYY-MM-DD format.',                                  req: true  },
    { name: 'attempt_number',  desc: 'Integer — 1 (first) or 2 (retake).',                         req: true  },
    { name: 'graded_by',       desc: 'Optional qualitative feedback / instructor name.',            req: false },
  ],
}

const MOCK_UPLOADS: MyUpload[] = [
  { file: 'react_state_lab_oct.csv',    date: 'Oct 24, 2024', accepted: 19, rejected: 3,  tone: 'warning', status: 'Partial Success', hasReport: true,  uploadId: 'UP-A1B2C3' },
  { file: 'node_api_cohortB_w3.csv',    date: 'Oct 20, 2024', accepted: 17, rejected: 0,  tone: 'success', status: 'Success',         hasReport: false },
  { file: 'react_hooks_cohortA_w2.csv', date: 'Oct 15, 2024', accepted: 22, rejected: 0,  tone: 'success', status: 'Success',         hasReport: false },
  { file: 'node_express_initial.csv',   date: 'Oct 08, 2024', accepted: 0,  rejected: 21, tone: 'danger',  status: 'Failed',          hasReport: true,  uploadId: 'UP-D4E5F6' },
  { file: 'react_props_cohortA_w1.csv', date: 'Oct 01, 2024', accepted: 22, rejected: 0,  tone: 'success', status: 'Success',         hasReport: false },
]

const MOCK_REPORT: ValidationReport = {
  uploadId: 'UP-A1B2C3',
  filename: 'react_state_lab_oct.csv',
  uploadedAt: 'Oct 24, 2024 at 09:41 AM',
  totalRows: 22,
  accepted: 19,
  rejected: 3,
  rejectedRows: [
    { row: 4,  email: 'j.mensah@amalitechtraining.org',  field: 'score',          ruleId: 'V5',  message: 'Score 105 exceeds configured max of 100.'         },
    { row: 11, email: 'a.boateng@amalitechtraining.org', field: 'submitted_on',   ruleId: 'V7',  message: 'Invalid date format. Expected YYYY-MM-DD.'        },
    { row: 19, email: 'k.asante@amalitechtraining.org',  field: 'attempt_number', ruleId: 'V6',  message: 'Attempt number must be 1 or 2.'                   },
  ],
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
// ---------------------------------------------------------------------------

export async function getInstructorDashboard(): Promise<InstructorDashboardData> {
  // TODO: replace with → return http.get<InstructorDashboardData>('/instructor/dashboard')
  await delay(300)
  return MOCK_DASHBOARD
}

export async function getTemplateData(): Promise<TemplateData> {
  // TODO: replace with → return http.get<TemplateData>('/instructor/template')
  await delay(300)
  return MOCK_TEMPLATE
}

export async function getMyUploads(): Promise<MyUpload[]> {
  // TODO: replace with → return http.get<MyUpload[]>('/instructor/uploads')
  await delay(300)
  return MOCK_UPLOADS
}

export async function getUploadReport(uploadId: string): Promise<ValidationReport> {
  // TODO: replace with → return http.get<ValidationReport>(`/instructor/uploads/${uploadId}/report`)
  await delay(200)
  return { ...MOCK_REPORT, uploadId }
}

export async function uploadCsv(file: File): Promise<{ uploadId: string }> {
  // TODO: replace with → return http.post<{ uploadId: string }>('/instructor/uploads', { file })
  await delay(1800)
  return { uploadId: `UP-${file.name.slice(0, 4).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}` }
}
