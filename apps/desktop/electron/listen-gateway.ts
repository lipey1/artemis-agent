/**
 * Start/stop the messaging gateway (`artemis gateway run`) from Desktop.
 *
 * This is NOT the local `artemis serve` backend the GUI already uses for chat.
 * Host / port / key are the API_SERVER_* listen settings other devices use
 * to reach this machine once the gateway is up.
 *
 * Dependency-injected so status parsing and settings IO can be unit-tested
 * without spawning Python or importing Electron.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const DEFAULT_LISTEN_GATEWAY_HOST = '0.0.0.0'
export const DEFAULT_LISTEN_GATEWAY_PORT = 8642

export type ListenGatewaySettings = {
  host: string
  port: number
  token: string
}

export type ListenGatewayStatus = ListenGatewaySettings & {
  running: boolean
}

export type RunCliResult = {
  code: number
  stdout: string
  stderr: string
}

export type ListenGatewayIo = {
  engineRoot: string
  pythonPath: string
  artemisHome: string
  fileExists?: (filePath: string) => boolean
  readFile?: (filePath: string) => string
  writeFile?: (filePath: string, contents: string) => void
  mkdir?: (dirPath: string) => void
  pidAlive?: (pid: number) => boolean
  runCli: (args: string[], env: Record<string, string>) => Promise<RunCliResult>
  randomToken?: () => string
}

export function listenGatewaySettingsPath(artemisHome: string): string {
  return path.join(artemisHome, 'listen-gateway.json')
}

export function defaultListenGatewaySettings(): ListenGatewaySettings {
  return {
    host: DEFAULT_LISTEN_GATEWAY_HOST,
    port: DEFAULT_LISTEN_GATEWAY_PORT,
    token: ''
  }
}

export function normalizeListenGatewaySettings(raw: unknown): ListenGatewaySettings {
  const defaults = defaultListenGatewaySettings()
  if (!raw || typeof raw !== 'object') {
    return defaults
  }

  const value = raw as Record<string, unknown>
  const host = typeof value.host === 'string' && value.host.trim() ? value.host.trim() : defaults.host
  const parsedPort = typeof value.port === 'number' ? value.port : Number.parseInt(String(value.port ?? ''), 10)
  const port = Number.isInteger(parsedPort) && parsedPort >= 1 && parsedPort <= 65535 ? parsedPort : defaults.port
  const token = typeof value.token === 'string' ? value.token : ''

  return { host, port, token }
}

export function parseGatewayStatusOutput(stdout: string, stderr = ''): boolean {
  const text = `${stdout}\n${stderr}`.toLowerCase()
  if (!text.trim()) {
    return false
  }

  if (/\bno gateway running\b/.test(text) || /\bnot running\b/.test(text) || /\binactive\b/.test(text)) {
    return false
  }

  return /\bgateway is running\b/.test(text) || /\bactive \(running\)/.test(text) || /\brunning \(pid\b/.test(text)
}

export function generateListenGatewayToken(): string {
  return crypto.randomBytes(24).toString('base64url')
}

export function listenGatewayPidPath(artemisHome: string): string {
  return path.join(artemisHome, 'gateway.pid')
}

export function parseGatewayPidFile(raw: string): number | null {
  const trimmed = String(raw || '').trim()
  if (!trimmed) {
    return null
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (typeof parsed === 'number' && Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }

    if (parsed && typeof parsed === 'object' && 'pid' in parsed) {
      const pid = Number((parsed as { pid: unknown }).pid)
      if (Number.isInteger(pid) && pid > 0) {
        return pid
      }
    }
  } catch {
    const pid = Number.parseInt(trimmed, 10)
    if (Number.isInteger(pid) && pid > 0) {
      return pid
    }
  }

  return null
}

export function isListenGatewayPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)

    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

export function probeListenGatewayRunning(io: ListenGatewayIo): boolean {
  const pidFile = listenGatewayPidPath(io.artemisHome)
  const exists = io.fileExists ?? (filePath => fs.existsSync(filePath))
  const read = io.readFile ?? (filePath => fs.readFileSync(filePath, 'utf8'))
  if (!exists(pidFile)) {
    return false
  }

  let raw = ''
  try {
    raw = read(pidFile)
  } catch {
    return false
  }

  const pid = parseGatewayPidFile(raw)
  if (pid == null) {
    return false
  }

  return (io.pidAlive ?? isListenGatewayPidAlive)(pid)
}

export function listenGatewayCliEnv(io: ListenGatewayIo, settings: ListenGatewaySettings): Record<string, string> {
  return {
    PYTHONPATH: io.engineRoot,
    ARTEMIS_HOME: io.artemisHome,
    ARTEMIS_ENGINE_ROOT: io.engineRoot,
    API_SERVER_ENABLED: 'true',
    API_SERVER_HOST: settings.host,
    API_SERVER_PORT: String(settings.port),
    API_SERVER_KEY: settings.token,
    ARTEMIS_GATEWAY_DETACHED: '1'
  }
}

export function loadListenGatewaySettings(io: ListenGatewayIo): ListenGatewaySettings {
  const file = listenGatewaySettingsPath(io.artemisHome)
  const exists = io.fileExists ?? (filePath => fs.existsSync(filePath))
  const read = io.readFile ?? (filePath => fs.readFileSync(filePath, 'utf8'))
  if (!exists(file)) {
    return defaultListenGatewaySettings()
  }

  try {
    return normalizeListenGatewaySettings(JSON.parse(read(file)))
  } catch {
    return defaultListenGatewaySettings()
  }
}

export function saveListenGatewaySettings(io: ListenGatewayIo, settings: ListenGatewaySettings): ListenGatewaySettings {
  const normalized = normalizeListenGatewaySettings(settings)
  const file = listenGatewaySettingsPath(io.artemisHome)
  const mkdir = io.mkdir ?? (dirPath => fs.mkdirSync(dirPath, { recursive: true }))
  const write = io.writeFile ?? ((filePath, contents) => fs.writeFileSync(filePath, contents, 'utf8'))
  mkdir(io.artemisHome)
  write(file, `${JSON.stringify(normalized, null, 2)}\n`)

  return normalized
}

function cliFailure(result: RunCliResult): Error {
  return new Error((result.stderr || result.stdout).trim() || `exit ${result.code}`)
}

export function getListenGatewaySnapshot(io: ListenGatewayIo): ListenGatewayStatus {
  const settings = loadListenGatewaySettings(io)

  return { ...settings, running: probeListenGatewayRunning(io) }
}

export async function fetchListenGatewayStatus(io: ListenGatewayIo): Promise<ListenGatewayStatus> {
  const settings = loadListenGatewaySettings(io)
  const result = await io.runCli(['-m', 'artemis_cli.main', 'gateway', 'status'], listenGatewayCliEnv(io, settings))

  return { ...settings, running: parseGatewayStatusOutput(result.stdout, result.stderr) }
}

export async function startListenGateway(
  io: ListenGatewayIo,
  input: ListenGatewaySettings
): Promise<ListenGatewayStatus> {
  let settings = normalizeListenGatewaySettings(input)
  if (!settings.token.trim()) {
    settings = { ...settings, token: (io.randomToken ?? generateListenGatewayToken)() }
  }

  saveListenGatewaySettings(io, settings)
  const result = await io.runCli(['-m', 'artemis_cli.main', 'gateway', 'start'], listenGatewayCliEnv(io, settings))
  if (result.code !== 0) {
    throw cliFailure(result)
  }

  return { ...settings, running: true }
}

export async function stopListenGateway(io: ListenGatewayIo): Promise<ListenGatewayStatus> {
  const settings = loadListenGatewaySettings(io)
  const result = await io.runCli(['-m', 'artemis_cli.main', 'gateway', 'stop'], listenGatewayCliEnv(io, settings))
  if (result.code !== 0) {
    throw cliFailure(result)
  }

  return { ...settings, running: false }
}
