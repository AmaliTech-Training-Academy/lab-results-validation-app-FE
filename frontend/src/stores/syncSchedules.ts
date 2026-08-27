import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toErrorMessage } from '@/utils/errors'
import type { SyncSchedulePayload, SyncScheduleResponse } from '@/types/syncSchedule.types'
import {
  listSyncSchedules,
  getSyncSchedule,
  createSyncSchedule,
  updateSyncSchedule,
  removeSyncSchedule,
} from '@/services/syncSchedules.service'

export const useSyncSchedulesStore = defineStore('syncSchedules', () => {
  const list = ref<SyncScheduleResponse[]>([])
  const current = ref<SyncScheduleResponse | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  /** Last mutation (create/update/delete) failure — kept separate from the load `error` so a failed
   *  save doesn't flip the page into its "could not load" state (the load error drives that). */
  const actionError = ref<string | null>(null)

  async function fetchList() {
    loading.value = true
    error.value = null
    try {
      list.value = await listSyncSchedules()
    } catch (e) {
      error.value = toErrorMessage(e, 'Failed to load sync schedules')
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(id: string) {
    loading.value = true
    error.value = null
    try {
      current.value = await getSyncSchedule(id)
    } catch (e) {
      error.value = toErrorMessage(e, 'Failed to load sync schedule')
    } finally {
      loading.value = false
    }
  }

  async function create(payload: SyncSchedulePayload): Promise<SyncScheduleResponse> {
    saving.value = true
    actionError.value = null
    try {
      const created = await createSyncSchedule(payload)
      list.value = [created, ...list.value]
      return created
    } catch (e) {
      actionError.value = toErrorMessage(e, 'Failed to create sync schedule')
      throw e
    } finally {
      saving.value = false
    }
  }

  async function update(id: string, payload: SyncSchedulePayload): Promise<SyncScheduleResponse> {
    saving.value = true
    actionError.value = null
    try {
      const updated = await updateSyncSchedule(id, payload)
      list.value = list.value.map((s) => (s.id === id ? updated : s))
      if (current.value?.id === id) current.value = updated
      return updated
    } catch (e) {
      actionError.value = toErrorMessage(e, 'Failed to update sync schedule')
      throw e
    } finally {
      saving.value = false
    }
  }

  async function remove(id: string): Promise<void> {
    saving.value = true
    actionError.value = null
    try {
      await removeSyncSchedule(id)
      list.value = list.value.filter((s) => s.id !== id)
      if (current.value?.id === id) current.value = null
    } catch (e) {
      actionError.value = toErrorMessage(e, 'Failed to delete sync schedule')
      throw e
    } finally {
      saving.value = false
    }
  }

  return { list, current, loading, saving, error, actionError, fetchList, fetchOne, create, update, remove }
})
