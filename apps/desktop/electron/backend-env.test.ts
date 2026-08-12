import assert from 'node:assert/strict'
import path from 'node:path'

import { test } from 'vitest'

import {
  appendUniquePathEntries,
  buildDesktopBackendEnv,
  buildDesktopBackendPath,
  artemisManagedNodePathEntries,
  artemisBackendSpawnEnv,
  normalizeArtemisHomeRoot,
  pathEnvKey,
  POSIX_SANE_PATH_ENTRIES
} from './backend-env'

test('desktop backend PATH adds Artemis-managed bins and missing POSIX sane entries', () => {
  const result = buildDesktopBackendPath({
    artemisHome: '/Users/test/.artemis',
    venvRoot: '/Users/test/.artemis/artemis-agent/venv',
    currentPath: '/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin',
    platform: 'darwin',
    pathModule: path.posix
  })

  const entries = result.split(':')
  // Both managed-Node layouts lead, POSIX-native shape first, then the venv.
  assert.deepEqual(entries.slice(0, 3), [
    '/Users/test/.artemis/node/bin',
    '/Users/test/.artemis/node',
    '/Users/test/.artemis/artemis-agent/venv/bin'
  ])
  assert.ok(entries.includes('/opt/homebrew/bin'), 'Apple Silicon Homebrew bin is added')
  assert.ok(entries.includes('/opt/homebrew/sbin'), 'Apple Silicon Homebrew sbin is added')
  assert.ok(entries.includes('/usr/local/sbin'), 'missing standard sbin is added')

  for (const expected of POSIX_SANE_PATH_ENTRIES) {
    assert.ok(entries.includes(expected), `${expected} should be present`)
  }
})

test('managed Node dirs lead with the platform-native layout but always offer both', () => {
  const posix = artemisManagedNodePathEntries('/Users/test/.artemis', {
    platform: 'darwin',
    pathModule: path.posix
  })

  const windows = artemisManagedNodePathEntries('C:\\Users\\test\\AppData\\Local\\artemis', {
    platform: 'win32',
    pathModule: path.win32
  })

  // install.sh uses node/bin; install.ps1 unpacks node.exe into node\ itself.
  // Both shapes are always emitted so migrated installs keep resolving.
  assert.deepEqual(posix, ['/Users/test/.artemis/node/bin', '/Users/test/.artemis/node'])
  assert.deepEqual(windows, [
    'C:\\Users\\test\\AppData\\Local\\artemis\\node',
    'C:\\Users\\test\\AppData\\Local\\artemis\\node\\bin'
  ])
})

test('managed Node dirs are empty without a Artemis home', () => {
  assert.deepEqual(artemisManagedNodePathEntries(undefined, { platform: 'darwin', pathModule: path.posix }), [])
  assert.deepEqual(artemisManagedNodePathEntries('', { platform: 'win32', pathModule: path.win32 }), [])
})

test('every managed Node dir outranks the inherited PATH on both platforms', () => {
  for (const [platform, pathModule, home, inherited, delimiter] of [
    ['darwin', path.posix, '/Users/test/.artemis', '/usr/local/bin:/usr/bin', ':'],
    ['win32', path.win32, 'C:\\artemis', 'C:\\Program Files\\nodejs;C:\\Windows\\System32', ';']
  ] as const) {
    const entries = buildDesktopBackendPath({
      artemisHome: home,
      venvRoot: null,
      currentPath: inherited,
      platform,
      pathModule
    }).split(delimiter)

    const managed = artemisManagedNodePathEntries(home, { platform, pathModule })
    const firstInherited = Math.min(...inherited.split(delimiter).map(entry => entries.indexOf(entry)))

    for (const dir of managed) {
      assert.ok(
        entries.indexOf(dir) >= 0 && entries.indexOf(dir) < firstInherited,
        `${dir} must precede the inherited PATH on ${platform}`
      )
    }
  }
})

test('desktop backend PATH preserves first occurrence and avoids duplicates', () => {
  const result = buildDesktopBackendPath({
    artemisHome: '/Users/test/.artemis',
    venvRoot: '/Users/test/.artemis/artemis-agent/venv',
    currentPath: '/opt/homebrew/bin:/usr/bin:/opt/homebrew/bin:/bin',
    platform: 'darwin',
    pathModule: path.posix
  })

  const entries = result.split(':')
  assert.equal(entries.filter(entry => entry === '/opt/homebrew/bin').length, 1)
  assert.ok(
    entries.indexOf('/opt/homebrew/bin') < entries.indexOf('/opt/homebrew/sbin'),
    'existing Homebrew bin keeps its precedence over appended missing sane entries'
  )
})

