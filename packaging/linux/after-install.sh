#!/bin/bash
# deb after-install for Artemis Desktop.
#
# Fixes that electron-builder alone does not guarantee on Ubuntu/GNOME:
#   1. chrome-sandbox must be root:root + setuid (4755) or Electron aborts
#   2. /usr/bin/Artemis must exist so `Artemis` is on PATH
#   3. Icon= must use an absolute PNG path (stale user icon caches break themed names)
#   4. Ghost ~/.local icon-theme.cache entries that point at missing Artemis.png

set -uo pipefail

APP_DIR="/opt/Artemis"
BIN="/opt/Artemis/Artemis"
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
# Prefer a real symlink so `Artemis` works from any shell. Do not touch
# /usr/local/bin/artemis (CLI wrapper for the agent); that is a different tool.
if [ -x "$BIN" ]; then
  ln -sfn "$BIN" "$SYMLINK" 2>/dev/null || true
fi

# --- 3. Absolute Icon= so Gtk never hits a ghost user cache -----------------
if [ -f "$DESKTOP_FILE" ]; then
  if [ -f "$ABS_ICON" ]; then
    icon_value="$ABS_ICON"
  elif [ -f "$FALLBACK_ICON" ]; then
    icon_value="$FALLBACK_ICON"
  else
    icon_value="Artemis"
  fi
  if grep -q '^Icon=' "$DESKTOP_FILE"; then
    sed -i "s|^Icon=.*|Icon=${icon_value}|" "$DESKTOP_FILE"
  else
    printf 'Icon=%s\n' "$icon_value" >> "$DESKTOP_FILE"
  fi
fi

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
