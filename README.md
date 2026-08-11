# Artemis Desktop

**Artemis** is a native desktop agent for Linux, macOS, and Windows: chat, tools,
skills, gateway, and local config in one shell.

Companion app: **[Artemis Mobile](https://github.com/lipey1/artemis-mobile)** (Flutter client for Open WebUI and Artemis/Hermes agents).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/lipey1/artemis-desktop?include_prereleases)](https://github.com/lipey1/artemis-desktop/releases)

## Origin

This project is based on **Hermes Agent Desktop** ([Nous Research](https://github.com/NousResearch/hermes-agent), MIT).
We kept the MIT license, shipped the product as **Artemis**, added features, and
fixed logical and visual issues in the desktop and CLI experience.

Artemis is the product name and identity. The underlying engine stays compatible
with the Hermes Agent runtime so tools, protocols, and most upstream workflows
keep working.

---

## What you get

- **Desktop app** (Electron) branded as Artemis: logo, wordmark, window title, launcher
- **CLI** (`artemis`) that uses the same home and persona
- **Identity**: `SOUL.md` presents the assistant as Artemis
- **Home directory**: `~/.artemis` (config, logs, memories, skills)
- **Migration**: existing `~/.hermes` moves to `~/.artemis` automatically; a
  symlink `~/.hermes → ~/.artemis` keeps older tooling working
- **Installers** for Linux, macOS, and Windows on
  [Releases](https://github.com/lipey1/artemis-desktop/releases/latest)
- **Mobile companion**: [Artemis Mobile](https://github.com/lipey1/artemis-mobile)

Technical names that stay for compatibility: `hermes` engine binary,
`HERMES_*` environment variables, `hermes://` protocol, `X-Hermes-*` headers,
and the engine install tree (`artemis-agent` / `hermes-agent`).

---

## Install (Linux / macOS / Windows)

Download the asset for your OS from the latest
[GitHub Release](https://github.com/lipey1/artemis-desktop/releases/latest).

Binaries are published on Releases (they are too large for git). Checksums are in
[`SHA256SUMS`](https://github.com/lipey1/artemis-desktop/releases/latest) on each release.

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
| `Artemis-*-win-x64-portable.zip` | Extract and run `Hermes.exe` (engine binary name) |
| `Artemis-*-win-x64.exe` + `Artemis-*-win-x64.nsis.7z` | NSIS installer (keep both files in the same folder) |

Portable:

```powershell
Expand-Archive Artemis-*-win-x64-portable.zip -DestinationPath .\Artemis
.\Artemis\Hermes.exe
```

---

## CLI: talk to Artemis in the terminal

Requires a local Artemis/Hermes engine install (Desktop bundle or
`/usr/local/lib/artemis-agent`).

```bash
# Install wrapper (once)
curl -fsSL https://raw.githubusercontent.com/lipey1/artemis-desktop/main/scripts/install-artemis-cli.sh | bash
# or copy scripts/artemis from this repo to ~/.local/bin/artemis

export PATH="$HOME/.local/bin:$PATH"
export HERMES_HOME="$HOME/.artemis"

artemis -z "Quem é você?"
artemis chat
artemis status
```

The CLI sets `HERMES_HOME=~/.artemis` and uses your `SOUL.md` so the model
answers as **Artemis**.

**Do not run upstream `hermes update` / `artemis update` blindly.** That pulls
from `NousResearch/hermes-agent` and can overwrite local Artemis branding.
Prefer downloading a new Artemis Desktop release instead.

---

## Artemis Mobile

For phones and tablets:

- Repo: [github.com/lipey1/artemis-mobile](https://github.com/lipey1/artemis-mobile)
- Flutter client (based on Conduit) branded as Artemis
- Talks to Open WebUI servers and Artemis/Hermes agent backends

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
| `~/.artemis/hermes-agent/` | Engine checkout used by Desktop |
| `~/.artemis/desktop-plugins/` | Local desktop plugins |

On Windows the default home is `%LOCALAPPDATA%\artemis`, with migration from
`%LOCALAPPDATA%\hermes` and legacy `~\.hermes`.

---

## Features and fixes (vs stock Hermes Desktop)

### Features

1. Artemis product branding (desktop + CLI)
2. Dedicated `~/.artemis` home with automatic Hermes → Artemis migration
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
7. Terminal theme defaults to cyan Artemis palette (not stock gold)

---

## License

MIT. See [`LICENSE`](./LICENSE).

Copyright for upstream Hermes Agent / Desktop: Nous Research.  
Copyright for Artemis Desktop distribution and modifications: Artemis Desktop
contributors.

---

## Attribution

- Upstream engine and desktop shell: [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)
- Mobile companion: [lipey1/artemis-mobile](https://github.com/lipey1/artemis-mobile)
- This repository: Artemis Desktop distribution by [@lipey1](https://github.com/lipey1)

Hermes, Nous Research, and related marks belong to their respective owners.
Artemis Desktop is an independent branded distribution and is not an official
Nous Research product.

---

## Repository layout

```text
LICENSE
README.md
brand/                 Logo and icons
docs/                  Extra documentation
packaging/             .desktop templates
scripts/               artemis CLI + install helpers
release/               Checksums + pointer to GitHub Releases
                       (installer binaries are not stored in git)
```

---

## Build from source

Requires Node.js **>= 22** and the Hermes Agent desktop tree.

```bash
cd /path/to/hermes-agent/apps/desktop
npm run build
npx electron-builder --linux AppImage deb
npx electron-builder --win portable nsis
npx electron-builder --mac zip   # best on macOS; unsigned zip may work cross-build
```

Publish artifacts via GitHub Releases. See [`docs/BUILDING.md`](./docs/BUILDING.md).

Launch unpacked Linux build:

```bash
cd release/linux-unpacked
HERMES_DESKTOP_APP_NAME=Artemis ./Hermes --no-sandbox --disable-gpu
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Two Artemis icons in the app grid | Keep only `~/.local/share/applications/artemis.desktop` |
| Settings: “Something broke in the interface” | Rebuild clean asar; do not blanket-replace strings in minified JS |
| Exit code 133 | Add `--disable-gpu` |
| Still answers as Hermes | Update `~/.artemis/SOUL.md` and start a **new** session |
| “update available” turns branding back to Hermes | Ignore upstream update; install a new Artemis release instead |
| Open logs | `~/.artemis/logs/desktop.log` |

---

## Contributing / issues

Open issues and pull requests on
[github.com/lipey1/artemis-desktop](https://github.com/lipey1/artemis-desktop).
