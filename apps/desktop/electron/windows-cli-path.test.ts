import assert from 'node:assert/strict'
import path from 'node:path'

import { test } from 'vitest'

import {
  mergeUserPathWithDir,
  pathHasDir,
  resolveWindowsCliBinDir,
  ensureWindowsCliPathEntry
} from './windows-cli-path'

test('resolveWindowsCliBinDir prefers ARTEMIS_HOME', () => {
  assert.equal(
    resolveWindowsCliBinDir({ ARTEMIS_HOME: 'D:\\ArtemisData', LOCALAPPDATA: 'C:\\Users\\x\\AppData\\Local' }),
    path.join('D:\\ArtemisData', 'bin')
  )
})

test('resolveWindowsCliBinDir defaults to LOCALAPPDATA\\artemis\\bin', () => {
  assert.equal(
    resolveWindowsCliBinDir({ LOCALAPPDATA: 'C:\\Users\\x\\AppData\\Local' }),
    path.join('C:\\Users\\x\\AppData\\Local', 'artemis', 'bin')
  )
})

test('pathHasDir matches case-insensitively and ignores trailing separators', () => {
  assert.equal(pathHasDir('C:\\a;C:\\Users\\x\\AppData\\Local\\artemis\\bin\\;C:\\b', 'C:\\Users\\x\\AppData\\Local\\artemis\\bin'), true)
  assert.equal(pathHasDir('C:\\a;C:\\b', 'C:\\Users\\x\\AppData\\Local\\artemis\\bin'), false)
})

test('mergeUserPathWithDir prepends when missing and is idempotent', () => {
  const dir = 'C:\\Users\\x\\AppData\\Local\\artemis\\bin'
  assert.equal(mergeUserPathWithDir('C:\\a;C:\\b', dir), `${dir};C:\\a;C:\\b`)
  assert.equal(mergeUserPathWithDir(`${dir};C:\\a`, dir), `${dir};C:\\a`)
})

test('ensureWindowsCliPathEntry copies shim and updates User PATH once', () => {
  const writes: string[] = []
  const copied: Array<{ src: string; dest: string }> = []
  let broadcast = 0
  const result = ensureWindowsCliPathEntry({
    srcCandidates: ['C:\\packaged\\artemis.cmd', 'C:\\repo\\scripts\\artemis.cmd'],
    env: { LOCALAPPDATA: 'C:\\Users\\x\\AppData\\Local', PATH: 'C:\\Windows\\System32' },
    fileExists: p => p === 'C:\\packaged\\artemis.cmd',
    copyFile: (src, dest) => {
      copied.push({ src, dest })
    },
    mkdir: () => {},
    readUserPath: () => 'C:\\Windows\\System32',
    writeUserPath: value => {
      writes.push(value)
    },
    broadcastPathChange: () => {
      broadcast += 1
    }
  })

  assert.equal(result.dest, path.join('C:\\Users\\x\\AppData\\Local', 'artemis', 'bin', 'artemis.cmd'))
  assert.equal(result.pathUpdated, true)
  assert.deepEqual(copied, [
    {
      src: 'C:\\packaged\\artemis.cmd',
      dest: path.join('C:\\Users\\x\\AppData\\Local', 'artemis', 'bin', 'artemis.cmd')
    }
  ])
  assert.equal(writes.length, 1)
  assert.ok(writes[0].startsWith(path.join('C:\\Users\\x\\AppData\\Local', 'artemis', 'bin')))
  assert.equal(broadcast, 1)
})

test('ensureWindowsCliPathEntry skips PATH write when already present', () => {
  const bin = path.join('C:\\Users\\x\\AppData\\Local', 'artemis', 'bin')
  let writes = 0
  const result = ensureWindowsCliPathEntry({
    srcCandidates: ['C:\\packaged\\artemis.cmd'],
    env: { LOCALAPPDATA: 'C:\\Users\\x\\AppData\\Local', PATH: bin },
    fileExists: () => true,
    copyFile: () => {},
    mkdir: () => {},
    readUserPath: () => `${bin};C:\\Windows`,
    writeUserPath: () => {
      writes += 1
    }
  })
  assert.equal(result.dest, path.join(bin, 'artemis.cmd'))
  assert.equal(result.pathUpdated, false)
  assert.equal(writes, 0)
})
