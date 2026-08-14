/**
 * Detect half-renamed Hermes→Artemis agent trees that still ImportError.
 *
 * Symptom (0.17.34 AppData installs):
 *   - Directory named artemis-agent (often a junction to hermes-agent)
 *   - Some modules renamed (is_nous_artemis_*, _ARTEMIS_PROVIDER_ENV_BLOCKLIST)
 *   - Callers still import is_nous_hermes_* / _HERMES_PROVIDER_ENV_BLOCKLIST
 *
 * A tree that looks "installed" must NOT skip bootstrap when these
 * fingerprints remain, or Desktop/CLI keep toasting Hermes ImportErrors.
 */

import fs from 'node:fs'
import path from 'node:path'

export type StaleHermesFs = {
  existsSync: (p: string) => boolean
  readFileSync: (p: string, encoding: 'utf8') => string
}

const DEFAULT_FS: StaleHermesFs = {
  existsSync: fs.existsSync,
  readFileSync: (p, encoding) => fs.readFileSync(p, encoding)
}

function fileContains(root: string, rel: string, needle: string, io: StaleHermesFs): boolean {
  const full = path.join(root, rel)

  if (!io.existsSync(full)) {
    return false
  }

  try {
    return io.readFileSync(full, 'utf8').includes(needle)
  } catch {
    return false
  }
}

/**
 * True when the agent checkout is a Hermes half-rename that will crash
 * on Artemis-named symbols (or still calls Hermes-named ones).
 */
export function hasStaleHermesHalfRename(
  root: string | null | undefined,
  opts: { fs?: StaleHermesFs } = {}
): boolean {
  if (!root || typeof root !== 'string') {
    return false
  }

  const io = opts.fs || DEFAULT_FS

  const hasArtemisConstants = io.existsSync(path.join(root, 'artemis_constants.py'))
  const hasHermesConstants = io.existsSync(path.join(root, 'hermes_constants.py'))

  // Pre-rename or incomplete rename: Hermes constants without Artemis.
  if (hasHermesConstants && !hasArtemisConstants) {
    return true
  }

  // Callers still ask for Hermes symbols after partial rename.
  if (fileContains(root, 'cli.py', 'is_nous_hermes_non_agentic', io)) {
    return true
  }

  if (fileContains(root, path.join('tools', 'environments', 'docker.py'), '_HERMES_PROVIDER_ENV_BLOCKLIST', io)) {
    return true
  }

  if (fileContains(root, path.join('tools', 'env_passthrough.py'), '_HERMES_PROVIDER_ENV_BLOCKLIST', io)) {
    return true
  }

  return false
}
