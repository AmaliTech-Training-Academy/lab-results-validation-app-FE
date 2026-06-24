import type { InstructorDashboardData, MyUpload, AssignedModule, Tone } from '@/types/dashboard.types'
import type { TemplateData } from '@/types/instructor.types'
import type { ValidationReport, CsvUploadError, CsvUploadEntry, PagedCsvUploads } from '@/types/report.types'
import { BulkImportError } from '@/types/bulk.types'
import type { BulkRowError } from '@/types/bulk.types'
import { http, parseHttpError } from './http'
import { getAllLabsByModule } from './reference.service'
import type { Lab } from '@/types/reference.types'

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

const fmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

function deriveUploadTone(status: string): Tone {
  const s = status.toUpperCase()
  if (s === 'COMPLETED' || s === 'SUCCESS') return 'success'
  if (s === 'PARTIAL') return 'warning'
  return 'danger'
}

function deriveUploadLabel(status: string): string {
  const s = status.toUpperCase()
  if (s === 'COMPLETED' || s === 'SUCCESS') return 'Success'
  if (s === 'PARTIAL') return 'Partial Success'
  return 'Failed'
}

function mapUploadEntry(entry: CsvUploadEntry): MyUpload {
  return {
    file:       entry.filename,
    date:       fmt.format(new Date(entry.uploadedAt)),
    uploadedAt: entry.uploadedAt,
    totalRows:  entry.totalRows,
    accepted:   entry.acceptedRows,
    rejected:   entry.rejectedRows,
    tone:       deriveUploadTone(entry.status),
    status:     deriveUploadLabel(entry.status),
    hasReport:  true,
    uploadId:   entry.id,
  }
}

export async function getModuleLabResults(moduleId: string): Promise<LabResultItem[]> {
  const result = await http.get<LabResultItem[] | { content: LabResultItem[] }>(`/lab-results/modules/${moduleId}`)
  return Array.isArray(result) ? result : (result.content ?? [])
}

export async function getInstructorModules(instructorId: string): Promise<AssignedModule[]> {
  const response = await http.get<PagedModuleItems>(`/admin/instructors/${instructorId}/modules`)
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

export interface InstructorModuleLabs {
  moduleId: string
  moduleName: string
  specializationName: string
  labs: Lab[]
}

export async function getInstructorModulesWithLabs(instructorId: string): Promise<InstructorModuleLabs[]> {
  const response = await http.get<PagedModuleItems>(`/admin/instructors/${instructorId}/modules`)
  const items = response.content ?? []

  if (items.length === 0) return []

  const labResults = await Promise.all(
    items.map((m) => getAllLabsByModule(m.moduleId)),
  )

  return items.map((m, i) => ({
    moduleId: m.moduleId,
    moduleName: m.moduleName,
    specializationName: m.specializationName,
    labs: labResults[i] ?? [],
  }))
}

export async function downloadLabTemplate(labId: string): Promise<string> {
  const token = localStorage.getItem('auth_token')
  const headers: HeadersInit = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}/lab-results/template/${labId}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(parseHttpError(res.status, errText))
  }

  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = disposition.match(/filename[^;=\n]*=(['"]?)([^'";\n]+)\1/)
  const filename = match?.[2]?.trim() ?? `lab-${labId}-template.csv`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)

  return filename
}

export async function getInstructorDashboard(): Promise<InstructorDashboardData> {
  const paged = await getMyUploads(0, 5)
  return { modules: [], recentUploads: paged.content }
}

export async function getTemplateData(): Promise<TemplateData> {
  return MOCK_TEMPLATE
}

export interface PagedMyUploads {
  content: MyUpload[]
  page: number
  totalPages: number
  totalElements: number
  last: boolean
}

export interface MyUploadFilters {
  startDate?: string
  endDate?: string
  status?: string
  search?: string
}

export async function getMyUploads(page = 0, size = 10, filters: MyUploadFilters = {}): Promise<PagedMyUploads> {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate)   params.set('endDate',   filters.endDate)
  if (filters.status)    params.set('status',    filters.status)
  if (filters.search)    params.set('search',    filters.search)
  const paged = await http.get<PagedCsvUploads>(`/lab-results/uploads?${params}`)
  return {
    content:       (paged.content ?? []).map(mapUploadEntry),
    page:          paged.page,
    totalPages:    paged.totalPages,
    totalElements: paged.totalElements,
    last:          paged.last,
  }
}

interface LabUploadReport {
  uploadId:      string
  status:        string
  totalRows:     number
  insertedCount: number
  updatedCount:  number
  rejectedCount: number
  skippedCount:  number
  filename?:     string
  uploadedAt?:   string
  errors?:       CsvUploadError[]
}

export async function getUploadReport(uploadId: string, meta?: { filename?: string; uploadedAt?: string }): Promise<ValidationReport> {
  const report = await http.get<LabUploadReport>(`/lab-results/uploads/${uploadId}`)
  return {
    uploadId,
    filename:    report.filename  ?? meta?.filename  ?? '',
    uploadedAt:  report.uploadedAt ?? meta?.uploadedAt ?? '',
    totalRows:   report.totalRows,
    accepted:    (report.insertedCount ?? 0) + (report.updatedCount ?? 0),
    rejected:    report.rejectedCount ?? 0,
    rejectedRows: (report.errors ?? []).map((e) => ({
      row:     e.rowNumber,
      email:   '',
      field:   e.field  ?? '—',
      ruleId:  e.rule   ?? '—',
      message: e.message,
    })),
  }
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

  let json: Record<string, unknown> | null = null
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null
  } catch {
    // response body is not JSON (e.g. HTML gateway error)
    throw new Error(parseHttpError(res.status, ''))
  }

  if (json && 'data' in json && 'success' in json) {
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
        typeof data.uploadId === 'string' ? data.uploadId : undefined,
      )
    }
    return envelope.data as { uploadId: string }
  }

  if (!res.ok) throw new Error(parseHttpError(res.status, text))
  return (json ?? {}) as { uploadId: string }
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
  if (!res.ok) throw new Error(parseHttpError(res.status, text))

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
    throw new Error(parseHttpError(res.status, errText))
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