test('buildDesktopBackendEnv extends PYTHONPATH and backend PATH together', () => {
  const env = buildDesktopBackendEnv({
    artemisHome: '/Users/test/.artemis',
    pythonPathEntries: ['/repo/artemis-agent'],
    venvRoot: '/Users/test/.artemis/artemis-agent/venv',
    currentEnv: {
      PATH: '/usr/bin:/bin',
      PYTHONPATH: '/existing/pythonpath'
    },
    platform: 'darwin',
    pathModule: path.posix
  })

  assert.equal(env.PYTHONPATH, '/repo/artemis-agent:/existing/pythonpath')
  assert.ok(
    env.PATH.startsWith(
      '/Users/test/.artemis/node/bin:/Users/test/.artemis/node:/Users/test/.artemis/artemis-agent/venv/bin:'
    )
  )
  assert.ok(env.PATH.includes('/opt/homebrew/bin'))
})

test('buildDesktopBackendEnv forces PYTHONUTF8 unless the user set it explicitly', () => {
  const defaulted = buildDesktopBackendEnv({
    artemisHome: '/Users/test/.artemis',
    currentEnv: { PATH: '/usr/bin' },
    platform: 'darwin',
    pathModule: path.posix
  })

  assert.equal(defaulted.PYTHONUTF8, '1')

  const optedOut = buildDesktopBackendEnv({
    artemisHome: '/Users/test/.artemis',
    currentEnv: { PATH: '/usr/bin', PYTHONUTF8: '0' },
    platform: 'darwin',
    pathModule: path.posix
  })

  assert.equal(optedOut.PYTHONUTF8, '0')
})

test('normalizeArtemisHomeRoot maps profile homes back to the global Artemis root', () => {
  assert.equal(
    normalizeArtemisHomeRoot('/Users/test/.artemis/profiles/oracle', { pathModule: path.posix }),
    '/Users/test/.artemis'
  )
  assert.equal(
    normalizeArtemisHomeRoot('C:\\Users\\test\\AppData\\Local\\artemis\\profiles\\oracle', { pathModule: path.win32 }),
    'C:\\Users\\test\\AppData\\Local\\artemis'
  )
  assert.equal(normalizeArtemisHomeRoot('/Users/test/.artemis', { pathModule: path.posix }), '/Users/test/.artemis')
})

test('Windows PATH casing and delimiter are preserved without POSIX sane entries', () => {
  const env = buildDesktopBackendEnv({
    artemisHome: 'C:\\Users\\test\\AppData\\Local\\artemis',
    pythonPathEntries: ['C:\\repo\\artemis-agent'],
    venvRoot: 'C:\\Users\\test\\AppData\\Local\\artemis\\artemis-agent\\venv',
    currentEnv: {
      Path: 'C:\\Windows\\System32;C:\\Windows',
      PYTHONPATH: 'C:\\existing\\pythonpath'
    },
    platform: 'win32',
    pathModule: path.win32
  })

  assert.equal(pathEnvKey({ Path: 'x' }, 'win32'), 'Path')
  assert.equal(env.PATH, undefined)
  // Windows leads with the portable layout (install.ps1 unpacks node.exe
  // straight into node\, no bin\), then the POSIX shape for migrated installs.
  assert.ok(
    env.Path.startsWith(
      'C:\\Users\\test\\AppData\\Local\\artemis\\node;C:\\Users\\test\\AppData\\Local\\artemis\\node\\bin;'
    )
  )
  assert.ok(env.Path.includes('\\venv\\Scripts;'))
  assert.ok(env.Path.includes(';C:\\Windows\\System32;C:\\Windows'))
  assert.equal(env.Path.includes('/opt/homebrew/bin'), false)
})

test('appendUniquePathEntries drops empty entries and keeps first occurrence', () => {
  assert.equal(appendUniquePathEntries([':/a::/b', ['/a', '/c']], { delimiter: ':' }), '/a:/b:/c')
})

test('artemisBackendSpawnEnv pins Artemis desktop spawn env vars', () => {
  const env = artemisBackendSpawnEnv({
    artemisHome: '/home/u/.artemis',
    sessionToken: 'tok',
    parentPid: 42,
    webDist: '/dist',
    readyFile: '/tmp/ready.json'
  })

  assert.equal(env.ARTEMIS_HOME, '/home/u/.artemis')
  assert.equal(env.ARTEMIS_DASHBOARD_SESSION_TOKEN, 'tok')
  assert.equal(env.ARTEMIS_DESKTOP, '1')
  assert.equal(env.ARTEMIS_PARENT_PID, '42')
  assert.equal(env.ARTEMIS_WEB_DIST, '/dist')
  assert.equal(env.ARTEMIS_DESKTOP_READY_FILE, '/tmp/ready.json')
})
