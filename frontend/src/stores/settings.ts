import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toErrorMessage } from '@/utils/errors'
import type { Settings } from '@/types/settings.types'
import { getSettings, updateSettings } from '@/services/settings.service'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function fetch() {
    loading.value = true
    error.value = null
    try {
      settings.value = await getSettings()
    } catch (e) {
      error.value = toErrorMessage(e, 'Failed to load settings')
    } finally {
      loading.value = false
    }
  }

  async function update(patch: Partial<Settings>) {
    saving.value = true
    error.value = null
    try {
      settings.value = await updateSettings(patch)
    } catch (e) {
      error.value = toErrorMessage(e, 'Failed to save settings')
      throw e
    } finally {
      saving.value = false
    }
  }

  return { settings, loading, saving, error, fetch, update }
})
