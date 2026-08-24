import { describe, it, expect, vi } from 'vitest'
import { effectScope } from 'vue'
import { useEventSourceStream } from '@/composables/useEventSourceStream'

/** Runs the composable inside a real effect scope so its onScopeDispose hook is wired up, and returns
 * a `dispose()` to tear it down on demand — mirrors how a component unmount would trigger it. */
function withScope() {
  const scope = effectScope()
  const stream = scope.run(() => useEventSourceStream())!
  return { stream, dispose: () => scope.stop() }
}

describe('useEventSourceStream — withGiveUp', () => {
  it('calls onError for each failure below the threshold, never onGiveUp', () => {
    const { stream } = withScope()
    const onError = vi.fn<() => void>()
    const onGiveUp = vi.fn<() => void>()
    const handler = stream.withGiveUp(onError, onGiveUp)

    handler()
    handler()
    handler()
    handler()

    expect(onError).toHaveBeenCalledTimes(4)
    expect(onGiveUp).not.toHaveBeenCalled()
  })

  it('gives up after 5 consecutive failures and stops calling onError', () => {
    const { stream } = withScope()
    const onError = vi.fn<() => void>()
    const onGiveUp = vi.fn<() => void>()
    const handler = stream.withGiveUp(onError, onGiveUp)

    for (let i = 0; i < 5; i++) handler()

    expect(onGiveUp).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledTimes(4) // the 5th failure trips the threshold instead of calling onError

    handler() // a 6th failure after giving up shouldn't do anything more
    expect(onGiveUp).toHaveBeenCalledTimes(1)
  })

  it('resets the failure streak once the connection opens successfully', () => {
    const { stream } = withScope()
    const onError = vi.fn<() => void>()
    const onGiveUp = vi.fn<() => void>()
    const handler = stream.withGiveUp(onError, onGiveUp)

    handler()
    handler()
    handler()
    handler() // 4 straight failures — one more would give up

    vi.stubGlobal('EventSource', class {
      listeners = new Map<string, () => void>()
      addEventListener(name: string, cb: () => void) { this.listeners.set(name, cb) }
      close() {}
    })
    const source = stream.open('http://mock/stream')
    // Simulate the browser's own successful (re)connect firing the 'open' event.
    ;(source as unknown as { listeners: Map<string, () => void> }).listeners.get('open')?.()

    handler()
    handler()
    handler()
    handler()

    expect(onGiveUp).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledTimes(8)
    vi.unstubAllGlobals()
  })

  it('ignores further failures once the owning scope is disposed', () => {
    const { stream, dispose } = withScope()
    const onError = vi.fn<() => void>()
    const onGiveUp = vi.fn<() => void>()
    const handler = stream.withGiveUp(onError, onGiveUp)

    dispose()
    handler()
    handler()

    expect(onError).not.toHaveBeenCalled()
    expect(onGiveUp).not.toHaveBeenCalled()
  })
})
