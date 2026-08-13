# Building Artemis Desktop

Artemis-only checkout. There is no Artemis compatibility layer in this repo.

## Requirements

- **Node.js** >= 22
- **pnpm** (see root `packageManager` in `package.json`)

## Install dependencies

From the repository root:

```bash
pnpm install:desktop
```

On first install, native Electron deps may need build script approval:

```bash
cd apps/desktop && pnpm approve-builds --all
```

Then run `pnpm install:desktop` again from the root if needed.

## Day-to-day commands (repo root)

```bash
pnpm dev      # Vite + Electron in development
pnpm build    # Production UI + Electron bundle
pnpm start    # Run after build (production-like)
```

Compile Electron main/preload only:

```bash
cd apps/desktop && pnpm exec tsc --build tsconfig.electron.json
```

## Environment

| Variable | Purpose |
|----------|---------|
| `ARTEMIS_HOME` | User data root (default `~/.artemis`) |
| `ARTEMIS_DESKTOP_ARTEMIS_ROOT` | Engine tree on disk (default `/usr/local/lib/artemis-agent`) |
| `ELECTRON_DISABLE_SANDBOX=1` | Linux dev when sandbox blocks the app |

Example (Linux dev):

```bash
export ARTEMIS_HOME="$HOME/.artemis"
export ARTEMIS_DESKTOP_ARTEMIS_ROOT=/usr/local/lib/artemis-agent
export ELECTRON_DISABLE_SANDBOX=1
pnpm dev
```

## Engine install path

The desktop shell expects a full Artemis agent tree at:

- **`/usr/local/lib/artemis-agent`**, or
- **`~/.artemis/artemis-agent`** after Desktop first-run bootstrap

Install the engine separately, or let Desktop populate `~/.artemis/artemis-agent` on first launch.

## Installers

From the repo root after `pnpm build`:

```bash
pnpm dist          # current platform
pnpm dist:win      # Windows (from Linux/macOS with electron-builder)
```

Or from `apps/desktop`:

```bash
pnpm exec electron-builder --linux AppImage deb
pnpm exec electron-builder --win portable nsis
pnpm exec electron-builder --mac zip
```

Publish artifacts via GitHub Releases (binaries exceed git limits).

Current packages: https://github.com/lipey1/artemis-agent/releases/latest

After building or branding an engine tree, retarget update checks:

```bash
python3 scripts/retarget-updates.py /path/to/artemis-agent
```

Mobile companion: https://github.com/lipey1/artemis-mobile
