import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toErrorMessage } from '@/utils/errors'
import type { IngestionRun, RunCounts, SyncTriggerPayload } from '@/types/run.types'
import { listRuns, getRun, triggerSync, triggerSyncAll } from '@/services/runs.service'
import { listAuditRuns } from '@/services/audit.service'
import { listConflicts } from '@/services/runReview.service'
import { useCohortsStore } from '@/stores/cohorts'

function emptyCounts(): RunCounts {
  return { rowsRead: 0, committedNew: 0, updated: 0, skippedInvalid: 0, skippedUnchanged: 0, conflicts: 0 }
}

/**
 * Real per-run counts + failure signal for one sync job, keyed by `IngestionRun.id` in `list`.
 * `list` itself (from the shallow `/cohorts/{id}/sync/runs` job endpoint) never carries this data
 * (§ FND-46, § FND-39) — it's sourced separately from the audit log instead, see `fetchStats`.
 */
export interface RunStats {
  counts: RunCounts
  highFailure: boolean
  failed: boolean
}

export const useRunsStore = defineStore('runs', () => {
  const list = ref<IngestionRun[]>([])
  const current = ref<IngestionRun | null>(null)
  const loading = ref(false)
  const syncing = ref(false)
  const error = ref<string | null>(null)
  /** Last sync-trigger failure — separate from the load `error` so a failed trigger doesn't flip the
   *  Runs page into its full-screen "could not load runs" state (the load error drives that). */
  const actionError = ref<string | null>(null)

  /** Populated by `fetchStats` — `list` (from `/cohorts/{id}/sync/runs`) only ever carries job
   *  status, not counts/failure-rate/conflict data (the "Results" column and "needs attention"
   *  both depend on this being real). */
  const stats = ref<Map<string, RunStats>>(new Map())
  const statsLoading = ref(false)
  /** Set only when the whole stats enrichment pass fails — lets consumers show that the KPI/results
   *  columns are incomplete instead of displaying them as all-zero. */
  const statsError = ref<string | null>(null)

  /**
   * `listRuns` is scoped to one cohort (§9c) — there's no "all runs" endpoint.
   * With no `cohortId`, fan out over every STOOD_UP cohort and merge, so the
   * dashboard/"All cohorts" views keep working exactly as before.
   *
   * `silent` skips toggling `loading` — used by background polling (§ FND-38: a run's status badge
   * otherwise never updates off `processing` without a manual page refresh) so a periodic re-fetch
   * doesn't flash the loading skeleton over rows the admin is currently looking at.
   */
  async function fetchList(cohortId?: string, opts: { silent?: boolean } = {}) {
    if (!opts.silent) {
      loading.value = true
      error.value = null
    }
    try {
      if (cohortId) {
        list.value = await listRuns(cohortId)
      } else {
        const cohorts = useCohortsStore()
        if (cohorts.list.length === 0) await cohorts.fetchList()
        const eligible = cohorts.list.filter((c) => c.lifecycleState === 'STOOD_UP')
        const perCohort = await Promise.all(eligible.map((c) => listRuns(c.id)))
        list.value = perCohort
          .flat()
          .sort((a, b) => (b.runAt ?? b.startedAt ?? '').localeCompare(a.runAt ?? a.startedAt ?? ''))
      }
    } catch (e) {
      // A silent background poll failing shouldn't replace an already-rendered table with a full
      // error screen — just skip this tick and let the next poll (or a manual retry) try again.
      if (!opts.silent) error.value = toErrorMessage(e, 'Failed to load runs')
    } finally {
      if (!opts.silent) loading.value = false
    }
  }

  async function fetchRun(cohortId: string, id: string) {
    loading.value = true
    error.value = null
    try {
      current.value = await getRun(cohortId, id)
    } catch (e) {
      error.value = toErrorMessage(e, 'Failed to load run')
    } finally {
      loading.value = false
    }
  }

  /**
   * Trigger a manual sync, then re-list to pick up the new run(s) — the
   * trigger endpoints only return a summary (cohorts triggered/skipped), not
   * the created run rows. With no `cohortId`, fans out to every eligible
   * cohort via the all-cohorts endpoint.
   */
  async function sync(cohortId?: string, payload: SyncTriggerPayload = {}) {
    syncing.value = true
    actionError.value = null
    try {
      const result = cohortId ? await triggerSync(cohortId, payload) : await triggerSyncAll()
      await fetchList(cohortId)
      return result
    } catch (e) {
      actionError.value = toErrorMessage(e, 'Failed to trigger sync')
      throw e
    } finally {
      syncing.value = false
    }
  }

  /**
   * `list` has no counts/failure-rate/conflict signal (see `stats` above) — the audit log's
   * ingestion-runs endpoint has it, but per file (one row per workbook), keyed back to the parent sync
   * job via `syncJobId`. Fan out per eligible cohort (same page-0/size-20 recency window as `fetchList`,
   * mirroring `conflicts.fetchTotalOpen`'s per-cohort pattern) and reduce each job's files into one signal.
   *
   * The audit log's `conflictsCount` is a historical snapshot — the backend writes it once at ingestion
   * time and never decrements it when a conflict is later resolved or rejected, so a run whose conflicts
   * are all cleared would otherwise show a phantom count forever. A second pass replaces it with a live
   * PENDING-only count per job (via the same run-scoped conflicts endpoint the Run Review conflict queue
   * uses), but only for jobs the snapshot says had conflicts at all — most runs never did, so this stays cheap.
   */
  async function fetchStats(cohortIds: string[]) {
    if (cohortIds.length === 0) {
      stats.value = new Map()
      return
    }
    statsLoading.value = true
    statsError.value = null
    try {
      const pages = await Promise.all(cohortIds.map((id) => listAuditRuns({ cohortId: id, size: 20 })))
      const byJob = new Map<string, RunStats>()
      const cohortByJob = new Map<string, string>()
      for (const page of pages) {
        for (const r of page.content) {
          const jobId = r.syncJobId ?? r.id
          cohortByJob.set(jobId, r.cohortId)
          const prev = byJob.get(jobId) ?? { counts: emptyCounts(), highFailure: false, failed: false }
          const c = r.counts
          byJob.set(jobId, {
            counts: {
              rowsRead: prev.counts.rowsRead + (c?.rowsRead ?? 0),
              committedNew: prev.counts.committedNew + (c?.committedNew ?? 0),
              updated: prev.counts.updated + (c?.updated ?? 0),
              skippedInvalid: prev.counts.skippedInvalid + (c?.skippedInvalid ?? 0),
              skippedUnchanged: prev.counts.skippedUnchanged + (c?.skippedUnchanged ?? 0),
              conflicts: prev.counts.conflicts + (c?.conflicts ?? 0),
            },
            highFailure: prev.highFailure || !!r.highFailure,
            failed: prev.failed || r.status === 'failed',
          })
        }
      }

      const jobsWithConflicts = [...byJob.entries()].filter(([, s]) => s.counts.conflicts > 0)
      await Promise.all(
        jobsWithConflicts.map(async ([jobId, s]) => {
          const cohortId = cohortByJob.get(jobId)
          if (!cohortId) return
          try {
            const openPage = await listConflicts(cohortId, jobId, { status: 'PENDING', size: 1 })
            byJob.set(jobId, { ...s, counts: { ...s.counts, conflicts: openPage.totalElements } })
          } catch {
            // Leave the historical snapshot count in place for this one job rather than fail the
            // whole enrichment pass over an unrelated job's live-count lookup.
          }
        }),
      )

      stats.value = byJob
    } catch (e) {
      // Best-effort enrichment: a run's own `status`/`counts` (whatever `list`'s own endpoint does
      // report) remain the fallback, so a failure here shouldn't block the rest of the page — but it
      // IS surfaced so the "needs attention"/Results-column data isn't silently shown as all-zero.
      stats.value = new Map()
      statsError.value = e instanceof Error ? e.message : 'Failed to load run statistics'
    } finally {
      statsLoading.value = false
    }
  }

  return { list, current, loading, syncing, error, actionError, stats, statsLoading, statsError, fetchList, fetchRun, sync, fetchStats }
})
