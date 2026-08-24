import { ref, type Ref } from 'vue'
import type { Notification, NotificationResponse } from '@/types/runReview.types'
import { notificationStreamUrl, mapStreamNotification } from '@/services/runReview.service'
import { USE_MOCKS } from '@/services/mock/useMocks'
import { useEventSourceStream } from '@/composables/useEventSourceStream'

export interface UseNotificationStreamOptions {
  /** Fired for every notification.updated event, already mapped + recipient-enriched — check `notification.status` for the outcome (SENT/FAILED/SKIPPED). */
  onEvent?: (notification: Notification) => void
}

export interface NotificationStream {
  isConnected: Ref<boolean>
  error: Ref<string | null>
  /** True once reconnect attempts are exhausted — the stream has given up and needs a manual `start()`. */
  disconnected: Ref<boolean>
  start: () => void
  stop: () => void
}

/**
 * Live feed for notification status changes (Epic C) — GET /notifications/stream. Unlike the sync/gate/standup
 * streams elsewhere in this app, this one isn't scoped to a single cohort or run: NotificationDispatchService
 * fans a single notification.updated event out here whenever sendNow/dismiss changes a row's status, from every
 * dispatch path (auto-dispatch, manual send/retry, send-all, dismiss) — the outcome (SENT/FAILED/SKIPPED) rides
 * in the payload's `status` field rather than in the event name. Callers are expected to filter to what they
 * actually care about (e.g. the run currently on screen) inside `onEvent` — this composable just turns the raw
 * SSE payload into an enriched `Notification` and hands it over. There's no fake SSE server for local dev, and
 * the mock notification endpoints already flip status synchronously (no off-thread dispatch to bridge), so mock
 * mode is a deliberate no-op.
 */
export function useNotificationStream(options: UseNotificationStreamOptions = {}): NotificationStream {
  const isConnected = ref(false)
  const error = ref<string | null>(null)
  const disconnected = ref(false)

  const eventSource = useEventSourceStream()

  function stop() {
    isConnected.value = false
    eventSource.stop()
  }

  function handleUpdated(dto: NotificationResponse) {
    mapStreamNotification(dto)
      .then((n) => options.onEvent?.(n))
      .catch(() => {
        error.value = 'Received a notification event that could not be resolved.'
      })
  }

  function openRealStream() {
    const onMalformed = () => {
      error.value = 'Received a malformed message from the notifications stream.'
    }
    const source = eventSource.open(notificationStreamUrl())
    eventSource.bindEvent<NotificationResponse>('notification.updated', handleUpdated, onMalformed)
    source.onerror = eventSource.withGiveUp(
      // EventSource reconnects on its own (Last-Event-ID replay) — just surface a soft warning.
      () => { error.value = 'Connection to the notifications stream was interrupted — reconnecting…' },
      () => {
        isConnected.value = false
        disconnected.value = true
        error.value = 'Lost connection to the notifications stream. Live updates are paused.'
      },
    )
  }

  function start() {
    if (isConnected.value || eventSource.isDisposed()) return
    error.value = null
    disconnected.value = false
    if (USE_MOCKS) return
    isConnected.value = true
    openRealStream()
  }

  return { isConnected, error, disconnected, start, stop }
}
