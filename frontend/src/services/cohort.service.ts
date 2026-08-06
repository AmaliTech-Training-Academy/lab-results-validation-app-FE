import type { CohortRow, CreateCohortPayload, UpdateCohortPayload, PagedCohorts } from '@/types/cohort.types'
import { BulkImportError } from '@/types/bulk.types'
import type { BulkRowError } from '@/types/bulk.types'
import { http } from './http'

export { BulkImportError }

const BASE_URL = '/api/v1'

export async function getCohorts(page = 0, size = 10): Promise<PagedCohorts> {
  return http.get<PagedCohorts>(`/admin/cohorts?page=${page}&size=${size}`)
}

export async function createCohort(payload: CreateCohortPayload): Promise<CohortRow> {
  return http.post<CohortRow>('/admin/cohorts', payload)
}

export async function updateCohort(id: string, payload: UpdateCohortPayload): Promise<CohortRow> {
  return http.patch<CohortRow>(`/admin/cohorts/${id}`, payload)
}

export async function toggleCohortActive(id: string, active: boolean): Promise<void> {
  return http.patch(`/admin/cohorts/${id}`, { active })
}

export async function lockCohort(id: string): Promise<void> {
  return http.patch<void>(`/admin/cohorts/${id}/lock`)
}

export async function unlockCohort(id: string): Promise<void> {
  return http.patch<void>(`/admin/cohorts/${id}/unlock`)
}

export async function uploadProgramStructureBulk(file: File): Promise<void> {
  const token = localStorage.getItem('auth_token')
  const headers: HeadersInit = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${BASE_URL}/admin/program-structure/upload`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  })

  const text = await res.text().catch(() => '')

  interface BulkUploadResponse {
    specializationsCreated?: number
    modulesCreated?: number
    labsCreated?: number
    errors?: Array<{ rowNumber?: number; field?: string; message?: string }>
  }

  let bulk: BulkUploadResponse | null = null
  let envelopeMessage: string | undefined
  if (text) {
    try {
      const json = JSON.parse(text) as Record<string, unknown>
      if (typeof json.message === 'string') envelopeMessage = json.message
      bulk = (json.data ?? json) as BulkUploadResponse
    } catch { /* fall through */ }
  }

  if (bulk?.errors && bulk.errors.length > 0) {
    const rowErrors: BulkRowError[] = bulk.errors.map((e) => ({
      row: typeof e.rowNumber === 'number' ? e.rowNumber : undefined,
      field: typeof e.field === 'string' ? e.field : undefined,
      message: typeof e.message === 'string' ? e.message : '',
    }))
    throw new BulkImportError(
      `${bulk.errors.length} row${bulk.errors.length !== 1 ? 's' : ''} failed validation.`,
      rowErrors,
    )
  }

  if (!res.ok) {
    throw new BulkImportError(envelopeMessage ?? text ?? `HTTP ${res.status}`, [])
  }
}

export async function fetchProgramStructureTemplateHeaders(): Promise<string[]> {
  const token = localStorage.getItem('auth_token')
  const headers: HeadersInit = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}/admin/program-structure/template`, {
    method: 'GET',
    headers,
    credentials: 'include',
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const text = await res.text()
  const firstLine = text.split(/\r?\n/)[0] ?? ''
  return firstLine.split(',').map((col) => col.replace(/^"|"$/g, '').trim()).filter(Boolean)
}

export async function downloadProgramStructureTemplate(): Promise<void> {
  const token = localStorage.getItem('auth_token')
  const headers: HeadersInit = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}/admin/program-structure/template`, {
    method: 'GET',
    headers,
    credentials: 'include',
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = disposition.match(/filename[^;=\n]*=(['"]?)([^'";\n]+)\1/)
  const filename = match?.[2]?.trim() ?? 'program-structure-template.csv'

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
