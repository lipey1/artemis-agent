"""``artemis gui`` subcommand parser.

Extracted verbatim from ``artemis_cli/main.py:main()`` (god-file Phase 2).
Handler injected to avoid importing ``main``.
"""

from __future__ import annotations

from typing import Callable


def build_gui_parser(subparsers, *, cmd_gui: Callable) -> None:
    """Attach the ``gui`` subcommand to ``subparsers``."""
    # =========================================================================
    gui_parser = subparsers.add_parser(
        "desktop",
        aliases=["gui"],
        help="Open Artemis Desktop (installed app, or build from source)",
        description=(
            "Open Artemis Desktop. With no flags, launches the installed app "
            "(/usr/bin/Artemis, Program Files, or /Applications) when present. "
            "Use --source / --force-build to build and launch from this repo."
        ),
    )
    gui_parser.add_argument(
        "--source",
        action="store_true",
        help="Launch via `electron .` against apps/desktop/dist instead of the packaged app",
    )
    gui_parser.add_argument(
        "--build-only",
        action="store_true",
        help="Build the desktop app but do not launch it (used by the installer's --update flow)",
    )
    gui_parser.add_argument(
        "--fake-boot",
        action="store_true",
        help="Enable deterministic desktop boot delays for validating startup UI",
    )
    gui_parser.add_argument(
        "--ignore-existing",
        action="store_true",
        help="Force Desktop to ignore any artemis CLI already on PATH during backend resolution",
    )
    gui_parser.add_argument(
        "--artemis-root",
        help="Override the Artemis source root used by Desktop (sets ARTEMIS_DESKTOP_ARTEMIS_ROOT)",
    )
    gui_parser.add_argument(
        "--cwd",
        help="Initial project directory for Desktop chat sessions (sets ARTEMIS_DESKTOP_CWD)",
    )
    gui_parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Skip npm install/package and launch the existing unpacked app from apps/desktop/release",
    )
    gui_parser.add_argument(
        "--force-build",
        action="store_true",
        help="Force a full rebuild even if the content stamp matches",
    )
    gui_parser.set_defaults(func=cmd_gui)
