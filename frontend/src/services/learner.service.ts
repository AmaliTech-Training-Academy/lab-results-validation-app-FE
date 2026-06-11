import type { Learner, PagedLearners, AddLearnerPayload, LearnerStatus, LearnerFilters } from '@/types/learner.types'
import { BulkImportError } from '@/types/bulk.types'
import type { BulkRowError } from '@/types/bulk.types'
import { http } from './http'

export { BulkImportError }

const BASE_URL = '/api/v1'

export async function getLearners(filters: LearnerFilters = {}): Promise<PagedLearners> {
  const params = new URLSearchParams()
  if (filters.cohortId) params.set('cohortId', filters.cohortId)
  if (filters.specializationId) params.set('specializationId', filters.specializationId)
  if (filters.status) params.set('status', filters.status)
  if (filters.search) params.set('search', filters.search)
  if (filters.page !== undefined) params.set('page', String(filters.page))
  if (filters.size !== undefined) params.set('size', String(filters.size))
  const qs = params.toString()
  return http.get<PagedLearners>(`/admin/learners${qs ? `?${qs}` : ''}`)
}

export async function addLearner(payload: AddLearnerPayload): Promise<Learner> {
  return http.post<Learner>('/admin/learners', payload)
}

export async function updateLearner(id: string, payload: AddLearnerPayload): Promise<Learner> {
  return http.put<Learner>(`/admin/learners/${id}`, payload)
}

export async function setLearnerStatus(id: string, status: LearnerStatus): Promise<void> {
  return http.patch(`/admin/learners/${id}/status`, { status })
}

export async function uploadLearnersBulk(file: File): Promise<void> {
  const token = localStorage.getItem('auth_token')
  const headers: HeadersInit = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${BASE_URL}/admin/learners/bulk`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  })

  // Always read the body — the API returns a BulkUploadResponse even on partial/full failure
  const text = await res.text().catch(() => '')

  interface BulkUploadResponse {
    acceptedCount?: number
    rejectedCount?: number
    errors?: Array<{ rowNumber?: number; field?: string; message?: string }>
  }

  // Unwrap the standard envelope: { success, message, data: BulkUploadResponse }
  let bulk: BulkUploadResponse | null = null
  let envelopeMessage: string | undefined
  if (text) {
    try {
      const json = JSON.parse(text) as Record<string, unknown>
      if (typeof json.message === 'string') envelopeMessage = json.message
      bulk = (json.data ?? json) as BulkUploadResponse
    } catch { /* fall through */ }
  }

  // Partial or full rejection: rejectedCount > 0 regardless of HTTP status
  if (bulk?.rejectedCount && bulk.rejectedCount > 0) {
    const rowErrors: BulkRowError[] = (bulk.errors ?? []).map((e) => ({
      row: typeof e.rowNumber === 'number' ? e.rowNumber : undefined,
      field: typeof e.field === 'string' ? e.field : undefined,
      message: typeof e.message === 'string' ? e.message : '',
    }))
    throw new BulkImportError(
      `${bulk.rejectedCount} row${bulk.rejectedCount !== 1 ? 's' : ''} failed validation.`,
      rowErrors,
      bulk.acceptedCount,
      bulk.rejectedCount,
    )
  }

  // Non-2xx without a structured bulk body (unexpected server error, auth error, etc.)
  if (!res.ok) {
    throw new BulkImportError(envelopeMessage ?? text ?? `HTTP ${res.status}`, [])
  }
}

export async function fetchLearnerTemplateHeaders(): Promise<string[]> {
  const token = localStorage.getItem('auth_token')
  const headers: HeadersInit = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}/admin/learners/template`, {
    method: 'GET',
    headers,
    credentials: 'include',
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const text = await res.text()
  const firstLine = text.split(/\r?\n/)[0] ?? ''
  return firstLine.split(',').map((col) => col.replace(/^"|"$/g, '').trim()).filter(Boolean)
}

export async function downloadLearnerTemplate(): Promise<void> {
  const token = localStorage.getItem('auth_token')
  const headers: HeadersInit = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}/admin/learners/template`, {
    method: 'GET',
    headers,
    credentials: 'include',
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = disposition.match(/filename[^;=\n]*=(['"]?)([^'";\n]+)\1/)
  const filename = match?.[2]?.trim() ?? 'learners-template.csv'

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
