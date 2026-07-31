// User-defined recurring schedules that trigger score-sheet sync runs.

export type ScheduleFrequency = 'DAILY' | 'WEEKLY'

// ASSUMPTION: unconfirmed against the BE's DayOfWeek enum — matches java.time.DayOfWeek
// constant names, which is also what the legacy Settings sync-schedule already used.
export type DayOfWeekName =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'

export interface SyncScheduleResponse {
  id: string
  name: string
  /** null = the "all eligible cohorts" batch. */
  cohortId: string | null
  frequency: ScheduleFrequency
  /** "HH:mm" or "HH:mm:ss" — LocalTime serialization, treated as an opaque string. */
  timeOfDay: string
  dayOfWeek: DayOfWeekName | null
  timezone: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

/** Shared shape for both create (POST) and update (PUT is a full replace). */
export interface SyncSchedulePayload {
  name: string
  /** Omit/null to run the "all eligible cohorts" batch. */
  cohortId?: string | null
  frequency: ScheduleFrequency
  timeOfDay: string
  /** Required when frequency is WEEKLY, ignored otherwise. */
  dayOfWeek?: DayOfWeekName | null
  /** IANA zone id; omit to use the app's configured default. */
  timezone?: string
  enabled: boolean
}

export type SyncSchedule = SyncScheduleResponse
