"""Resolve ARTEMIS_HOME for standalone skill scripts.

Skill scripts may run outside the Artemis process (e.g. system Python,
nix env, CI) where ``artemis_constants`` is not importable.  This module
provides the same ``get_artemis_home()`` and ``display_artemis_home()``
contracts as ``artemis_constants`` without requiring it on ``sys.path``.

When ``artemis_constants`` IS available it is used directly so that any
future enhancements (profile resolution, Docker detection, etc.) are
picked up automatically.  The fallback path replicates the core logic
from ``artemis_constants.py`` using only the stdlib.

All scripts under ``google-workspace/scripts/`` should import from here
instead of duplicating the ``ARTEMIS_HOME = Path(os.getenv(...))`` pattern.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from artemis_constants import display_artemis_home as display_artemis_home
    from artemis_constants import get_artemis_home as get_artemis_home
except (ModuleNotFoundError, ImportError):

    def get_artemis_home() -> Path:
        """Return the Artemis home directory (default: ~/.artemis).

        Mirrors ``artemis_constants.get_artemis_home()``."""
        val = os.environ.get("ARTEMIS_HOME", "").strip()
        return Path(val) if val else Path.home() / ".artemis"

    def display_artemis_home() -> str:
        """Return a user-friendly ``~/``-shortened display string.

        Mirrors ``artemis_constants.display_artemis_home()``."""
        home = get_artemis_home()
        try:
            return "~/" + str(home.relative_to(Path.home()))
        except ValueError:
            return str(home)
