/**
 * Strip ANSI escape sequences from installer / terminal output before it
 * reaches the desktop UI. Keep raw bytes in forensic logs (desktop.log /
 * bootstrap-*.log); only user-facing surfaces should call this.
 */

// CSI = ESC '[' params final. Match the common command set so color / cursor
// codes do not leak as literal "ESC[0;32m" in the install overlay.
// eslint-disable-next-line no-control-regex
const CSI_RE = /\x1b\[[\d;?]*[\x40-\x7e]/g
// Other ESC sequences (single-char, OSC terminated by BEL or ST).
// eslint-disable-next-line no-control-regex
const OTHER_ESCAPE_RE = /\x1b[@-Z\\-_]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g

export function stripAnsi(input: string): string {
  if (!input) {
    return input
  }

  return input.replace(OTHER_ESCAPE_RE, '').replace(CSI_RE, '')
}
