/**
 * Pure helpers for choosing a remote URL during passive update checks.
 *
 * A public install can end up with `origin=git@github.com:lipey1/artemis-desktop.git`.
 * If the user's GitHub SSH key is FIDO2/passkey-backed, a background `git fetch
 * origin` triggers an unexplained hardware-touch prompt. For passive checks
 * against the official repo we substitute the public HTTPS `ls-remote` path,
 * which needs no auth and cannot prompt. Active update/apply flows are left
 * unchanged.
 *
 * Extracted from main.ts so the security-critical remote detection is unit
 * testable without booting Electron (main.ts requires('electron') at load).
 */

const OFFICIAL_REPO_HTTPS_URL = 'https://github.com/lipey1/artemis-desktop.git'
/** host/owner/repo form used to compare git remotes (SSH vs HTTPS). */
const OFFICIAL_REPO_CANONICAL = 'github.com/lipey1/artemis-desktop'
/** owner/repo slug for raw.githubusercontent.com and API paths (no host prefix). */
const OFFICIAL_REPO_SLUG = 'lipey1/artemis-desktop'

function officialRepoRawUrl(relativePath: string, ref: string): string {
  const segment = String(relativePath || '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')

  return `https://raw.githubusercontent.com/${OFFICIAL_REPO_SLUG}/${ref}/${segment}`
}

// Normalize common GitHub remote URL forms to `host/owner/repo` (lowercased,
// no trailing slash, no .git suffix) so SSH and HTTPS forms of the same repo
// compare equal.
function canonicalGitHubRemote(url) {
  if (!url) {
    return ''
  }

  let value = String(url).trim()

  if (value.startsWith('git@github.com:')) {
    value = `github.com/${value.slice('git@github.com:'.length)}`
  } else if (value.startsWith('ssh://git@github.com/')) {
    value = `github.com/${value.slice('ssh://git@github.com/'.length)}`
  } else {
    try {
      const parsed = new URL(value)

      if (parsed.hostname && parsed.pathname) {
        value = `${parsed.hostname}${parsed.pathname}`
      }
    } catch {
      // Leave non-URL forms unchanged.
    }
  }

  value = value.trim().replace(/\/+$/, '')

  if (value.endsWith('.git')) {
    value = value.slice(0, -4)
  }

  return value.toLowerCase()
}

function isSshRemote(url) {
  const value = String(url || '')
    .trim()
    .toLowerCase()

  return value.startsWith('git@') || value.startsWith('ssh://')
}

function isOfficialSshRemote(url) {
  return isSshRemote(url) && canonicalGitHubRemote(url) === OFFICIAL_REPO_CANONICAL
}

export {
  canonicalGitHubRemote,
  isOfficialSshRemote,
  isSshRemote,
  officialRepoRawUrl,
  OFFICIAL_REPO_CANONICAL,
  OFFICIAL_REPO_HTTPS_URL,
  OFFICIAL_REPO_SLUG
}
