"""Resolve ARTEMIS_HOME for standalone skill scripts.

Skill scripts may run outside the Artemis process (system Python, nix env,
CI) where ``artemis_constants`` is not importable.  This module provides the
same ``get_artemis_home()`` contract without requiring it on ``sys.path``.

When ``artemis_constants`` IS available it is used directly so profile
resolution and any future enhancements are picked up automatically.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from artemis_constants import get_artemis_home as get_artemis_home
except (ModuleNotFoundError, ImportError):

    def get_artemis_home() -> Path:
        """Return the Artemis home directory (default: ``~/.artemis``)."""
        val = os.environ.get("ARTEMIS_HOME", "").strip()
        return Path(val) if val else Path.home() / ".artemis"
