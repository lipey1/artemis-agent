<p align="center">
  <img src="brand/banner.png" alt="Artemis" width="454" />
</p>

<p align="center">
  Desktop + CLI agent for Linux, macOS, and Windows.<br />
  Chat, tools, skills, and local config in one place.
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT" /></a>
  <a href="https://github.com/lipey1/artemis-agent/releases"><img src="https://img.shields.io/github/v/release/lipey1/artemis-agent?include_prereleases" alt="Release" /></a>
</p>

Companion: [Artemis Mobile](https://github.com/lipey1/artemis-mobile)

## Install

Download the asset for your OS from [Releases](https://github.com/lipey1/artemis-agent/releases/latest). Checksums are in `SHA256SUMS` on each release.

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

If Electron exits with code **133**, add `--disable-gpu`.

### macOS

Unzip `Artemis-*-mac-x64.zip` and open `Artemis.app`. If Gatekeeper blocks it: System Settings → Privacy & Security → Open Anyway.

### Windows

| Asset | Notes |
|-------|--------|
| `Artemis-*-win-x64-portable.zip` | Extract and run `Artemis.exe` |
| `Artemis-*-win-x64.exe` + `.nsis.7z` | Keep both files in the same folder |

## Commands

Windows treats `artemis` and `Artemis` as the same name. Use a subcommand for the app:

| Command | Opens |
|---------|--------|
| `artemis` | Agent CLI / TUI |
| `artemis desktop` | Desktop app |

```bash
curl -fsSL https://raw.githubusercontent.com/lipey1/artemis-agent/main/scripts/install-artemis-cli.sh | bash
export PATH="$HOME/.local/bin:$PATH"

artemis
artemis desktop
```

Data lives in `~/.artemis` (`SOUL.md`, config, logs, skills, engine). On Windows: `%LOCALAPPDATA%\artemis`.

## Development

Node.js >= 22 and pnpm. See [`docs/BUILDING.md`](./docs/BUILDING.md).

```bash
pnpm install:desktop
pnpm dev
```

## License

MIT. See [`LICENSE`](./LICENSE).
