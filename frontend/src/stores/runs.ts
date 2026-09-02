import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toErrorMessage } from '@/utils/errors'
import type { IngestionRun, RunCounts, SyncTriggerPayload } from '@/types/run.types'
import { listRuns, getRun, triggerSync, triggerSyncAll } from '@/services/runs.service'
import { getRunCounts, listConflicts } from '@/services/runReview.service'
import { useCohortsStore } from '@/stores/cohorts'

/**
 * Real per-run counts + failure signal for one sync job, keyed by `IngestionRun.id` in `list`.
 * `list` itself (from the shallow `/cohorts/{id}/sync/runs` job endpoint) never carries this data
 * (§ FND-46, § FND-39) — it's sourced separately, per run, see `fetchStats`.
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
   * `list` has no counts/failure-rate/conflict signal (see `stats` above). An earlier fix (§ FND-39,
   * § FND-46) sourced it from the audit log's ingestion-runs feed instead — but that feed is one row
   * per FILE (workbook), not per run, fetched as one fixed page-0/size-20 window per cohort. With
   * several spreadsheets per cohort, that window only ever covered the ~3 most recent runs; anything
   * older silently rendered as all zeros — indistinguishable from a run where nothing happened
   * (§ FND-55). Fetch per run instead, scoped to exactly the runs the caller passes in (typically
   * whatever's on screen) — this can never under-cover what's actually visible. A run already in
   * `stats` is skipped unless it's still `processing` (its counts can still be climbing).
   *
   * The overview's `conflictsCount` is a historical snapshot — the backend writes it once at ingestion
   * time and never decrements it when a conflict is later resolved or rejected, so a run whose conflicts
   * are all cleared would otherwise show a phantom count forever. A second pass replaces it with a live
   * PENDING-only count per job (via the same run-scoped conflicts endpoint the Run Review conflict queue
   * uses), but only for jobs the snapshot says had conflicts at all — most runs never did, so this stays cheap.
   */
  async function fetchStats(runsToFetch: IngestionRun[]) {
    const targets = runsToFetch.filter((r) => r.status === 'processing' || !stats.value.has(r.id))
    if (targets.length === 0) return
    statsLoading.value = true
    statsError.value = null
    try {
      const fetched = (
        await Promise.all(
          targets.map(async (r) => {
            const jobId = r.syncJobId ?? r.id
            try {
              return { id: r.id, cohortId: r.cohortId, jobId, stats: await getRunCounts(r.cohortId, jobId) }
            } catch {
              // Leave this one unfetched rather than fail the whole batch over one run's lookup — the
              // view shows a dash for it, not a false zero (§ FND-55's actual defect).
              return null
            }
          }),
        )
      ).filter((f): f is { id: string; cohortId: string; jobId: string; stats: RunStats } => f !== null)

      if (fetched.length === 0) {
        // Best-effort enrichment: a run's own `status` (whatever `list`'s own endpoint reports) remains
        // the fallback, so a failure here shouldn't block the rest of the page — but it IS surfaced so
        // the "needs attention"/Results-column data isn't silently shown as all-zero.
        statsError.value = 'Failed to load run statistics'
        return
      }

      const next = new Map(stats.value)
      for (const f of fetched) next.set(f.id, f.stats)

      const jobsWithConflicts = fetched.filter((f) => f.stats.counts.conflicts > 0)
      await Promise.all(
        jobsWithConflicts.map(async (f) => {
          try {
            const openPage = await listConflicts(f.cohortId, f.jobId, { status: 'PENDING', size: 1 })
            const current = next.get(f.id)
            if (current) next.set(f.id, { ...current, counts: { ...current.counts, conflicts: openPage.totalElements } })
          } catch {
            // Leave the historical snapshot count in place for this one job rather than fail the
            // whole enrichment pass over an unrelated job's live-count lookup.
          }
        }),
      )

      stats.value = next
    } finally {
      statsLoading.value = false
    }
  }

  return { list, current, loading, syncing, error, actionError, stats, statsLoading, statsError, fetchList, fetchRun, sync, fetchStats }
})
