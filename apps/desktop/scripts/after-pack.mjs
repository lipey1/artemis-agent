/**
 * after-pack.mjs — electron-builder afterPack hook.
 *
 * Windows: stamps the Artemis icon + identity onto Artemis.exe via resedit.
 * Linux: marks chrome-sandbox mode 4755 in the unpacked tree so the bit is
 * present before fpm packs the .deb (after-install.sh re-applies as root).
 *
 * Best-effort: failures here must never fail an otherwise-good build.
 */

import fs from 'node:fs'
import path from 'node:path'

import { stampExeIdentity } from './set-exe-identity.mjs'

export default async function afterPack(context) {
  const platform = context.electronPlatformName

  if (platform === 'linux') {
    const sandbox = path.join(context.appOutDir, 'chrome-sandbox')
    try {
      if (fs.existsSync(sandbox)) {
        fs.chmodSync(sandbox, 0o4755)
        console.log(`[after-pack] set ${sandbox} mode 4755`)
      }
    } catch (err) {
      console.warn(`[after-pack] chrome-sandbox chmod failed (${err.message})`)
    }
    return
  }

  if (platform !== 'win32') {
    return
  }

  const productName = context.packager?.appInfo?.productFilename || 'Artemis'
  const exe = path.join(context.appOutDir, `${productName}.exe`)
  const desktopRoot = path.resolve(import.meta.dirname, '..')

  try {
    await stampExeIdentity(exe, desktopRoot)
  } catch (err) {
    // Never fail the build over a cosmetic stamp.
    console.warn(`[after-pack] exe identity stamp failed (${err.message}); Artemis.exe keeps the stock Electron icon`)
  }
}
