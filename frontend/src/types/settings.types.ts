// Admin settings (PRD Epic C C2, FE strategy §6.8).

/** Weekly sync schedule — provisional, gated by D-TRIG (default Mon 08:00 GMT). */
export interface SyncSchedule {
  enabled: boolean
  /** e.g. "MONDAY" */
  day: string
  /** 24h "HH:mm" */
  time: string
  /** IANA tz, e.g. "GMT" / "Etc/GMT" */
  timezone: string
}

export interface Settings {
  /** Global auto-send lever for instructor grading digests. Default OFF = hold (C2 AC2). */
  autoSendInstructorEmails: boolean
  syncSchedule: SyncSchedule
}
