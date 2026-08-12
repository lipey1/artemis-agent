/**
 * Linux .deb in-app update helpers.
 *
 * Packaged installs live under /opt/Artemis (or /usr/bin/Artemis → that binary).
 * They cannot be replaced by `artemis desktop --build-only` (linux-unpacked).
 * Update now downloads Artemis-*-linux-*.deb from GitHub Releases and installs
 * via pkexec + apt/dpkg, then relaunches.
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'

import { OFFICIAL_REPO_SLUG } from './update-remote'
import { buildRelaunchScript, collectRelaunchEnv } from './update-relaunch'

const RELEASES_API = `https://api.github.com/repos/${OFFICIAL_REPO_SLUG}/releases/latest`

function shellQuote(value: string): string {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

/** True when this process is the system .deb install (not AppImage / unpacked). */
function isDebInstall(execPath: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.APPIMAGE) return false
  const resolved = (() => {
    try {
      return fs.realpathSync(execPath)
    } catch {
      return execPath
    }
  })()
  if (resolved.startsWith('/opt/Artemis/')) return true
  if (execPath === '/usr/bin/Artemis' || resolved === '/usr/bin/Artemis') return true
  return false
}

function debArchForNodeArch(nodeArch: string = process.arch): string {
  if (nodeArch === 'arm64' || nodeArch === 'aarch64') return 'arm64'
  return 'amd64'
}

type ReleaseAsset = { name?: string; browser_download_url?: string; size?: number }

function pickDebAsset(
  assets: ReleaseAsset[],
  arch: string = debArchForNodeArch()
): { name: string; url: string; size: number } | null {
  const suffix = `linux-${arch}.deb`
  const match = (assets || []).find(a => {
    const name = String(a?.name || '')
    return name.startsWith('Artemis-') && name.endsWith(suffix) && a?.browser_download_url
  })
  if (!match?.browser_download_url || !match.name) return null
  return { name: match.name, url: match.browser_download_url, size: Number(match.size) || 0 }
}

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Artemis-Desktop'
        }
      },
      res => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchJson(res.headers.location).then(resolve, reject)
          return
        }
        if ((res.statusCode || 0) >= 400) {
          reject(new Error(`HTTP ${res.statusCode} from ${url}`))
          res.resume()
          return
        }
        const chunks: Buffer[] = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          } catch (err) {
            reject(err)
          }
        })
      }
    )
    req.on('error', reject)
  })
}

function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (received: number, total: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (current: string) => {
      const req = https.get(current, { headers: { 'User-Agent': 'Artemis-Desktop' } }, res => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location)
          return
        }
        if ((res.statusCode || 0) >= 400) {
          reject(new Error(`Download HTTP ${res.statusCode}`))
          res.resume()
          return
        }
        const total = Number(res.headers['content-length'] || 0)
        let received = 0
        const out = fs.createWriteStream(destPath)
        res.on('data', chunk => {
          received += chunk.length
          if (onProgress) onProgress(received, total)
        })
        res.pipe(out)
        out.on('finish', () => out.close(() => resolve()))
        out.on('error', reject)
      })
      req.on('error', reject)
    }
    follow(url)
  })
}

/**
 * Root-only install script (no wait/relaunch — that stays in the desktop process).
 */
function buildDebInstallScript(debPath: string): string {
  const deb = shellQuote(debPath)
  return `#!/bin/bash
set -euo pipefail
DEB=${deb}
if command -v apt-get >/dev/null 2>&1; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y "$DEB" || dpkg -i "$DEB"
else
  dpkg -i "$DEB"
fi
rm -f "$DEB" 2>/dev/null || true
`
}

/**
 * Script run under pkexec as root: apt install the .deb only.
 * Relaunch is handled by the desktop after pkexec returns (avoids deadlock).
 */
function buildDebInstallAndRelaunchScript(opts: {
  debPath: string
  pid: number
  relaunchPath: string
  args?: string[]
}): string {
  // Kept for tests / docs; production uses buildDebInstallScript + buildRelaunchScript.
  return `${buildDebInstallScript(opts.debPath)}
# legacy combined form (unused by applyDebReleaseUpdate)
APP_PID=${Number(opts.pid)}
exec ${shellQuote(opts.relaunchPath)}
`
}

