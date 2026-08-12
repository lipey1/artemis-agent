/**
 * Clear Chromium Singleton* files when they point at a dead PID.
 *
 * After `kill -9` / `pkill` the main process dies without removing
 * SingletonLock. The next launch then fails requestSingleInstanceLock(),
 * quits immediately (no window), and only the *second* click starts the app.
 */

import fs from 'node:fs'
import path from 'node:path'

const SINGLETON_FILES = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'] as const

/** Parse `hostname-pid` from a SingletonLock symlink target. */
export function parseSingletonLockPid(lockTarget: string): number | null {
  const match = /-(\d+)$/.exec(String(lockTarget || '').trim())
  if (!match) return null
  const pid = Number(match[1])
  return Number.isInteger(pid) && pid > 0 ? pid : null
}

/** True if `kill(pid, 0)` succeeds (process exists and is signalable). */
export function isPidAlive(pid: number, killFn: typeof process.kill = process.kill): boolean {
  try {
    killFn(pid, 0)
    return true
  } catch {
    return false
  }
}

export type ClearStaleSingletonResult =
  | { cleared: false; reason: 'no-lock' | 'not-symlink' | 'bad-target' | 'pid-alive' }
  | { cleared: true; pid: number; removed: string[] }

/**
 * If userData/SingletonLock is a symlink to hostname-<dead-pid>, remove the
 * Chromium singleton files so the next requestSingleInstanceLock() succeeds.
 */
export function clearStaleChromiumSingleton(
  userDataPath: string,
  opts: {
    killFn?: typeof process.kill
    readlinkFn?: (p: string) => string
    unlinkFn?: (p: string) => void
    lstatFn?: (p: string) => { isSymbolicLink(): boolean }
  } = {}
): ClearStaleSingletonResult {
  const killFn = opts.killFn || process.kill
  const readlinkFn = opts.readlinkFn || (p => fs.readlinkSync(p))
  const unlinkFn =
    opts.unlinkFn ||
    ((p: string) => {
      try {
        fs.unlinkSync(p)
      } catch {
        /* ignore missing */
      }
    })
  const lstatFn = opts.lstatFn || (p => fs.lstatSync(p))

  const lockPath = path.join(userDataPath, 'SingletonLock')
  let stat: { isSymbolicLink(): boolean }
  try {
    stat = lstatFn(lockPath)
  } catch {
    return { cleared: false, reason: 'no-lock' }
  }

  if (!stat.isSymbolicLink()) {
    return { cleared: false, reason: 'not-symlink' }
  }

  let target: string
  try {
    target = readlinkFn(lockPath)
  } catch {
    return { cleared: false, reason: 'no-lock' }
  }

  const pid = parseSingletonLockPid(target)
  if (pid == null) {
    return { cleared: false, reason: 'bad-target' }
  }

  if (isPidAlive(pid, killFn)) {
    return { cleared: false, reason: 'pid-alive' }
  }

  const removed: string[] = []
  for (const name of SINGLETON_FILES) {
    const filePath = path.join(userDataPath, name)
    try {
      unlinkFn(filePath)
      removed.push(name)
    } catch {
      /* ignore */
    }
  }

  return { cleared: true, pid, removed }
}
