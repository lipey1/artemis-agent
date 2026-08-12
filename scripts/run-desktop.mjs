import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const desktop = path.join(repoRoot, "apps", "desktop")
const script = process.argv[2]

if (!script) {
  console.error("usage: node scripts/run-desktop.mjs <script> [...args]")
  process.exit(1)
}

const extra = process.argv.slice(3)
const userAgent = process.env.npm_config_user_agent || ""
const execPath = process.env.npm_execpath || ""
const usePnpm =
  /\bpnpm\b/.test(userAgent) ||
  /pnpm/.test(execPath) ||
  existsSync(path.join(desktop, "pnpm-lock.yaml"))
const cmd = usePnpm ? "pnpm" : "npm"
const args = usePnpm
  ? ["--dir", desktop, "run", script, ...extra]
  : ["run", script, "--prefix", desktop, "--", ...extra]

const child = spawn(cmd, args, {
  stdio: "inherit",
  cwd: repoRoot,
  shell: process.platform === "win32",
  env: process.env,
})

child.on("exit", (code, signal) => {
  if (signal) process.exit(1)
  process.exit(code ?? 1)
})
