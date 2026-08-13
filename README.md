# Artemis Desktop

**Artemis** is a native desktop agent for Linux, macOS, and Windows: chat, tools,
skills, gateway, and local config in one shell.

Companion app: **[Artemis Mobile](https://github.com/lipey1/artemis-mobile)** (Flutter client for Open WebUI and Artemis agents).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/lipey1/artemis-agent?include_prereleases)](https://github.com/lipey1/artemis-agent/releases)

## What you get

- **Desktop app** (Electron) branded as Artemis: logo, wordmark, window title, launcher
- **CLI** (`artemis`) that uses the same home and persona
- **Identity**: `SOUL.md` presents the assistant as Artemis
- **Home directory**: `~/.artemis` (config, logs, memories, skills)
- **Installers** for Linux, macOS, and Windows on
  [Releases](https://github.com/lipey1/artemis-agent/releases/latest)
- **Mobile companion**: [Artemis Mobile](https://github.com/lipey1/artemis-mobile)

Engine install tree: `/usr/local/lib/artemis-agent` (or `~/.artemis/artemis-agent`).

This repository contains the desktop UI (`apps/desktop`), shared types, and the Python agent (`artemis_cli` / `agent`). See [Development](#development) and [`docs/BUILDING.md`](./docs/BUILDING.md) for the repo-root **pnpm** workflow.

---

## Install (Linux / macOS / Windows)

Download the asset for your OS from the latest
[GitHub Release](https://github.com/lipey1/artemis-agent/releases/latest).

Binaries are published on Releases (they are too large for git). Checksums are in
[`SHA256SUMS`](https://github.com/lipey1/artemis-agent/releases/latest) on each release.

### Linux

| Asset | Notes |
|-------|--------|
| `Artemis-*-linux-x86_64.AppImage` | Portable |
| `Artemis-*-linux-amd64.deb` | Debian / Ubuntu |

```bash
chmod +x Artemis-*-linux-x86_64.AppImage
./Artemis-*-linux-x86_64.AppImage --no-sandbox --disable-gpu
```

```bash
sudo apt install ./Artemis-*-linux-amd64.deb
```

If Electron exits with code **133**, use `--disable-gpu`.

### macOS

| Asset | Notes |
|-------|--------|
| `Artemis-*-mac-x64.zip` | Portable app zip (unsigned cross-build) |

```bash
unzip Artemis-*-mac-x64.zip
# Open the .app from Finder, or:
open ./Artemis.app
```

If Gatekeeper blocks an unsigned build: System Settings → Privacy & Security →
Open Anyway.

### Windows

| Asset | Notes |
|-------|--------|
| `Artemis-*-win-x64-portable.zip` | Extract and run `Artemis.exe` |
| `Artemis-*-win-x64.exe` + `Artemis-*-win-x64.nsis.7z` | NSIS installer (keep both files in the same folder) |

Portable:

```powershell
Expand-Archive Artemis-*-win-x64-portable.zip -DestinationPath .\Artemis
.\Artemis\Artemis.exe
```

---

## CLI: talk to Artemis in the terminal

Requires a local Artemis engine install (Desktop bundle or
`/usr/local/lib/artemis-agent` / `~/.artemis/artemis-agent`).

Windows-safe naming (one lowercase command):

| Command | Opens |
|---------|--------|
| `artemis` | Agent CLI / TUI (cyan Artemis banner) |
| `artemis desktop` | Artemis Desktop app (installed `.deb` / AppImage when present) |

```bash
# Install wrapper (once)
curl -fsSL https://raw.githubusercontent.com/lipey1/artemis-agent/main/scripts/install-artemis-cli.sh | bash
# or copy scripts/artemis from this repo to ~/.local/bin/artemis

export PATH="$HOME/.local/bin:$PATH"
export ARTEMIS_HOME="$HOME/.artemis"

artemis -z "Quem é você?"
artemis chat
artemis desktop
artemis status
```

The CLI uses `~/.artemis` and your `SOUL.md` so the model answers as **Artemis**.
Do not rely on `Artemis` vs `artemis` case differences (broken on Windows).

Updates check **[lipey1/artemis-agent releases](https://github.com/lipey1/artemis-agent/releases/latest)**.
After branding an engine checkout, run:

```bash
python3 scripts/retarget-updates.py /path/to/artemis-agent
# or let scripts/apply-artemis-brand.sh call it for you
```

`artemis update` prints the Releases URL. Install a new Desktop build from
Releases when a newer tag is available.

---

## Artemis Mobile

For phones and tablets:

- Repo: [github.com/lipey1/artemis-mobile](https://github.com/lipey1/artemis-mobile)
- Flutter client (based on Conduit) branded as Artemis
- Talks to Open WebUI servers and Artemis agent backends

---

## Data layout

| Path | Purpose |
|------|---------|
| `~/.artemis/config.yaml` | Main config |
| `~/.artemis/.env` | Secrets / API keys |
| `~/.artemis/SOUL.md` | Persona (Artemis identity) |
| `~/.artemis/logs/` | `desktop.log`, `agent.log`, gateway logs |
| `~/.artemis/memories/` | Persistent memory |
| `~/.artemis/skills/` | Skills |
| `~/.artemis/artemis-agent/` | Engine checkout used by Desktop |
| `~/.artemis/desktop-plugins/` | Local desktop plugins |

On Windows the default home is `%LOCALAPPDATA%\artemis`.

---

## Features

1. Artemis product branding (desktop + CLI)
2. Dedicated `~/.artemis` home
3. `artemis` CLI front-end with Artemis help/version surface
4. Persona file that forces Artemis identity in chat
5. Installers for Linux, macOS, and Windows on GitHub Releases
6. Companion [Artemis Mobile](https://github.com/lipey1/artemis-mobile)

### Logical / visual fixes

1. Duplicate launcher entries cleaned up
2. Tooltip chrome matches dark elevated panels
3. Sidebar Pinned / Sessions use clear Codicon icons
4. Settings crash from aggressive minified-string rebranding avoided
5. Path copy in allowlist / settings points at `~/.artemis`
6. Dock / `.desktop` `StartupWMClass` aligned with Artemis
7. Terminal theme defaults to cyan Artemis palette

---

## License

MIT. See [`LICENSE`](./LICENSE).

Copyright for Artemis Desktop distribution and modifications: Artemis Desktop
contributors.

---

## Attribution

- Mobile companion: [lipey1/artemis-mobile](https://github.com/lipey1/artemis-mobile)
- This repository: Artemis Desktop by [@lipey1](https://github.com/lipey1)

---

## Repository layout

```text
LICENSE
README.md
apps/desktop/          Electron + React UI (main desktop app)
artemis_cli/           `artemis` CLI package
agent/                 Python agent runtime
brand/                 Logo and icons
docs/                  Build and project docs
packaging/             .desktop templates
scripts/               artemis CLI wrapper + install helpers
release/               Checksums + pointer to GitHub Releases
                       (installer binaries are not stored in git)
```

---

## Development

Node.js **>= 22** and **pnpm** at the repo root. Full steps, env vars, and Electron compile commands are in [`docs/BUILDING.md`](./docs/BUILDING.md).

Quick start:

```bash
pnpm install:desktop   # first time: see BUILDING.md for approve-builds
pnpm dev
pnpm build
pnpm start
```

Engine tree: `/usr/local/lib/artemis-agent` or bootstrap via Desktop first-run (`~/.artemis/artemis-agent`).

## Build from source (installers)

After `pnpm build` from the repo root:

```bash
pnpm dist
# or platform-specific targets in apps/desktop via electron-builder (see docs/BUILDING.md)
```

Publish artifacts via GitHub Releases.

Launch unpacked Linux build:

```bash
cd apps/desktop/release/linux-unpacked
ARTEMIS_DESKTOP_APP_NAME=Artemis ./Artemis --no-sandbox --disable-gpu
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Two Artemis icons in the app grid | Keep only `~/.local/share/applications/artemis.desktop` |
| Settings: “Something broke in the interface” | Rebuild clean asar; do not blanket-replace strings in minified JS |
| Exit code 133 | Add `--disable-gpu` |
| Still answers with the wrong name | Update `~/.artemis/SOUL.md` and start a **new** session |
| Stale update banner | Run `scripts/retarget-updates.py` on the engine; install from Artemis Releases |
| Open logs | `~/.artemis/logs/desktop.log` |

---

## Contributing / issues

Open issues and pull requests on
[github.com/lipey1/artemis-agent](https://github.com/lipey1/artemis-agent).
