/**
 * Turn a GitHub Release body into short bullets for the in-app update overlay.
 *
 * The GUI update check talks to /releases/latest, not `git log`. Empty commit
 * lists used to fall through to a hardcoded "Improvements and fixes" line.
 */

const SKIP_HEADINGS = new Set([
  'assets',
  'checksums',
  'install',
  'test plan',
  'upgrade'
])

function tidyNote(raw: string): string {
  return String(raw || '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/[.;,\s]+$/, '')
    .trim()
}

export function parseGitHubReleaseNotes(body: string | null | undefined, maxItems = 6): string[] {
  const text = String(body || '').replace(/\r\n/g, '\n')
  const items: string[] = []
  let skipSection = false

  for (const rawLine of text.split('\n')) {
    const heading = rawLine.match(/^#{1,6}\s+(.+?)\s*$/)

    if (heading) {
      const title = heading[1].replace(/[*_`]/g, '').trim().toLowerCase()
      skipSection = SKIP_HEADINGS.has(title)
      continue
    }

    if (skipSection) {
      continue
    }

    const bullet = rawLine.match(/^\s*[-*+]\s+(.+)$/)

    if (!bullet) {
      continue
    }

    const cleaned = tidyNote(bullet[1])

    if (!cleaned) {
      continue
    }

    items.push(cleaned)

    if (items.length >= maxItems) {
      break
    }
  }

  return items
}

export function commitsFromReleaseNotes(
  notes: readonly string[],
  tag: string,
  at: number
): { author: string; at: number; sha: string; summary: string }[] {
  const prefix = tag || 'release'

  return notes.map((summary, index) => ({
    author: '',
    at,
    sha: `${prefix}-${index}`,
    summary
  }))
}
