import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildDebInstallAndRelaunchScript,
  buildDebInstallScript,
  debArchForNodeArch,
  isDebInstall,
  pickDebAsset
} from './update-deb-install'

test('isDebInstall: /opt/Artemis binary', () => {
  assert.equal(isDebInstall('/opt/Artemis/Artemis', {}), true)
})

test('isDebInstall: AppImage is not deb', () => {
  assert.equal(isDebInstall('/tmp/Artemis.AppImage', { APPIMAGE: '/tmp/Artemis.AppImage' }), false)
})

test('isDebInstall: linux-unpacked is not deb', () => {
  assert.equal(
    isDebInstall('/home/u/artemis/apps/desktop/release/linux-unpacked/Artemis', {}),
    false
  )
})

test('debArchForNodeArch', () => {
  assert.equal(debArchForNodeArch('x64'), 'amd64')
  assert.equal(debArchForNodeArch('arm64'), 'arm64')
})

test('pickDebAsset selects matching arch', () => {
  const assets = [
    { name: 'Artemis-0.17.16-linux-x86_64.AppImage', browser_download_url: 'https://x/a' },
    {
      name: 'Artemis-0.17.16-linux-amd64.deb',
      browser_download_url: 'https://x/Artemis-0.17.16-linux-amd64.deb',
      size: 100
    }
  ]
  const picked = pickDebAsset(assets, 'amd64')
  assert.ok(picked)
  assert.equal(picked!.name, 'Artemis-0.17.16-linux-amd64.deb')
})

test('buildDebInstallScript uses apt/dpkg', () => {
  const script = buildDebInstallScript('/tmp/Artemis-0.17.16-linux-amd64.deb')
  assert.match(script, /apt-get install -y/)
  assert.match(script, /dpkg -i/)
  assert.match(script, /Artemis-0\.17\.16-linux-amd64\.deb/)
})

test('buildDebInstallAndRelaunchScript still exports', () => {
  const script = buildDebInstallAndRelaunchScript({
    debPath: '/tmp/x.deb',
    pid: 1,
    relaunchPath: '/usr/bin/Artemis'
  })
  assert.match(script, /apt-get install/)
})
