// First-load recovery for a blank BrowserWindow.
//
// Chromium can crash its network service during the initial `loadURL`
// (Windows + Electron 40 is a frequent hit). The navigation never commits,
// `did-fail-load` may never fire, and the window stays on `about:blank` with
// the themed `#111111` chrome: a black screen. `webContents.reload()` then
// reloads `about:blank` forever.
//
// Retry transient failures and a hung about:blank watchdog. Persistent errors
// (missing file, abort of a superseded navigation) stay log-only.

export const TRANSIENT_WINDOW_LOAD_CODES = new Set([
  -2, // ERR_FAILED (network service crash)
  -21, // ERR_NETWORK_CHANGED
  -100, // ERR_CONNECTION_CLOSED
  -101, // ERR_CONNECTION_RESET
  -102, // ERR_CONNECTION_REFUSED
  -103, // ERR_CONNECTION_ABORTED
  -118, // ERR_CONNECTION_TIMED_OUT
  -324 // ERR_EMPTY_RESPONSE
])

export const WINDOW_LOAD_MAX_ATTEMPTS = 6
export const WINDOW_LOAD_WATCHDOG_MS = 4_000

export function isBlankWindowUrl(url: string | undefined | null): boolean {
  return !url || url === 'about:blank'
}

export function isCommittedTargetUrl(current: string | undefined | null, target: string): boolean {
  if (isBlankWindowUrl(current)) {
    return false
  }

  const normalize = (value: string) => value.replace(/\/$/, '')
  const live = normalize(String(current).split('#')[0] ?? '')
  const want = normalize(target.split('#')[0] ?? '')

  return live === want || live.startsWith(`${want}?`) || live.startsWith(`${want}/`)
}

export function isTransientWindowLoadError(errorCode: unknown): boolean {
  return typeof errorCode === 'number' && TRANSIENT_WINDOW_LOAD_CODES.has(errorCode)
}

export function windowLoadRetryDelayMs(attempt: number): number {
  return Math.min(2_000, 500 * 2 ** Math.max(0, attempt - 1))
}

export function shouldRetryWindowLoad(input: {
  attempt: number
  maxAttempts?: number
  errorCode?: unknown
  currentUrl?: string | null
  watchdogHung?: boolean
}): boolean {
  const maxAttempts = input.maxAttempts ?? WINDOW_LOAD_MAX_ATTEMPTS

  if (input.attempt >= maxAttempts) {
    return false
  }

  if (input.watchdogHung) {
    return isBlankWindowUrl(input.currentUrl)
  }

  if (input.errorCode !== undefined) {
    return isTransientWindowLoadError(input.errorCode)
  }

  return true
}

type TimerHandle = ReturnType<typeof setTimeout>

export type LoadWindowUrlTarget = {
  isDestroyed: () => boolean
  loadURL: (url: string) => Promise<unknown>
  webContents: {
    getURL: () => string
    on: (event: string, listener: (...args: unknown[]) => void) => void
    removeListener: (event: string, listener: (...args: unknown[]) => void) => void
    stop?: () => void
  }
}

export type LoadWindowUrlOptions = {
  log: (message: string) => void
  describeError?: (error: unknown) => string
  maxAttempts?: number
  watchdogMs?: number
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle
  clearTimer?: (timer: TimerHandle) => void
}

export function loadWindowUrlWithRetry(
  win: LoadWindowUrlTarget,
  url: string,
  label: string,
  {
    log,
    describeError = error => String(error),
    maxAttempts = WINDOW_LOAD_MAX_ATTEMPTS,
    watchdogMs = WINDOW_LOAD_WATCHDOG_MS,
    setTimer = (callback, delayMs) => setTimeout(callback, delayMs),
    clearTimer = timer => clearTimeout(timer)
  }: LoadWindowUrlOptions
): () => void {
  let attempt = 0
  let finished = false
  let watchdog: TimerHandle | null = null
  let retryTimer: TimerHandle | null = null

  const clearWatchdog = () => {
    if (watchdog === null) {
      return
    }

    clearTimer(watchdog)
    watchdog = null
  }

  const clearRetry = () => {
    if (retryTimer === null) {
      return
    }

    clearTimer(retryTimer)
    retryTimer = null
  }

  const dispose = () => {
    finished = true
    clearWatchdog()
    clearRetry()
    win.webContents.removeListener('did-fail-load', onFail)
    win.webContents.removeListener('did-finish-load', onFinish)
  }

  const markFinished = () => {
    if (finished) {
      return
    }

    dispose()
  }

  const armWatchdog = () => {
    clearWatchdog()
    watchdog = setTimer(() => {
      watchdog = null

      if (finished || win.isDestroyed()) {
        return
      }

      const currentUrl = win.webContents.getURL()

      if (
        !shouldRetryWindowLoad({
          attempt,
          maxAttempts,
          currentUrl,
          watchdogHung: true
        })
      ) {
        return
      }

      log(`${label} still on about:blank after ${watchdogMs}ms; retrying`)
      scheduleRetry('watchdog about:blank')
    }, watchdogMs)
  }

  const tryLoad = () => {
    if (finished || win.isDestroyed()) {
      return
    }

    attempt += 1
    armWatchdog()
    win.loadURL(url).catch(error => {
      if (finished || win.isDestroyed()) {
        return
      }

      log(`${label} failed to load (attempt ${attempt}): ${describeError(error)}`)

      if (shouldRetryWindowLoad({ attempt, maxAttempts })) {
        scheduleRetry('loadURL rejection')
      }
    })
  }

  const scheduleRetry = (why: string) => {
    if (finished || win.isDestroyed()) {
      return
    }

    if (!shouldRetryWindowLoad({ attempt, maxAttempts })) {
      log(`${label} gave up after ${attempt} load attempts (${why})`)
      return
    }

    const delay = windowLoadRetryDelayMs(attempt)
    log(`${label} retrying load in ${delay}ms (${why})`)
    clearWatchdog()
    clearRetry()
    retryTimer = setTimer(() => {
      retryTimer = null
      tryLoad()
    }, delay)
  }

  const onFail = (
    _event: unknown,
    errorCode: unknown,
    errorDescription: unknown,
    validatedURL: unknown,
    isMainFrame?: unknown
  ) => {
    if (finished || isMainFrame !== true) {
      return
    }

    const failedUrl = String(validatedURL ?? '')

    if (failedUrl && failedUrl !== 'about:blank' && !isCommittedTargetUrl(failedUrl, url) && failedUrl !== url) {
      return
    }

    if (
      !shouldRetryWindowLoad({
        attempt,
        maxAttempts,
        errorCode
      })
    ) {
      log(`${label} did-fail-load code=${String(errorCode)} ${String(errorDescription ?? '')} url=${failedUrl || url}`)
      return
    }

    log(`${label} transient did-fail-load code=${String(errorCode)}; will retry`)
    scheduleRetry(`did-fail-load ${String(errorCode)}`)
  }

  const onFinish = () => {
    if (finished) {
      return
    }

    if (isCommittedTargetUrl(win.webContents.getURL(), url)) {
      markFinished()
    }
  }

  win.webContents.on('did-fail-load', onFail)
  win.webContents.on('did-finish-load', onFinish)
  tryLoad()

  return dispose
}

export function reloadWindowContents(
  win: LoadWindowUrlTarget & { webContents: LoadWindowUrlTarget['webContents'] & { reload?: () => void } },
  url: string,
  load: (target: LoadWindowUrlTarget, targetUrl: string) => void
): void {
  if (isBlankWindowUrl(win.webContents.getURL())) {
    load(win, url)
    return
  }

  win.webContents.reload?.()
}
