#!/bin/bash
# deb after-remove: drop PATH symlink and refresh caches.

set -uo pipefail

rm -f /usr/bin/Artemis 2>/dev/null || true

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database /usr/share/applications >/dev/null 2>&1 || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f /usr/share/icons/hicolor >/dev/null 2>&1 || true
fi

exit 0
