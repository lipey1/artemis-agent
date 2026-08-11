# Artemis Desktop

**Artemis** is a native desktop agent for Linux, macOS, and Windows: chat, tools,
skills, gateway, and local config in one shell.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/lipey1/artemis-desktop?include_prereleases)](https://github.com/lipey1/artemis-desktop/releases)

## Origin

This project is based on **Hermes Agent Desktop** ([Nous Research](https://github.com/NousResearch/hermes-agent), MIT).
We kept the MIT license, shipped the product as **Artemis**, implemented new
features, and fixed several logical and visual issues in the desktop and CLI
experience.

Artemis is the product name and identity. The underlying engine remains
compatible with the Hermes Agent runtime so updates, tools, and protocols keep
working.

---

## What you get

- **Desktop app** (Electron) branded as Artemis: logo, wordmark, window title, launcher
- **CLI** (`artemis`) that talks with the same home and persona
- **Identity**: `SOUL.md` presents the assistant as Artemis, not Hermes
- **Home directory**: `~/.artemis` (config, logs, memories, skills)
- **Migration**: existing `~/.hermes` is moved to `~/.artemis` automatically; a
  symlink `~/.hermes → ~/.artemis` keeps older tooling working
- **UI polish**: tooltips, sidebar icons, settings copy, wake-phrase label
  (`hey artemis`), Conduit mobile alignment
- **Installers** for Linux, macOS, and Windows on the [Releases](https://github.com/lipey1/artemis-desktop/releases) page

Technical names that stay for compatibility: `hermes` engine binary,
`HERMES_*` environment variables, `hermes://` protocol, `X-Hermes-*` headers,
and the `hermes-agent` install tree.

---

## Install

Download the asset for your OS from the latest
[GitHub Release](https://github.com/lipey1/artemis-desktop/releases/latest).

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
| `Artemis-*-mac-*.dmg` | Drag to Applications (when published) |
| `Artemis-*-mac-*.zip` | Portable zip (when published) |

Unsigned builds from Linux CI may need: System Settings → Privacy & Security →
Open Anyway.

### Windows

| Asset | Notes |
|-------|--------|
| `Artemis-*-win-x64-portable.zip` | Portable folder (run `Hermes.exe`) |
| `Artemis-*-mac-x64.zip` | macOS app zip (unsigned cross-build) |

---

## CLI: talk to Artemis in the terminal

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

1. Artemis product branding (desktop + CLI + mobile-facing copy)
2. Dedicated `~/.artemis` home with automatic Hermes → Artemis migration
3. `artemis` CLI front-end with Artemis help/version surface
4. Persona file that forces Artemis identity in chat
5. Installer packaging for distribution (AppImage, deb, plus Win/mac when built)
6. Public GitHub project with MIT license and release assets

### Logical / visual fixes

1. Duplicate launcher entries (`Name=Artemis` twice) cleaned up
2. Tooltip chrome matches dark elevated panels (no inverted light chips)
3. Sidebar Pinned / Sessions use clear Codicon icons
4. Settings crash from aggressive minified-string rebranding avoided (source-level branding only)
5. Path copy in allowlist / settings points at `~/.artemis`
6. Dock / `.desktop` `StartupWMClass` aligned with Artemis window class

---

## License

MIT. See [`LICENSE`](./LICENSE).

Copyright for upstream Hermes Agent / Desktop: Nous Research.  
Copyright for Artemis Desktop distribution and modifications: Artemis Desktop
contributors.

---

## Attribution

- Upstream engine and desktop shell: [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)
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
release/               Local build outputs (not always committed; see Releases)
```

---

## Build from source

Requires Node.js **>= 22** and the Hermes Agent desktop tree.

```bash
cd /path/to/hermes-agent/apps/desktop
npm run build
npx electron-builder --linux AppImage deb
npx electron-builder --win nsis
npx electron-builder --mac zip   # best on macOS; unsigned zip may work cross-build
```

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
| Open logs | `~/.artemis/logs/desktop.log` |

---

## Contributing / issues

Open issues and pull requests on
[github.com/lipey1/artemis-desktop](https://github.com/lipey1/artemis-desktop).
