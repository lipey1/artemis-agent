#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$HOME/.local/bin"
install -m 755 "$DIR/artemis" "$HOME/.local/bin/artemis"
mkdir -p "$HOME/.artemis"
if [[ ! -f "$HOME/.artemis/SOUL.md" ]]; then
  if [[ -f "$DIR/../brand/SOUL.md" ]]; then
    cp "$DIR/../brand/SOUL.md" "$HOME/.artemis/SOUL.md"
  fi
fi
echo "Installed: $HOME/.local/bin/artemis"
echo "Add to PATH if needed: export PATH=\"\$HOME/.local/bin:\$PATH\""
echo "Try: artemis -z \"Quem é você?\""
