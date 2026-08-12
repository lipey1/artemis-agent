import { accessSync } from "fs"
import { resolve, join } from "path"

const desktopRoot = resolve(import.meta.dirname, "..")
const repoRoot = resolve(desktopRoot, "..", "..")
const candidates = [
  join(desktopRoot, "node_modules", "vite", "package.json"),
  join(repoRoot, "node_modules", "vite", "package.json"),
]

let found = false
for (const candidate of candidates) {
  try {
    accessSync(candidate)
    found = true
    break
  } catch {
    // try next
  }
}

if (!found) {
  console.error(
    `Install desktop deps first:\n  cd ${repoRoot} && pnpm install:desktop\n  or:\n  cd ${desktopRoot} && pnpm install`,
  )
  process.exit(1)
}
