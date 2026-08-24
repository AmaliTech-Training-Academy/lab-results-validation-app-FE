// Weekly grading ingestion runs (PRD Epic B, FE strategy §8).
import { http, BASE_URL, getToken, invalidateCache } from './http'
import type { IngestionRun, RunStatus, SyncRun, SyncRunResponse, SyncRunStatus, SyncTriggerPayload, SyncTriggerResponse } from '@/types/run.types'
import type { Paged } from '@/types/common.types'
import { USE_MOCKS } from './mock/useMocks'
import { getUser } from './users.service'

const RUNS_LIST_TTL_MS = 15_000 // short — runs are actively progressing, but this collapses the dashboard/RunsView mount-time duplicate fetch of the same cohort's runs

const SYNC_STATUS_MAP: Record<SyncRunStatus, RunStatus> = {
  PENDING: 'processing',
  RUNNING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
}

/**
 * /cohorts/{id}/sync/runs returns a thin job stub, not a full ingestion run — patch it into the
 * shape the runs list renders. A null triggeredBy means the run was kicked off by the scheduler,
 * not a person; otherwise resolve the raw id to an email for display.
 */
async function mapSyncRun(r: SyncRun): Promise<IngestionRun> {
  const triggeredByEmail = r.triggeredBy
    ? await getUser(r.triggeredBy)
        .then((u) => u.email)
        .catch(() => null)
    : null
  return {
    id: r.id,
    cohortId: r.cohortId,
    status: SYNC_STATUS_MAP[r.status] ?? 'processing',
    triggeredBy: r.triggeredBy,
    triggeredByEmail,
    triggerType: r.triggeredBy ? 'MANUAL' : 'SCHEDULED',
    startedAt: r.startedAt ?? undefined,
    completedAt: r.completedAt ?? undefined,
  }
}

/** Runs are scoped to a single cohort (§9c) — there's no cross-cohort listing endpoint. */
export async function listRuns(cohortId: string): Promise<IngestionRun[]> {
  if (USE_MOCKS) {
    const { mockDelay, runs } = await import('./mock/fixtures')
    const list = runs.filter((r) => r.cohortId === cohortId)
    return mockDelay([...list].sort((a, b) => (b.runAt ?? '').localeCompare(a.runAt ?? '')))
  }
  const page = await http.get<Paged<SyncRun>>(`/cohorts/${cohortId}/sync/runs`, { ttl: RUNS_LIST_TTL_MS })
  return Promise.all(page.content.map(mapSyncRun))
}

export async function getRun(cohortId: string, id: string): Promise<IngestionRun> {
  if (USE_MOCKS) {
    const { mockDelay, runs } = await import('./mock/fixtures')
    const run = runs.find((r) => r.id === id && r.cohortId === cohortId)
    if (!run) throw new Error('Run not found')
    return mockDelay(run)
  }
  const dto = await http.get<SyncRunResponse>(`/cohorts/${cohortId}/sync/runs/${id}`)
  return mapSyncRun(dto)
}

/** Mock trigger starts a run as `processing` — no counts yet — so useSyncRunStream has something to stream progress into. */
function mockSyncRun(cohortId: string, mocks: typeof import('./mock/fixtures')): IngestionRun {
  const { genId, cohorts, runs } = mocks
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
    status: 'processing',
    runAt: new Date().toISOString(),
    errorReport: [],
  }
  runs.unshift(run)
  return run
}

/** Manual sync for a single cohort (B1 AC2) — a trigger summary, not the created run; re-list to see the new row. */
export async function triggerSync(cohortId: string, payload: SyncTriggerPayload = {}): Promise<SyncTriggerResponse> {
  if (USE_MOCKS) {
    const mocks = await import('./mock/fixtures')
    mockSyncRun(cohortId, mocks)
    return mocks.mockDelay({ triggered: 1, skipped: 0, triggeredCohortIds: [cohortId] })
  }
  const result = await http.post<SyncTriggerResponse>(`/cohorts/${cohortId}/sync`, payload)
  invalidateCache(`/cohorts/${cohortId}/sync/runs`)
  return result
}

/** Manual sync fanned out across every eligible cohort (B1 AC2) — no request body, no created runs in the response either. */
export async function triggerSyncAll(): Promise<SyncTriggerResponse> {
  if (USE_MOCKS) {
    const mocks = await import('./mock/fixtures')
    const eligible = mocks.cohorts.filter((c) => c.lifecycleState === 'STOOD_UP')
    eligible.forEach((c) => mockSyncRun(c.id, mocks))
    return mocks.mockDelay({ triggered: eligible.length, skipped: 0, triggeredCohortIds: eligible.map((c) => c.id) })
  }
  const result = await http.post<SyncTriggerResponse>('/cohorts/sync')
  invalidateCache('/cohorts') // triggered across every eligible cohort — bust every cached runs list, not just one
  return result
}

/**
 * URL for a cohort's sync SSE stream — scoped to the cohort, not a specific
 * run: it streams the most recent sync job for that cohort, replaying all
 * stored events from the start on a fresh connection (or from Last-Event-ID+1
 * on reconnect). Browser `EventSource` can't set an `Authorization` header,
 * so the JWT rides in the query string instead (same pattern as
 * `standupStreamUrl`/`gate4StreamUrl` in cohorts.service.ts).
 */
export function syncRunStreamUrl(cohortId: string): string {
  const token = getToken() ?? ''
  return `${BASE_URL}/cohorts/${cohortId}/sync/stream?token=${encodeURIComponent(token)}`
}
