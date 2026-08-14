import assert from 'node:assert/strict'

import { test } from 'vitest'

import {
  applyListenGatewayAutoStart,
  defaultListenGatewaySettings,
  fetchListenGatewayStatus,
  getListenGatewaySnapshot,
  listenGatewayCliEnv,
  listenGatewayPidPath,
  listenGatewaySettingsPath,
  maybeAutoStartListenGateway,
  normalizeListenGatewaySettings,
  parseGatewayPidFile,
  parseGatewayStatusOutput,
  startListenGateway,
  stopListenGateway,
  type ListenGatewayIo
} from './listen-gateway'

function makeIo(overrides: Partial<ListenGatewayIo> & { files?: Record<string, string> } = {}): ListenGatewayIo {
  const files = overrides.files ?? {}
  const { files: _ignored, ...rest } = overrides

  return {
    engineRoot: '/engine',
    pythonPath: '/engine/venv/Scripts/python.exe',
    artemisHome: '/home/artemis',
    fileExists: filePath => filePath in files,
    readFile: filePath => files[filePath] ?? '',
    writeFile: (filePath, contents) => {
      files[filePath] = contents
    },
    mkdir: () => {},
    runCli: async () => ({ code: 0, stdout: '', stderr: '' }),
    randomToken: () => 'generated-token',
    ...rest
  }
}

test('normalizeListenGatewaySettings: fills defaults and clamps port', () => {
  assert.deepEqual(normalizeListenGatewaySettings(null), defaultListenGatewaySettings())
  assert.equal(normalizeListenGatewaySettings({ host: ' 10.0.0.8 ', port: 18789, token: 'k' }).host, '10.0.0.8')
  assert.equal(normalizeListenGatewaySettings({ port: 0 }).port, 8642)
  assert.equal(normalizeListenGatewaySettings({ port: 70000 }).port, 8642)
  assert.equal(normalizeListenGatewaySettings({ autoStart: true }).autoStart, true)
  assert.equal(normalizeListenGatewaySettings({ autoStart: 'yes' }).autoStart, false)
})

test('parseGatewayStatusOutput: running vs stopped', () => {
  assert.equal(parseGatewayStatusOutput('Gateway is running (PID: 4242)'), true)
  assert.equal(parseGatewayStatusOutput('active (running)'), true)
  assert.equal(parseGatewayStatusOutput('No gateway running for this profile'), false)
  assert.equal(parseGatewayStatusOutput('Gateway is not running'), false)
  assert.equal(parseGatewayStatusOutput(''), false)
})

test('getListenGatewaySnapshot: reads saved settings and the pid file, not the CLI', () => {
  const settingsFile = listenGatewaySettingsPath('/home/artemis')
  const pidFile = listenGatewayPidPath('/home/artemis')
  const io = makeIo({
    files: {
      [settingsFile]: JSON.stringify({ host: '0.0.0.0', port: 18789, token: 'abc' }),
      [pidFile]: JSON.stringify({ pid: 9 })
    },
    pidAlive: pid => pid === 9,
    runCli: async () => {
      throw new Error('snapshot must not spawn Python')
    }
  })
  const status = getListenGatewaySnapshot(io)

  assert.equal(status.running, true)
  assert.equal(status.port, 18789)
  assert.equal(status.token, 'abc')
})

test('fetchListenGatewayStatus: uses gateway status CLI for running', async () => {
  const file = listenGatewaySettingsPath('/home/artemis')
  const io = makeIo({
    files: { [file]: JSON.stringify({ host: '0.0.0.0', port: 18789, token: 'abc' }) },
    runCli: async args => {
      assert.equal(args.join(' '), '-m artemis_cli.main gateway status')

      return { code: 0, stdout: 'Gateway is running (PID: 9)\n', stderr: '' }
    }
  })
  const status = await fetchListenGatewayStatus(io)

  assert.equal(status.running, true)
  assert.equal(status.token, 'abc')
})

test('parseGatewayPidFile: json record, bare int, garbage', () => {
  assert.equal(parseGatewayPidFile('{"pid": 4242}'), 4242)
  assert.equal(parseGatewayPidFile('4242'), 4242)
  assert.equal(parseGatewayPidFile(''), null)
  assert.equal(parseGatewayPidFile('nope'), null)
})

test('startListenGateway: generates a key, persists settings, and starts', async () => {
  const files: Record<string, string> = {}
  const calls: string[][] = []
  const io = makeIo({
    files,
    runCli: async args => {
      calls.push(args)

      return { code: 0, stdout: 'started\n', stderr: '' }
    }
  })
  const status = await startListenGateway(io, { host: '0.0.0.0', port: 8642, token: '' })

  assert.equal(status.running, true)
  assert.equal(status.token, 'generated-token')
  assert.equal(calls[0]?.join(' '), '-m artemis_cli.main gateway start')
  assert.match(files[listenGatewaySettingsPath('/home/artemis')] ?? '', /generated-token/)
})

test('startListenGateway: throws the CLI stderr when start fails', async () => {
  const io = makeIo({
    runCli: async () => ({ code: 1, stdout: '', stderr: 'boom\n' })
  })

  await assert.rejects(() => startListenGateway(io, defaultListenGatewaySettings()), /boom/)
})

test('stopListenGateway: runs gateway stop', async () => {
  const calls: string[][] = []
  const io = makeIo({
    runCli: async args => {
      calls.push(args)

      return { code: 0, stdout: 'Stopped gateway\n', stderr: '' }
    }
  })
  const status = await stopListenGateway(io)

  assert.equal(status.running, false)
  assert.equal(calls[0]?.join(' '), '-m artemis_cli.main gateway stop')
})

test('listenGatewayCliEnv: exports API_SERVER listen fields', () => {
  const env = listenGatewayCliEnv(makeIo(), { host: '0.0.0.0', port: 18789, token: 'k' })

  assert.equal(env.API_SERVER_HOST, '0.0.0.0')
  assert.equal(env.API_SERVER_PORT, '18789')
  assert.equal(env.API_SERVER_KEY, 'k')
  assert.equal(env.API_SERVER_ENABLED, 'true')
  assert.equal(env.ARTEMIS_GATEWAY_SKIP_SERVICE, '1')
  assert.equal(env.ARTEMIS_NONINTERACTIVE, '1')
})

test('startListenGateway: keeps autoStart from saved settings', async () => {
  const files: Record<string, string> = {
    [listenGatewaySettingsPath('/home/artemis')]: JSON.stringify({
      host: '0.0.0.0',
      port: 8642,
      token: 'k',
      autoStart: true
    })
  }
  const io = makeIo({
    files,
    runCli: async () => ({ code: 0, stdout: 'started\n', stderr: '' })
  })
  const status = await startListenGateway(io, { host: '0.0.0.0', port: 8642, token: 'k' })

  assert.equal(status.autoStart, true)
  assert.match(files[listenGatewaySettingsPath('/home/artemis')] ?? '', /"autoStart": true/)
})

test('maybeAutoStartListenGateway: no-ops unless autoStart is saved', async () => {
  const calls: string[][] = []
  const io = makeIo({
    runCli: async args => {
      calls.push(args)

      return { code: 0, stdout: '', stderr: '' }
    }
  })

  const skipped = await maybeAutoStartListenGateway(io)
  assert.equal(skipped.running, false)
  assert.equal(skipped.autoStart, false)
  assert.equal(calls.length, 0)

  const started = await applyListenGatewayAutoStart(io, true)
  assert.equal(started.autoStart, true)
  assert.equal(started.running, true)
  assert.equal(calls[0]?.join(' '), '-m artemis_cli.main gateway start')
})
