// Admin settings (PRD Epic C C2, FE strategy §6.8).
// Sync scheduling now lives in its own CRUD resource — see src/types/syncSchedule.types.ts
// and the "Sync schedules" admin page — rather than this single provisional toggle.

export interface Settings {
  /** Global auto-send lever for instructor grading digests. Default OFF = hold (C2 AC2). */
  autoSendInstructorEmails: boolean
}
