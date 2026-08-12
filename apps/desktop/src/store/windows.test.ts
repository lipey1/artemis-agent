import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { canOpenNewWindow, canOpenSessionWindow, openNewWindow, openSessionInNewWindow } from './windows'

const desktopWindow = window as unknown as { artemisDesktop?: Window['artemisDesktop'] }
const initialArtemisDesktop = desktopWindow.artemisDesktop

const notifyError = vi.fn()

vi.mock('./notifications', () => ({
  notifyError: (...args: unknown[]) => notifyError(...args)
}))

function installBridge(
  openSessionWindow?: Window['artemisDesktop']['openSessionWindow'],
  openWindow?: Window['artemisDesktop']['openWindow']
) {
  desktopWindow.artemisDesktop = {
    ...(openSessionWindow ? { openSessionWindow } : {}),
    ...(openWindow ? { openWindow } : {})
  } as unknown as Window['artemisDesktop']
}

beforeEach(() => {
  notifyError.mockClear()
})

afterEach(() => {
  if (initialArtemisDesktop) {
    desktopWindow.artemisDesktop = initialArtemisDesktop
  } else {
    delete desktopWindow.artemisDesktop
  }
})

describe('canOpenSessionWindow', () => {
  it('is false when the desktop bridge is absent', () => {
    delete desktopWindow.artemisDesktop
    expect(canOpenSessionWindow()).toBe(false)
  })

  it('is false when the bridge lacks openSessionWindow', () => {
    installBridge(undefined)
    expect(canOpenSessionWindow()).toBe(false)
  })

  it('is true when the bridge exposes openSessionWindow', () => {
    installBridge(vi.fn().mockResolvedValue({ ok: true }))
    expect(canOpenSessionWindow()).toBe(true)
  })
})

describe('openSessionInNewWindow', () => {
  it('no-ops without a session id', async () => {
    const open = vi.fn().mockResolvedValue({ ok: true })
    installBridge(open)

    await openSessionInNewWindow('')

    expect(open).not.toHaveBeenCalled()
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('no-ops gracefully when the bridge is absent (web fallback)', async () => {
    delete desktopWindow.artemisDesktop

    await openSessionInNewWindow('s1')

    expect(notifyError).not.toHaveBeenCalled()
  })

  it('invokes the bridge with the session id', async () => {
    const open = vi.fn().mockResolvedValue({ ok: true })
    installBridge(open)

    await openSessionInNewWindow('s1')

    expect(open).toHaveBeenCalledWith('s1', undefined)
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('forwards the watch flag for spectator (subagent) windows', async () => {
    const open = vi.fn().mockResolvedValue({ ok: true })
    installBridge(open)

    await openSessionInNewWindow('s1', { watch: true })

    expect(open).toHaveBeenCalledWith('s1', { watch: true })
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('notifies on an ok:false result', async () => {
    installBridge(vi.fn().mockResolvedValue({ ok: false, error: 'invalid-session-id' }))

    await openSessionInNewWindow('s1')

    expect(notifyError).toHaveBeenCalledTimes(1)
  })

  it('notifies when the bridge throws', async () => {
    installBridge(vi.fn().mockRejectedValue(new Error('boom')))

    await openSessionInNewWindow('s1')

    expect(notifyError).toHaveBeenCalledTimes(1)
  })
})

describe('canOpenNewWindow', () => {
  it('is false when the desktop bridge is absent', () => {
    delete desktopWindow.artemisDesktop
    expect(canOpenNewWindow()).toBe(false)
  })

  it('is false when the bridge lacks openWindow', () => {
    installBridge(vi.fn().mockResolvedValue({ ok: true }))
    expect(canOpenNewWindow()).toBe(false)
  })

  it('is true when the bridge exposes openWindow', () => {
    installBridge(undefined, vi.fn().mockResolvedValue({ ok: true }))
    expect(canOpenNewWindow()).toBe(true)
  })
})

describe('openNewWindow', () => {
  it('no-ops gracefully when the bridge is absent (web fallback)', async () => {
    delete desktopWindow.artemisDesktop

    await openNewWindow()

    expect(notifyError).not.toHaveBeenCalled()
  })

  it('no-ops when openWindow is missing', async () => {
    installBridge(vi.fn().mockResolvedValue({ ok: true }))

    await openNewWindow()

    expect(notifyError).not.toHaveBeenCalled()
  })

  it('invokes the bridge', async () => {
    const openWindow = vi.fn().mockResolvedValue({ ok: true })
    installBridge(undefined, openWindow)

    await openNewWindow()

    expect(openWindow).toHaveBeenCalledTimes(1)
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('notifies on an ok:false result', async () => {
    installBridge(undefined, vi.fn().mockResolvedValue({ ok: false, error: 'nope' }))

    await openNewWindow()

    expect(notifyError).toHaveBeenCalledTimes(1)
  })
})
