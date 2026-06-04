import type { UserRole } from './auth.types'

export type Tone = 'success' | 'warning' | 'danger' | 'info'

export interface DashboardStat {
  label: string
  value: string
  chipIcon: string
  chipBg: string
  chipFg: string
  footDot: string
  footText: string
}

export interface RecentUpload {
  instructor: string
  file: string
  accepted: number
  rejected: number
  tone: Tone
  status: string
}

export interface AttentionItem {
  instructor: string
  file: string
  pct: string
  detail: string
}

export interface AdminDashboardData {
  stats: DashboardStat[]
  recentUploads: RecentUpload[]
  attentionItems: AttentionItem[]
}

export interface AssignedModule {
  name: string
  cohort: string
  specialization: string
  submitted: number
}

export interface MyUpload {
  file: string
  date: string
  accepted: number
  rejected: number
  tone: Tone
  status: string
  hasReport: boolean
}

export interface InstructorDashboardData {
  modules: AssignedModule[]
  recentUploads: MyUpload[]
}

export type { UserRole }
