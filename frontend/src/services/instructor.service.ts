import type { InstructorDashboardData, MyUpload, AssignedModule } from '@/types/dashboard.types'
import type { TemplateData } from '@/types/instructor.types'
import type { ValidationReport } from '@/types/report.types'
import { BulkImportError } from '@/types/bulk.types'
import type { BulkRowError } from '@/types/bulk.types'
import { http } from './http'

export { BulkImportError }

const BASE_URL = '/api/v1'

interface InstructorModuleItem {
  moduleId: string
  moduleName: string
  specializationName: string
}

interface PagedModuleItems {
  content: InstructorModuleItem[]
}

export interface LabResultItem {
  id: string
  learnerEmail: string
  learnerName: string
  labId: string
  labTitle: string
  score: number
  maxScoreSnapshot: number
  attemptNumber: number
  submittedOn: string
  gradedBy: string
}

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
    { name: 'graded_by',       desc: 'Optional qualitative feedback / instructor name.',            req: true  },
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

export async function getModuleLabResults(moduleId: string): Promise<LabResultItem[]> {
  // Short TTL: this is called once per assigned module by getInstructorModules() below just to count
  // rows, so caching collapses repeat dashboard visits without risking a long-stale submission count.
  const result = await http.get<LabResultItem[] | { content: LabResultItem[] }>(`/lab-results/modules/${moduleId}`, {
    ttl: 15_000,
  })
  return Array.isArray(result) ? result : (result.content ?? [])
}

export async function getInstructorModules(instructorId: string): Promise<AssignedModule[]> {
  const response = await http.get<PagedModuleItems>(`/admin/instructors/${instructorId}/modules`, { ttl: 15_000 })
  const items = response.content ?? []

  const counts = await Promise.allSettled(
    items.map((m) => getModuleLabResults(m.moduleId)),
  )

  return items.map((m, i) => ({
    name: m.moduleName,
    cohort: '',
    specialization: m.specializationName,
    submitted: counts[i]?.status === 'fulfilled' ? counts[i].value.length : 0,
  }))
}

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
  const token = localStorage.getItem('auth_token')
  const headers: HeadersInit = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${BASE_URL}/lab-results/bulk`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  })

  const text = await res.text().catch(() => '')
  if (!text) throw new Error(`HTTP ${res.status}`)

  const json = JSON.parse(text) as Record<string, unknown>
  if ('data' in json && 'success' in json) {
    interface BulkData {
      errors?: Array<{ rowNumber?: number; field?: string; message?: string }>
      insertedCount?: number
      updatedCount?: number
      rejectedCount?: number
      uploadId?: string
    }
    const envelope = json as { success: boolean; message: string; data: BulkData }
    if (!envelope.success) {
      const data = envelope.data ?? {}
      const rowErrors: BulkRowError[] = (data.errors ?? []).map((e) => ({
        row: typeof e.rowNumber === 'number' ? e.rowNumber : undefined,
        field: typeof e.field === 'string' ? e.field : undefined,
        message: typeof e.message === 'string' ? e.message : '',
      }))
      const inserted = (data.insertedCount ?? 0) + (data.updatedCount ?? 0)
      throw new BulkImportError(
        envelope.message || 'Upload failed',
        rowErrors,
        inserted > 0 ? inserted : undefined,
        data.rejectedCount,
      )
    }
    return envelope.data as { uploadId: string }
  }

  if (!res.ok) {
    const message = typeof json.message === 'string' ? json.message : text
    throw new Error(message || `HTTP ${res.status}`)
  }
  return json as { uploadId: string }
}

export async function fetchLabResultsTemplateHeaders(): Promise<string[]> {
  const token = localStorage.getItem('auth_token')
  const headers: HeadersInit = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}/lab-results/template`, {
    method: 'GET',
    headers,
    credentials: 'include',
  })

  const text = await res.text().catch(() => '')
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    if (text) {
      try {
        const errJson = JSON.parse(text) as Record<string, unknown>
        if (typeof errJson.message === 'string') message = errJson.message
      } catch { message = text || message }
    }
    throw new Error(message)
  }

  const firstLine = text.split(/\r?\n/)[0] ?? ''
  return firstLine.split(',').map((col) => col.replace(/^"|"$/g, '').trim()).filter(Boolean)
}

export async function downloadLabResultsTemplate(): Promise<void> {
  const token = localStorage.getItem('auth_token')
  const headers: HeadersInit = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}/lab-results/template`, {
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
  const filename = match?.[2]?.trim() ?? 'lab-results-template.csv'

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
