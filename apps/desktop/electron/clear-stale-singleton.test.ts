import assert from 'node:assert/strict'
import test from 'node:test'

import {
  clearStaleChromiumSingleton,
  isPidAlive,
  parseSingletonLockPid
} from './clear-stale-singleton'

test('parseSingletonLockPid reads trailing pid', () => {
  assert.equal(parseSingletonLockPid('FelipePC-119363'), 119363)
  assert.equal(parseSingletonLockPid('host-1'), 1)
  assert.equal(parseSingletonLockPid('bad'), null)
  assert.equal(parseSingletonLockPid(''), null)
})

test('isPidAlive false when kill throws', () => {
  assert.equal(
    isPidAlive(999999, () => {
      throw new Error('ESRCH')
    }),
    false
  )
})

test('isPidAlive true when kill succeeds', () => {
  assert.equal(
    isPidAlive(1, () => true as any),
    true
  )
})

test('clearStaleChromiumSingleton removes files when pid is dead', () => {
  const removed: string[] = []
  const result = clearStaleChromiumSingleton('/tmp/fake-userdata', {
    lstatFn: () => ({ isSymbolicLink: () => true }),
    readlinkFn: () => 'FelipePC-4242',
    killFn: () => {
      throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' })
    },
    unlinkFn: p => {
      removed.push(p)
    }
  })
  assert.equal(result.cleared, true)
  if (result.cleared) {
    assert.equal(result.pid, 4242)
    assert.ok(removed.some(p => p.endsWith('SingletonLock')))
    assert.ok(removed.some(p => p.endsWith('SingletonSocket')))
  }
})

test('clearStaleChromiumSingleton keeps lock when pid is alive', () => {
  const result = clearStaleChromiumSingleton('/tmp/fake-userdata', {
    lstatFn: () => ({ isSymbolicLink: () => true }),
    readlinkFn: () => 'FelipePC-7',
    killFn: () => true as any,
    unlinkFn: () => {
      throw new Error('should not unlink')
    }
  })
  assert.deepEqual(result, { cleared: false, reason: 'pid-alive' })
})
