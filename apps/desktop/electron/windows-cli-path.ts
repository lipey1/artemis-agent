// windows-cli-path.ts
//
// Put `artemis` on the user PATH after Desktop install / first-run on Windows.
// Linux mirrors this in packaging/linux/after-install.sh (+ ensureCliPathEntry
// copying scripts/artemis into ~/.local/bin). NSIS does not add a CLI shim, so
// Desktop must install artemis.cmd under %LOCALAPPDATA%\artemis\bin and ensure
// that directory is on the User PATH.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const WINDOWS_CLI_SHIM_NAME = 'artemis.cmd'

export function resolveWindowsCliBinDir(env: NodeJS.ProcessEnv = process.env): string {
  const home =
    env.ARTEMIS_HOME ||
    (env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'artemis') : path.join(os.homedir(), '.artemis'))
  return path.join(home, 'bin')
}

export function pathHasDir(pathValue: string | undefined | null, dir: string): boolean {
  if (!pathValue || !dir) return false
  const needle = path.normalize(dir).replace(/[/\\]+$/, '').toLowerCase()
  return pathValue
    .split(';')
    .map(entry => path.normalize(entry).replace(/[/\\]+$/, '').toLowerCase())
    .some(entry => entry === needle)
}

export function mergeUserPathWithDir(pathValue: string | undefined | null, dir: string): string {
  const entries = (pathValue || '')
    .split(';')
    .map(entry => entry.trim())
    .filter(Boolean)
  if (pathHasDir(entries.join(';'), dir)) {
    return entries.join(';')
  }
  return [dir, ...entries].join(';')
}

/**
 * Install artemis.cmd into %LOCALAPPDATA%\artemis\bin (or $ARTEMIS_HOME\bin)
 * and prepend that directory to the User PATH when missing.
 *
 * `srcCandidates` should prefer the packaged extraResource (`artemis.cmd`),
 * then the repo `scripts/artemis.cmd`.
 */
export function ensureWindowsCliPathEntry(opts: {
  srcCandidates: string[]
  env?: NodeJS.ProcessEnv
  fileExists?: (p: string) => boolean
  copyFile?: (src: string, dest: string) => void
  mkdir?: (dir: string) => void
  readUserPath?: () => string | null
  writeUserPath?: (value: string) => void
  broadcastPathChange?: () => void
  log?: (message: string) => void
}): { dest: string | null; pathUpdated: boolean } {
  const env = opts.env || process.env
  const fileExists =
    opts.fileExists ||
    ((p: string) => {
      try {
        return fs.statSync(p).isFile()
      } catch {
        return false
      }
    })
  const copyFile = opts.copyFile || ((src, dest) => fs.copyFileSync(src, dest))
  const mkdir = opts.mkdir || ((dir: string) => fs.mkdirSync(dir, { recursive: true }))
  const log = opts.log || (() => {})

  const src = opts.srcCandidates.find(fileExists)
  if (!src) {
    log('[cli] no Windows artemis.cmd wrapper found to install')
    return { dest: null, pathUpdated: false }
  }

  const binDir = resolveWindowsCliBinDir(env)
  const dest = path.join(binDir, WINDOWS_CLI_SHIM_NAME)

  try {
    mkdir(binDir)
    copyFile(src, dest)
  } catch (err) {
    log(`[cli] failed to install Windows PATH wrapper: ${err instanceof Error ? err.message : String(err)}`)
    return { dest: null, pathUpdated: false }
  }

  const readUserPath =
    opts.readUserPath ||
    (() => {
      try {
        const stdout = execFileSync('powershell.exe', [
          '-NoProfile',
          '-Command',
          "[Environment]::GetEnvironmentVariable('Path','User')"
        ], {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 10000
        })
        return String(stdout || '').replace(/\r?\n$/, '')
      } catch {
        return null
      }
    })

  const writeUserPath =
    opts.writeUserPath ||
    ((value: string) => {
      execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          "[Environment]::SetEnvironmentVariable('Path',$env:ARTEMIS_PATH_VALUE,'User')",
        ],
        {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 10000,
          env: { ...process.env, ARTEMIS_PATH_VALUE: value }
        }
      )
    })

  const broadcastPathChange =
    opts.broadcastPathChange ||
    (() => {
      try {
        execFileSync(
          'powershell.exe',
          [
            '-NoProfile',
            '-Command',
            "Add-Type -Namespace Win32 -Name Native -MemberDefinition '[DllImport(\"user32.dll\",SetLastError=true,CharSet=CharSet.Auto)] public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);'; $r=[UIntPtr]::Zero; [void][Win32.Native]::SendMessageTimeout([IntPtr]0xffff,0x1A,[UIntPtr]::Zero,'Environment',0,5000,[ref]$r)"
          ],
          { encoding: 'utf8', windowsHide: true, timeout: 10000 }
        )
      } catch {
        // Best-effort; new shells still pick up registry PATH.
      }
    })

  let pathUpdated = false
  try {
    const current = readUserPath()
    if (current != null && !pathHasDir(current, binDir)) {
      const next = mergeUserPathWithDir(current, binDir)
      writeUserPath(next)
      broadcastPathChange()
      pathUpdated = true
      log(`[cli] added ${binDir} to User PATH`)
    }
  } catch (err) {
    log(`[cli] failed to update User PATH: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Make the shim visible in this process immediately (Desktop-spawned shells).
  if (!pathHasDir(env.PATH, binDir)) {
    env.PATH = [binDir, env.PATH].filter(Boolean).join(';')
  }

  return { dest, pathUpdated }
}
