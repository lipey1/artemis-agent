#!/usr/bin/env node
// set-exe-identity.mjs — stamp the Artemis icon + version metadata onto the
// built Artemis.exe with resedit (pure JS PE editor). No Wine, no rcedit.exe.
//
// WHY THIS EXISTS
// ---------------
// apps/desktop/package.json sets build.win.signAndEditExecutable=false. That
// flag is load-bearing: turning electron-builder's own exe-editing ON also
// re-enables its signtool step, which fetches winCodeSign-2.6.0.7z, whose
// macOS symlinks crash 7-Zip on non-admin Windows (no Developer Mode = no
// SeCreateSymbolicLinkPrivilege). That is an unfixable dead end — we do NOT
// try to extract winCodeSign.
//
// The cost of disabling signAndEditExecutable is that electron-builder also
// skips rcedit, so the unpacked Artemis.exe keeps the stock Electron icon and
// "Electron" taskbar name. This script restores the icon + identity.
//
// rcedit (the Electron CLI) is a Windows .exe and needs Wine on Linux. That
// failed our cross-packs. resedit is JavaScript-only and works on the Linux
// builder.
//
// HOW IT RUNS
// -----------
// Primarily as an electron-builder `afterPack` hook (scripts/after-pack.mjs).
// Also runnable standalone:
//   node scripts/set-exe-identity.mjs <path-to-Artemis.exe>

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

import * as ResEdit from 'resedit'

import { isMain } from './utils.mjs'

const LANG_EN_US = 1033
const CODEPAGE_UNICODE = 1200

function readProductVersion(desktopRoot) {
  try {
    const pkg = JSON.parse(readFileSync(join(desktopRoot, 'package.json'), 'utf8'))
    const raw = String(pkg.version || '').trim()
    const parts = raw.split('.').map((n) => parseInt(n, 10) || 0)
    while (parts.length < 4) parts.push(0)
    return { raw: raw || '0.0.0', parts: parts.slice(0, 4) }
  } catch {
    return { raw: '0.0.0', parts: [0, 0, 0, 0] }
  }
}

async function stampExeIdentity(exe, desktopRoot = resolve(import.meta.dirname, '..')) {
  if (!exe || !existsSync(exe)) {
    throw new Error(`target exe not found: ${exe}`)
  }

  const icon = join(desktopRoot, 'assets', 'icon.ico')
  if (!existsSync(icon)) {
    throw new Error(`icon not found: ${icon}`)
  }

  console.log(`[set-exe-identity] stamping ${exe}`)
  console.log(`[set-exe-identity] icon: ${icon}`)

  const exeBuf = readFileSync(exe)
  const nt = ResEdit.NtExecutable.from(exeBuf, { ignoreCert: true })
  const res = ResEdit.NtExecutableResource.from(nt)
  const iconFile = ResEdit.Data.IconFile.from(readFileSync(icon))
  const icons = iconFile.icons.map((item) => item.data)

  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)
  if (groups.length === 0) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, LANG_EN_US, icons)
  } else {
    for (const group of groups) {
      ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, group.id, group.lang, icons)
    }
  }

  const version = readProductVersion(desktopRoot)
  const viList = ResEdit.Resource.VersionInfo.fromEntries(res.entries)
  const vi = viList[0] || ResEdit.Resource.VersionInfo.createEmpty()
  vi.setFileVersion(...version.parts, LANG_EN_US)
  vi.setProductVersion(...version.parts, LANG_EN_US)
  vi.setStringValues(
    { lang: LANG_EN_US, codepage: CODEPAGE_UNICODE },
    {
      ProductName: 'Artemis',
      FileDescription: 'Artemis',
      CompanyName: 'Artemis / lipey1',
      LegalCopyright: 'Copyright (c) 2026 Artemis / lipey1',
      FileVersion: version.raw,
      ProductVersion: version.raw,
      OriginalFilename: 'Artemis.exe',
      InternalName: 'Artemis'
    }
  )
  vi.outputToResourceEntries(res.entries)

  res.outputResource(nt)
  writeFileSync(exe, Buffer.from(nt.generate()))

  console.log('[set-exe-identity] done — Artemis icon + identity stamped')
}

export { stampExeIdentity }

if (isMain(import.meta.url)) {
  const exe = process.argv[2]
  if (!exe) {
    console.error('[set-exe-identity] usage: set-exe-identity.mjs <path-to-exe>')
    process.exit(2)
  }
  stampExeIdentity(exe).catch((err) => {
    console.error(`[set-exe-identity] ${err.message}`)
    process.exit(1)
  })
}
