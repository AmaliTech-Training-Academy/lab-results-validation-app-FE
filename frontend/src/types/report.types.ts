export interface AuditEntry {
  id: string
  instructor: string
  file: string
  uploadedAt: string
  totalRows: number
  accepted: number
  rejected: number
  status: 'success' | 'warning' | 'danger'
  statusLabel: 'Completed' | 'Partial' | 'Failed'
}

export interface CsvUploadEntry {
  id: string
  uploadedByEmail: string
  filename: string
  fileSha256: string
  uploadedAt: string
  totalRows: number
  acceptedRows: number
  rejectedRows: number
  status: string
  createdAt: string
  updatedAt: string
}

export interface PagedCsvUploads {
  content: CsvUploadEntry[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export interface RejectedRow {
  row: number
  email: string
  field: string
  ruleId: string
  message: string
}

export interface ValidationReport {
  uploadId: string
  filename: string
  uploadedAt: string
  totalRows: number
  accepted: number
  rejected: number
  rejectedRows: RejectedRow[]
}

export interface CsvUploadError {
  rule: string | null
  field: string | null
  message: string
  rowNumber: number
}

export interface CsvUploadErrorReport {
  errors: CsvUploadError[]
  summary: {
    skipped: number
    updated: number
    inserted: number
    rejected: number
    totalRows: number
  }
}
