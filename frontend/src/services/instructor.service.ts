import type { InstructorDashboardData } from '@/types/dashboard.types'

// ---------------------------------------------------------------------------
// Mock data — DELETE and replace service bodies when wiring the real API
// ---------------------------------------------------------------------------
const MOCK_DASHBOARD: InstructorDashboardData = {
  modules: [
    {
      name: 'React & Component Design',
      cohort: 'GTP 2024-A',
      specialization: 'Frontend Development',
      submitted: 22,
    },
    {
      name: 'Node.js & REST APIs',
      cohort: 'GTP 2024-B',
      specialization: 'Backend Engineering',
      submitted: 17,
    },
  ],

  recentUploads: [
    { file: 'react_state_lab_oct.csv',   date: 'Oct 24, 2024', accepted: 19, rejected: 3,  tone: 'warning', status: 'Partial Success', hasReport: true  },
    { file: 'node_api_cohortB_w3.csv',   date: 'Oct 20, 2024', accepted: 17, rejected: 0,  tone: 'success', status: 'Success',         hasReport: false },
    { file: 'react_hooks_cohortA_w2.csv',date: 'Oct 15, 2024', accepted: 22, rejected: 0,  tone: 'success', status: 'Success',         hasReport: false },
    { file: 'node_express_initial.csv',  date: 'Oct 08, 2024', accepted: 0,  rejected: 21, tone: 'danger',  status: 'Failed',          hasReport: true  },
  ],
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
// ---------------------------------------------------------------------------

export async function getInstructorDashboard(): Promise<InstructorDashboardData> {
  // TODO: replace with → return http.get<InstructorDashboardData>('/instructor/dashboard')
  await delay(300)
  return MOCK_DASHBOARD
}
