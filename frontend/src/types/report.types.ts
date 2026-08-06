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
