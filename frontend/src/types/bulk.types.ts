export interface BulkRowError {
  row?: number
  field?: string
  message: string
}

export class BulkImportError extends Error {
  readonly errors: BulkRowError[]
  readonly created?: number
  readonly failed?: number

  constructor(message: string, errors: BulkRowError[], created?: number, failed?: number) {
    super(message)
    this.name = 'BulkImportError'
    this.errors = errors
    this.created = created
    this.failed = failed
  }
}