function runPkexecScript(scriptPath: string): Promise<{ code: number; stderr: string }> {
  return new Promise(resolve => {
    const child = spawn('pkexec', ['/bin/bash', scriptPath], {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stderr = ''
    child.stderr?.on('data', d => {
      stderr += String(d)
    })
    child.on('error', err => {
      resolve({ code: 127, stderr: err.message })
    })
    child.on('close', code => {
      resolve({ code: code ?? 1, stderr })
    })
  })
}

async function applyDebReleaseUpdate(opts: {
  execPath: string
  pid: number
  args?: string[]
  log?: (msg: string) => void
  onProgress?: (stage: string, message: string, percent: number | null) => void
  /** Injected for tests; production uses buildRelaunchScript from update-relaunch. */
  writeRelaunchScript?: (o: {
    pid: number
    execPath: string
    args: string[]
    env: Record<string, string>
    cwd: string
  }) => string
  spawnRelaunch?: (scriptPath: string) => void
  quitAfterMs?: number
}): Promise<{ ok: boolean; handedOff?: boolean; error?: string; message?: string }> {
  const log = opts.log || (() => {})
  const progress = opts.onProgress || (() => {})

  progress('download', 'Fetching latest Artemis release…', 15)
  let release: any
  try {
    release = await fetchJson(RELEASES_API)
  } catch (err) {
    return { ok: false, error: 'fetch-failed', message: err instanceof Error ? err.message : String(err) }
  }

  const asset = pickDebAsset(release.assets || [])
  if (!asset) {
    return {
      ok: false,
      error: 'no-deb-asset',
      message: 'No Linux .deb asset found on the latest GitHub release.'
    }
  }

  const tag = String(release.tag_name || '').replace(/^v/, '')
  progress('download', `Downloading Artemis ${tag}…`, 30)
  const debPath = path.join(os.tmpdir(), asset.name)
  try {
    await downloadFile(asset.url, debPath, (received, total) => {
      if (!total) return
      const pct = 30 + Math.floor((received / total) * 40)
      progress('download', `Downloading Artemis ${tag}…`, Math.min(pct, 70))
    })
  } catch (err) {
    return { ok: false, error: 'download-failed', message: err instanceof Error ? err.message : String(err) }
  }

  const relaunchPath = fs.existsSync('/usr/bin/Artemis')
    ? '/usr/bin/Artemis'
    : opts.execPath.startsWith('/opt/Artemis/')
      ? '/opt/Artemis/Artemis'
      : opts.execPath

  const installScriptPath = path.join(os.tmpdir(), `artemis-deb-install-${Date.now()}.sh`)
  fs.writeFileSync(installScriptPath, buildDebInstallScript(debPath), { mode: 0o755 })

  progress('install', 'Installing update (password prompt)…', 80)
  log(`[updates] deb install: pkexec ${installScriptPath} (${asset.name})`)

  const result = await runPkexecScript(installScriptPath)
  try {
    fs.unlinkSync(installScriptPath)
  } catch {
    /* ignore */
  }

  if (result.code !== 0) {
    const cancelled = /dismissed|cancelled|not authorized|polkit|Error organizing|No session/i.test(
      result.stderr
    )
    return {
      ok: false,
      error: cancelled ? 'cancelled' : 'install-failed',
      message: cancelled
        ? 'Update cancelled — authentication was dismissed.'
        : result.stderr.trim() || `Install failed (exit ${result.code})`
    }
  }

  progress('restart', 'Restarting Artemis…', 100)

  // Detached watcher waits for us to quit, then execs the new binary.
  const relaunchScript =
    opts.writeRelaunchScript?.({
      pid: opts.pid,
      execPath: relaunchPath,
      args: opts.args || [],
      env: collectRelaunchEnv(process.env),
      cwd: process.cwd()
    }) ||
    buildRelaunchScript({
      pid: opts.pid,
      execPath: relaunchPath,
      args: opts.args || [],
      env: collectRelaunchEnv(process.env),
      cwd: process.cwd()
    })

  const relaunchScriptPath = path.join(os.tmpdir(), `artemis-deb-relaunch-${Date.now()}.sh`)
  fs.writeFileSync(relaunchScriptPath, relaunchScript, { mode: 0o755 })

  if (opts.spawnRelaunch) {
    opts.spawnRelaunch(relaunchScriptPath)
  } else {
    const child = spawn('/bin/bash', [relaunchScriptPath], { detached: true, stdio: 'ignore' })
    child.unref()
  }
  log(`[updates] deb install OK; relaunch armed -> ${relaunchPath}`)

  return { ok: true, handedOff: true }
}

export {
  applyDebReleaseUpdate,
  buildDebInstallAndRelaunchScript,
  buildDebInstallScript,
  debArchForNodeArch,
  isDebInstall,
  pickDebAsset,
  RELEASES_API
}
