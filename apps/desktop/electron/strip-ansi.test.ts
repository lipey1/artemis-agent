import assert from 'node:assert/strict'

import { test } from 'vitest'

import { stripAnsi } from './strip-ansi'

test('stripAnsi removes color and reset sequences from installer output', () => {
  const raw = '\u001b[0;32m✓\u001b[0m done\n\u001b[0;36m→\u001b[0m cloning'
  assert.equal(stripAnsi(raw), '✓ done\n→ cloning')
})

test('stripAnsi is a no-op for plain text', () => {
  assert.equal(stripAnsi('[bootstrap] starting'), '[bootstrap] starting')
})

test('stripAnsi handles empty input', () => {
  assert.equal(stripAnsi(''), '')
  assert.equal(stripAnsi(null as unknown as string), null)
})
