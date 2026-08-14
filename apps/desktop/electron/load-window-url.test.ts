import assert from 'node:assert/strict'

import { test } from 'vitest'

import {
  isBlankWindowUrl,
  isCommittedTargetUrl,
  isTransientWindowLoadError,
  loadWindowUrlWithRetry,
  reloadWindowContents,
  shouldRetryWindowLoad,
  WINDOW_LOAD_MAX_ATTEMPTS,
  windowLoadRetryDelayMs
} from './load-window-url'

function makeFakeWindow(initialUrl = 'about:blank') {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>()
  let destroyed = false
  let currentUrl = initialUrl
  const loadCalls: string[] = []
  const stopCalls: number[] = []
  const reloadCalls: number[] = []
  let loadImpl: (url: string) => Promise<unknown> = async () => undefined

  const win = {
    isDestroyed: () => destroyed,
    setDestroyed: (value: boolean) => {
      destroyed = value
    },
    setUrl: (url: string) => {
      currentUrl = url
    },
    loadURL: (url: string) => {
      loadCalls.push(url)
      return loadImpl(url)
    },
    setLoadImpl: (next: (url: string) => Promise<unknown>) => {
      loadImpl = next
    },
    webContents: {
      getURL: () => currentUrl,
      on: (event: string, listener: (...args: unknown[]) => void) => {
        const list = listeners.get(event) ?? []
        list.push(listener)
        listeners.set(event, list)
      },
      removeListener: (event: string, listener: (...args: unknown[]) => void) => {
        const list = listeners.get(event) ?? []
        listeners.set(
          event,
          list.filter(candidate => candidate !== listener)
        )
      },
      emit: (event: string, ...args: unknown[]) => {
        for (const listener of listeners.get(event) ?? []) {
          listener(...args)
        }
      },
      stop: () => {
        stopCalls.push(1)
      },
      reload: () => {
        reloadCalls.push(1)
      }
    },
    loadCalls,
    stopCalls,
    reloadCalls
  }

  return win
}

test('blank and committed URL helpers', () => {
  assert.equal(isBlankWindowUrl(undefined), true)
  assert.equal(isBlankWindowUrl('about:blank'), true)
  assert.equal(isBlankWindowUrl('http://127.0.0.1:5174/'), false)

  assert.equal(isCommittedTargetUrl('about:blank', 'http://127.0.0.1:5174'), false)
  assert.equal(isCommittedTargetUrl('http://127.0.0.1:5174/', 'http://127.0.0.1:5174'), true)
  assert.equal(isCommittedTargetUrl('http://127.0.0.1:5174/?win=hud', 'http://127.0.0.1:5174/?win=hud'), true)
  assert.equal(isCommittedTargetUrl('http://127.0.0.1:5174/', 'http://127.0.0.1:5174/?win=hud'), false)
})

test('retries transient Chromium codes and hung about:blank, not ERR_ABORTED', () => {
  assert.equal(isTransientWindowLoadError(-2), true)
  assert.equal(isTransientWindowLoadError(-102), true)
  assert.equal(isTransientWindowLoadError(-3), false)

  assert.equal(shouldRetryWindowLoad({ attempt: 1, errorCode: -2 }), true)
  assert.equal(shouldRetryWindowLoad({ attempt: 1, errorCode: -3 }), false)
  assert.equal(shouldRetryWindowLoad({ attempt: WINDOW_LOAD_MAX_ATTEMPTS, errorCode: -2 }), false)
  assert.equal(shouldRetryWindowLoad({ attempt: 1, watchdogHung: true, currentUrl: 'about:blank' }), true)
  assert.equal(
    shouldRetryWindowLoad({ attempt: 1, watchdogHung: true, currentUrl: 'http://127.0.0.1:5174/' }),
    false
  )
  assert.equal(windowLoadRetryDelayMs(1), 500)
  assert.equal(windowLoadRetryDelayMs(3), 2000)
})

test('watchdog retries a hung about:blank load', () => {
  const win = makeFakeWindow()
  const logs: string[] = []
  const timers: Array<{ callback: () => void }> = []

  loadWindowUrlWithRetry(win, 'http://127.0.0.1:5174/', 'Renderer', {
    log: message => logs.push(message),
    watchdogMs: 50,
    setTimer: callback => {
      timers.push({ callback })
      return 1 as unknown as ReturnType<typeof setTimeout>
    },
    clearTimer: () => undefined
  })

  assert.equal(win.loadCalls.length, 1)
  timers[0]?.callback()
  assert.equal(win.stopCalls.length, 0)
  assert.match(logs.join('\n'), /still on about:blank/)
  timers.at(-1)?.callback()
  assert.equal(win.loadCalls.length, 2)
})

test('did-fail-load ERR_FAILED retries; committed load stops retrying', () => {
  const win = makeFakeWindow()
  const logs: string[] = []
  const timers: Array<{ callback: () => void }> = []

  loadWindowUrlWithRetry(win, 'http://127.0.0.1:5174/', 'Renderer', {
    log: message => logs.push(message),
    watchdogMs: 10_000,
    setTimer: callback => {
      timers.push({ callback })
      return 1 as unknown as ReturnType<typeof setTimeout>
    },
    clearTimer: () => undefined
  })

  win.webContents.emit('did-fail-load', {}, -2, 'ERR_FAILED', 'http://127.0.0.1:5174/', true)
  assert.match(logs.join('\n'), /transient did-fail-load/)
  timers.at(-1)?.callback()
  assert.equal(win.loadCalls.length, 2)

  win.setUrl('http://127.0.0.1:5174/')
  win.webContents.emit('did-finish-load')
  win.webContents.emit('did-fail-load', {}, -2, 'ERR_FAILED', 'http://127.0.0.1:5174/', true)
  assert.equal(win.loadCalls.length, 2)
})

test('reloadWindowContents loads the target URL when still on about:blank', () => {
  const blank = makeFakeWindow()
  const loaded: string[] = []

  reloadWindowContents(blank, 'http://127.0.0.1:5174/', (_win, url) => {
    loaded.push(url)
  })
  assert.deepEqual(loaded, ['http://127.0.0.1:5174/'])
  assert.equal(blank.reloadCalls.length, 0)

  const live = makeFakeWindow('http://127.0.0.1:5174/')
  reloadWindowContents(live, 'http://127.0.0.1:5174/', () => {
    loaded.push('should-not-load')
  })
  assert.equal(live.reloadCalls.length, 1)
  assert.equal(loaded.length, 1)
})
