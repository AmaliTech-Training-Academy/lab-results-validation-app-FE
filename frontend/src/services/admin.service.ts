import type { AdminDashboardData } from '@/types/dashboard.types'

// ---------------------------------------------------------------------------
// Mock data — DELETE and replace service bodies when wiring the real API
// ---------------------------------------------------------------------------
const MOCK_DASHBOARD: AdminDashboardData = {
  stats: [
    {
      label: 'Cohorts',
      value: '6',
      chipIcon: 'graduation-cap',
      chipBg: '#FFE9E3',
      chipFg: '#A83900',
      footDot: '#1A6B3C',
      footText: '4 Active · 2 Completed',
    },
    {
      label: 'Learners',
      value: '142',
      chipIcon: 'user',
      chipBg: '#CAE6FF',
      chipFg: '#08283B',
      footDot: '#1A6B3C',
      footText: '138 Active · 4 Archived',
    },
    {
      label: 'Instructors',
      value: '8',
      chipIcon: 'id-card',
      chipBg: '#FDF0D5',
      chipFg: '#7A4A00',
      footDot: '#1A6B3C',
      footText: '7 Active',
    },
  ],

  recentUploads: [
    { instructor: 'Sarah Jenkins',   file: 'js_fundamentals_w3.csv',    accepted: 28, rejected: 0,  tone: 'success', status: 'Completed' },
    { instructor: 'Marcus Chen',     file: 'react_hooks_lab2.csv',      accepted: 21, rejected: 7,  tone: 'warning', status: 'Partial'   },
    { instructor: 'Elena Rodriguez', file: 'node_rest_api_w4.csv',      accepted: 34, rejected: 0,  tone: 'success', status: 'Completed' },
    { instructor: 'Marcus Chen',     file: 'db_design_corrections.csv', accepted: 19, rejected: 3,  tone: 'warning', status: 'Partial'   },
    { instructor: 'David Osei',      file: 'ts_generics_final.csv',     accepted: 25, rejected: 0,  tone: 'success', status: 'Completed' },
  ],

  attentionItems: [
    {
      instructor: 'James Wilson',
      file: 'algorithms_cohortB_w2.csv',
      pct: '78% Rejected',
      detail: '5 Accepted / 18 Rejected',
    },
    {
      instructor: 'Anita Mensah',
      file: 'sql_joins_lab_raw.csv',
      pct: '60% Rejected',
      detail: '12 Accepted / 18 Rejected',
    },
  ],
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
// ---------------------------------------------------------------------------

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  // TODO: replace with → return http.get<AdminDashboardData>('/admin/dashboard')
  await delay(300)
  return MOCK_DASHBOARD
}
