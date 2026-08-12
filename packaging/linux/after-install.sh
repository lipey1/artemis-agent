#!/bin/bash
# deb after-install for Artemis Desktop.
#
# Fixes that electron-builder alone does not guarantee on Ubuntu/GNOME:
#   1. chrome-sandbox must be root:root + setuid (4755) or Electron aborts
#   2. /usr/bin/Artemis must exist so `Artemis` is on PATH
#   3. Icon= / Exec= absolute paths (dock always opens Desktop, never CLI)
#   4. Ghost ~/.local icon-theme.cache entries that point at missing Artemis.png
#
# IMPORTANT: do not use dollar-brace shell vars in this file. electron-builder's
# fpm target expands dollar-brace tokens as its own macros and fails the package build.

set -uo pipefail

APP_DIR="/opt/Artemis"
APP_BIN="/opt/Artemis/Artemis"
SANDBOX="/opt/Artemis/chrome-sandbox"
SYMLINK="/usr/bin/Artemis"
DESKTOP_FILE="/usr/share/applications/Artemis.desktop"
ABS_ICON="/usr/share/icons/hicolor/256x256/apps/Artemis.png"
FALLBACK_ICON="/opt/Artemis/resources/icon.png"

# --- 1. Electron SUID sandbox -----------------------------------------------
if [ -f "$SANDBOX" ]; then
  chown root:root "$SANDBOX" 2>/dev/null || true
  chmod 4755 "$SANDBOX" 2>/dev/null || true
fi

# --- 2. PATH entry for the desktop app --------------------------------------
# Prefer a real symlink so `Artemis` (capital A) launches Desktop from PATH.
# Never claim lowercase `artemis` here: that is the Agent CLI wrapper
# (~/.local/bin/artemis → `artemis` / `artemis desktop`).
if [ -x "$APP_BIN" ]; then
  ln -sfn "$APP_BIN" "$SYMLINK" 2>/dev/null || true
fi

# --- 3. Desktop entry always opens the Electron app (never the CLI) ---------
if [ -f "$DESKTOP_FILE" ]; then
  if [ -f "$ABS_ICON" ]; then
    icon_value="$ABS_ICON"
  elif [ -f "$FALLBACK_ICON" ]; then
    icon_value="$FALLBACK_ICON"
  else
    icon_value="Artemis"
  fi
  if grep -q '^Icon=' "$DESKTOP_FILE"; then
    sed -i "s|^Icon=.*|Icon=$icon_value|" "$DESKTOP_FILE"
  else
    printf 'Icon=%s\n' "$icon_value" >> "$DESKTOP_FILE"
  fi
  # Force Exec to the packaged binary so dock / app menu never spawn the CLI.
  if grep -q '^Exec=' "$DESKTOP_FILE"; then
    sed -i 's|^Exec=.*|Exec=/opt/Artemis/Artemis %U|' "$DESKTOP_FILE"
  else
    printf 'Exec=/opt/Artemis/Artemis %%U\n' >> "$DESKTOP_FILE"
  fi
  if grep -q '^Terminal=' "$DESKTOP_FILE"; then
    sed -i 's|^Terminal=.*|Terminal=false|' "$DESKTOP_FILE"
  else
    printf 'Terminal=false\n' >> "$DESKTOP_FILE"
  fi
  if grep -q '^StartupWMClass=' "$DESKTOP_FILE"; then
    sed -i 's|^StartupWMClass=.*|StartupWMClass=Artemis|' "$DESKTOP_FILE"
  else
    printf 'StartupWMClass=Artemis\n' >> "$DESKTOP_FILE"
  fi
fi

# User-local overrides must not redirect the launcher to the CLI either.
for home in /home/* /root; do
  [ -d "$home" ] || continue
  for f in \
    "$home/.local/share/applications/Artemis.desktop" \
    "$home/.local/share/applications/artemis.desktop"
  do
    [ -f "$f" ] || continue
    if grep -qiE '^Exec=.*(artemis-cli|/artemis[^-]|venv/bin/artemis)' "$f" 2>/dev/null; then
      sed -i 's|^Exec=.*|Exec=/opt/Artemis/Artemis %U|' "$f" 2>/dev/null || true
      sed -i 's|^Terminal=.*|Terminal=false|' "$f" 2>/dev/null || true
    fi
  done
done

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f /usr/share/icons/hicolor >/dev/null 2>&1 || true
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database /usr/share/applications >/dev/null 2>&1 || true
fi

# --- 4. Drop ghost user caches that claim Artemis but have no PNG -----------
for home in /home/* /root; do
  [ -d "$home" ] || continue
  hicolor="$home/.local/share/icons/hicolor"
  cache="$hicolor/icon-theme.cache"
  [ -f "$cache" ] || continue
  if ! strings "$cache" 2>/dev/null | grep -q 'Artemis'; then
    continue
  fi
  if ! find "$hicolor" -iname 'Artemis.png' 2>/dev/null | grep -q .; then
    rm -f "$cache" || true
  fi
done

exit 0
