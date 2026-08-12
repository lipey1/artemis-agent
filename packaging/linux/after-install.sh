#!/bin/bash
# deb after-install: make the launcher icon immune to stale per-user icon caches.
#
# GNOME/Gtk prefer ~/.local/share/icons/hicolor over /usr/share. If a leftover
# icon-theme.cache there still lists "Artemis" but the PNG files were deleted,
# Icon=Artemis resolves to a missing path and the dock/app search shows a blank
# glyph. Point Icon= at a real file so lookup never consults that cache.

set -uo pipefail

DESKTOP_FILE="/usr/share/applications/Artemis.desktop"
ABS_ICON="/usr/share/icons/hicolor/256x256/apps/Artemis.png"
# Fallback shipped next to the binary (extraResources).
FALLBACK_ICON="/opt/Artemis/resources/icon.png"

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

# Drop ghost user caches that claim Artemis but have no PNG (best effort).
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
