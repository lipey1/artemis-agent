import assert from 'node:assert/strict'

import { test } from 'vitest'

import { commitsFromReleaseNotes, parseGitHubReleaseNotes } from './github-release-notes'

const SAMPLE = `## Summary
- Settings nav no longer leaves a hole between Archived Chats and About.
- HUD mode is removed from the titlebar and keybinds.
- The layout button in the titlebar is fully clickable again.

## Assets
- Windows NSIS: \`Artemis-0.17.43-win-x64.exe\`

## Upgrade
Click Update in Settings.
`

test('parseGitHubReleaseNotes keeps Summary bullets and drops Assets/Upgrade', () => {
  assert.deepEqual(parseGitHubReleaseNotes(SAMPLE), [
    'Settings nav no longer leaves a hole between Archived Chats and About',
    'HUD mode is removed from the titlebar and keybinds',
    'The layout button in the titlebar is fully clickable again'
  ])
})

test('parseGitHubReleaseNotes strips markdown and caps the list', () => {
  const body = ['## Summary', '- **Bold** note with `code`', '- second', '- third'].join('\n')
  assert.deepEqual(parseGitHubReleaseNotes(body, 2), ['Bold note with code', 'second'])
})

test('parseGitHubReleaseNotes returns empty for blank or heading-only bodies', () => {
  assert.deepEqual(parseGitHubReleaseNotes(''), [])
  assert.deepEqual(parseGitHubReleaseNotes('## Summary\n\nNothing here.'), [])
  assert.deepEqual(parseGitHubReleaseNotes(null), [])
})

test('commitsFromReleaseNotes maps bullets onto the overlay commit shape', () => {
  const commits = commitsFromReleaseNotes(['Fix the gap'], '0.17.44', 123)
  assert.deepEqual(commits, [{ author: '', at: 123, sha: '0.17.44-0', summary: 'Fix the gap' }])
})
