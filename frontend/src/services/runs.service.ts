// Weekly grading ingestion runs (PRD Epic B, FE strategy §8).
import { http } from './http'
import type { IngestionRun, RunStatus, SyncRun, SyncRunStatus, SyncTriggerPayload } from '@/types/run.types'
import type { Paged } from '@/types/common.types'
import { USE_MOCKS, mockDelay, genId, runs, cohorts } from './mock/fixtures'

const SYNC_STATUS_MAP: Record<SyncRunStatus, RunStatus> = {
  PENDING: 'processing',
  RUNNING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
}

/** /cohorts/{id}/sync/runs returns a thin job stub, not a full ingestion run — patch it into the shape the runs list renders. */
function mapSyncRun(r: SyncRun): IngestionRun {
  return {
    id: r.id,
    cohortId: r.cohortId,
    status: SYNC_STATUS_MAP[r.status] ?? 'processing',
    triggeredBy: r.triggeredBy,
    triggerType: 'MANUAL',
    startedAt: r.startedAt ?? undefined,
    completedAt: r.completedAt ?? undefined,
  }
}

/** Runs are scoped to a single cohort (§9c) — there's no cross-cohort listing endpoint. */
export async function listRuns(cohortId: string): Promise<IngestionRun[]> {
  if (USE_MOCKS) {
    const list = runs.filter((r) => r.cohortId === cohortId)
    return mockDelay([...list].sort((a, b) => (b.runAt ?? '').localeCompare(a.runAt ?? '')))
  }
  const page = await http.get<Paged<SyncRun>>(`/cohorts/${cohortId}/sync/runs`)
  return page.content.map(mapSyncRun)
}

export async function getRun(id: string): Promise<IngestionRun> {
  if (USE_MOCKS) {
    const run = runs.find((r) => r.id === id)
    if (!run) throw new Error('Run not found')
    return mockDelay(run)
  }
  return http.get<IngestionRun>(`/runs/${id}`)
}

function mockSyncRun(cohortId: string): IngestionRun {
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
  return run
}

/** Manual sync for a single cohort (B1 AC2). Returns the run(s) started. */
export async function triggerSync(cohortId: string, payload: SyncTriggerPayload = {}): Promise<IngestionRun[]> {
  if (USE_MOCKS) return mockDelay([mockSyncRun(cohortId)])
  const page = await http.post<Paged<SyncRun>>(`/cohorts/${cohortId}/sync/runs`, payload)
  return page.content.map(mapSyncRun)
}

/** Manual sync fanned out across every eligible cohort (B1 AC2) — no request body. */
export async function triggerSyncAll(): Promise<IngestionRun[]> {
  if (USE_MOCKS) {
    const eligible = cohorts.filter((c) => c.lifecycleState === 'STOOD_UP')
    return mockDelay(eligible.map((c) => mockSyncRun(c.id)))
  }
  return http.post<IngestionRun[]>('/cohorts/sync')
}
