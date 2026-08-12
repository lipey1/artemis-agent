#!/usr/bin/env bash
# Install PATH entry: `artemis` = Agent CLI, `artemis desktop` = Desktop GUI.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_HOME="${ARTEMIS_HOME:-$HOME/.artemis}/artemis-agent"
VENV_BIN="$AGENT_HOME/venv/bin"

mkdir -p "$HOME/.local/bin"
install -m 755 "$DIR/artemis" "$HOME/.local/bin/artemis"

# Restore the real Python console script if a bash wrapper overwrote venv/bin/artemis.
if [[ -x "$VENV_BIN/python" ]]; then
  cat > "$VENV_BIN/artemis-cli" <<EOF
#!$VENV_BIN/python
# -*- coding: utf-8 -*-
import sys
from artemis_cli.main import main
if __name__ == "__main__":
    if sys.argv[0].endswith("-script.pyw"):
        sys.argv[0] = sys.argv[0][:-11]
    elif sys.argv[0].endswith(".exe"):
        sys.argv[0] = sys.argv[0][:-4]
    sys.exit(main())
EOF
  chmod 755 "$VENV_BIN/artemis-cli"
  # Keep venv/bin/artemis as the Python entry (not a desktop wrapper).
  if head -1 "$VENV_BIN/artemis" 2>/dev/null | grep -q bash; then
    cp -f "$VENV_BIN/artemis-cli" "$VENV_BIN/artemis"
    chmod 755 "$VENV_BIN/artemis"
  fi
fi

mkdir -p "$HOME/.artemis"
if [[ ! -f "$HOME/.artemis/SOUL.md" ]]; then
  if [[ -f "$DIR/../brand/SOUL.md" ]]; then
    cp "$DIR/../brand/SOUL.md" "$HOME/.artemis/SOUL.md"
  fi
fi

echo "Installed: $HOME/.local/bin/artemis"
echo "  artemis              → Agent CLI"
echo "  artemis desktop      → Artemis Desktop"
echo "Add to PATH if needed: export PATH=\"\$HOME/.local/bin:\$PATH\""
