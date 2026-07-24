// Weekly grading ingestion runs (PRD Epic B, FE strategy §8).
import { http } from './http'
import type { IngestionRun, SyncTriggerPayload } from '@/types/run.types'
import { USE_MOCKS, mockDelay, genId, runs, cohorts } from './mock/fixtures'

export async function listRuns(cohortId?: string): Promise<IngestionRun[]> {
  if (USE_MOCKS) {
    const list = cohortId ? runs.filter((r) => r.cohortId === cohortId) : runs
    return mockDelay([...list].sort((a, b) => b.runAt.localeCompare(a.runAt)))
  }
  const qs = cohortId ? `?cohortId=${encodeURIComponent(cohortId)}` : ''
  return http.get<IngestionRun[]>(`/runs${qs}`)
}

export async function getRun(id: string): Promise<IngestionRun> {
  if (USE_MOCKS) {
    const run = runs.find((r) => r.id === id)
    if (!run) throw new Error('Run not found')
    return mockDelay(run)
  }
  return http.get<IngestionRun>(`/runs/${id}`)
}

/** Manual sync (B1 AC2). Returns the run(s) started. */
export async function triggerSync(payload: SyncTriggerPayload = {}): Promise<IngestionRun[]> {
  if (USE_MOCKS) {
    const cohortId = payload.cohortId ?? 'coh-stood'
    const cohort = cohorts.find((c) => c.id === cohortId)
    const run: IngestionRun = {
      id: genId('run'),
      cohortId,
      cohortName: cohort?.name,
      workbookFilename: 'BE_Lab_Grading.xlsx',
      sharepointFileUrl: `${cohort?.sharepointFolderUrl ?? ''}/scores/BE_Lab_Grading.xlsx`,
      sharepointVersionId: '4.0',
      quickXorHash: genId('hash'),
      triggeredByEmail: 'admin@amalitech.com',
      triggerType: 'MANUAL',
      status: 'completed',
      counts: { rowsRead: 40, committedNew: 5, updated: 2, skippedInvalid: 0, skippedUnchanged: 33, conflicts: 0 },
      highFailure: false,
      runAt: new Date().toISOString(),
      errorReport: [],
    }
    runs.unshift(run)
    return mockDelay([run])
  }
  return http.post<IngestionRun[]>('/sync', payload)
}
