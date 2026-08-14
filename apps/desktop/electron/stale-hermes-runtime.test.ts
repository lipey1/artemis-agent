import assert from 'node:assert/strict'
import path from 'node:path'

import { test } from 'vitest'

import { hasStaleHermesHalfRename } from './stale-hermes-runtime'

function memFs(files: Record<string, string>) {
  const norm = (p: string) => p.replace(/\\/g, '/')
  const map = new Map(Object.entries(files).map(([k, v]) => [norm(k), v]))

  return {
    existsSync: (p: string) => map.has(norm(p)),
    readFileSync: (p: string, _enc: 'utf8') => {
      const v = map.get(norm(p))
      if (v == null) throw new Error('ENOENT')
      return v
    }
  }
}

test('clean Artemis tree is not stale', () => {
  const root = '/tmp/artemis-agent'
  const io = memFs({
    [path.join(root, 'artemis_constants.py')]: 'def get_artemis_home(): ...\n',
    [path.join(root, 'cli.py')]: 'from artemis_cli.model_switch import is_nous_artemis_non_agentic\n',
    [path.join(root, 'tools', 'environments', 'docker.py')]: 'from .local import _ARTEMIS_PROVIDER_ENV_BLOCKLIST\n',
    [path.join(root, 'tools', 'env_passthrough.py')]: 'from tools.environments.local import _ARTEMIS_PROVIDER_ENV_BLOCKLIST\n'
  })

  assert.equal(hasStaleHermesHalfRename(root, { fs: io }), false)
})

test('hermes_constants without artemis_constants is stale', () => {
  const root = '/tmp/hermes-agent'
  const io = memFs({
    [path.join(root, 'hermes_constants.py')]: 'def get_hermes_home(): ...\n'
  })

  assert.equal(hasStaleHermesHalfRename(root, { fs: io }), true)
})

test('cli still importing is_nous_hermes_non_agentic is stale', () => {
  const root = '/tmp/half'
  const io = memFs({
    [path.join(root, 'artemis_constants.py')]: 'ok\n',
    [path.join(root, 'cli.py')]: 'from artemis_cli.model_switch import is_nous_hermes_non_agentic\n'
  })

  assert.equal(hasStaleHermesHalfRename(root, { fs: io }), true)
})

test('docker still importing _HERMES_PROVIDER_ENV_BLOCKLIST is stale', () => {
  const root = '/tmp/half'
  const io = memFs({
    [path.join(root, 'artemis_constants.py')]: 'ok\n',
    [path.join(root, 'tools', 'environments', 'docker.py')]: 'from .local import _HERMES_PROVIDER_ENV_BLOCKLIST\n'
  })

  assert.equal(hasStaleHermesHalfRename(root, { fs: io }), true)
})

test('null/empty root is not stale', () => {
  assert.equal(hasStaleHermesHalfRename(null), false)
  assert.equal(hasStaleHermesHalfRename(''), false)
})
