import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from '@/stores/settings'
import type { Settings } from '@/types/settings.types'

vi.mock('@/services/settings.service', () => ({
  getSettings: vi.fn<() => Promise<unknown>>(),
  updateSettings: vi.fn<() => Promise<unknown>>(),
}))
import * as svc from '@/services/settings.service'

const BASE: Settings = {
  autoSendInstructorEmails: false,
  syncSchedule: { enabled: true, day: 'MONDAY', time: '08:00', timezone: 'GMT' },
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useSettingsStore', () => {
  it('fetch loads settings', async () => {
    vi.mocked(svc.getSettings).mockResolvedValue(BASE)
    const store = useSettingsStore()
    await store.fetch()
    expect(store.settings?.autoSendInstructorEmails).toBe(false)
  })

  it('update persists and stores the result', async () => {
    vi.mocked(svc.updateSettings).mockResolvedValue({ ...BASE, autoSendInstructorEmails: true })
    const store = useSettingsStore()
    await store.update({ autoSendInstructorEmails: true })
    expect(svc.updateSettings).toHaveBeenCalledWith({ autoSendInstructorEmails: true })
    expect(store.settings?.autoSendInstructorEmails).toBe(true)
  })

  it('update surfaces and rethrows a failure', async () => {
    vi.mocked(svc.updateSettings).mockRejectedValue(new Error('save failed'))
    const store = useSettingsStore()
    await expect(store.update({ autoSendInstructorEmails: true })).rejects.toThrow('save failed')
    expect(store.error).toBe('save failed')
  })
})
