"""
Artemis CLI - Unified command-line interface for Artemis Agent.

Provides subcommands for:
- artemis chat          - Interactive chat (same as ./artemis)
- artemis gateway       - Run gateway in foreground
- artemis gateway start - Start gateway service
- artemis gateway stop  - Stop gateway service
- artemis setup         - Interactive setup wizard
- artemis status        - Show status of all components
- artemis cron          - Manage cron jobs
"""

import json
import os
import subprocess
import sys
from pathlib import Path

_VERSION_FALLBACK = "0.17.28"
_DATE_FALLBACK = "2026.8.13"
_PRODUCT_NAME = "artemis-agent"


def _stamp_date(built_at: str) -> str:
    try:
        parts = str(built_at)[:10].split("-")
        return f"{int(parts[0])}.{int(parts[1])}.{int(parts[2])}"
    except Exception:
        return ""


def _json_version(path: Path) -> str:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return ""
    if not isinstance(data, dict):
        return ""
    return str(data.get("version") or "").strip().lstrip("v")


def _desktop_install_roots() -> list[Path]:
    home = Path.home()
    if os.name == "nt":
        local = os.environ.get("LOCALAPPDATA", "")
        prog = os.environ.get("PROGRAMFILES", r"C:\Program Files")
        roots = []
        if prog:
            roots.append(Path(prog) / "Artemis")
        if local:
            roots.append(Path(local) / "Programs" / "Artemis")
            roots.append(Path(local) / "Artemis")
        return roots
    if sys.platform == "darwin":
        return [
            Path("/Applications/Artemis.app/Contents"),
            home / "Applications" / "Artemis.app" / "Contents",
        ]
    return [Path("/opt/Artemis")]


def _stamp_path(root: Path) -> Path:
    for rel in ("resources/install-stamp.json", "Resources/install-stamp.json"):
        candidate = root / rel
        if candidate.is_file():
            return candidate
    return root / "resources" / "install-stamp.json"


def read_desktop_version() -> tuple[str, str]:
    """Return (version, date) from the installed Desktop app when possible."""
    for root in _desktop_install_roots():
        stamp = _stamp_path(root)
        if stamp.is_file():
            try:
                data = json.loads(stamp.read_text(encoding="utf-8"))
            except Exception:
                data = {}
            if isinstance(data, dict):
                ver = str(data.get("version") or "").strip().lstrip("v")
                date = _stamp_date(str(data.get("builtAt") or ""))
                if ver:
                    return ver, date or _DATE_FALLBACK
        pkg_ver = _json_version(root / "resources" / "app" / "package.json")
        if pkg_ver:
            return pkg_ver, _DATE_FALLBACK

    if sys.platform.startswith("linux"):
        try:
            ver = subprocess.check_output(
                ["dpkg-query", "-W", "-f", "${Version}", "artemis"],
                timeout=2,
                text=True,
                stderr=subprocess.DEVNULL,
            ).strip()
            if ver:
                return ver, _DATE_FALLBACK
        except Exception:
            pass

    here = Path(__file__).resolve().parent.parent
    for rel in ("apps/desktop/package.json", "package.json"):
        ver = _json_version(here / rel)
        if ver:
            return ver, _DATE_FALLBACK
    return _VERSION_FALLBACK, _DATE_FALLBACK


__version__, __release_date__ = read_desktop_version()
__product_name__ = _PRODUCT_NAME


def _ensure_utf8():
    """Force UTF-8 stdout/stderr to prevent UnicodeEncodeError crashes.

    Several environments select a legacy, non-UTF-8 encoding for the standard
    streams:

    - Windows services and terminals default to cp1252.
    - Linux hosts with a latin-1 / C / POSIX locale (common on minimal Debian
      installs and Raspberry Pi) select latin-1 or ASCII.

    The CLI prints box-drawing characters (┌│├└─) and the ⚕ glyph in the setup
    wizard, doctor, and status banners. Encoding those under a non-UTF-8 codec
    raises an unhandled UnicodeEncodeError that crashes the command before it
    can even start — e.g. `artemis setup` on a fresh Pi.

    This runs at import time so it protects every CLI subcommand, on any
    platform. It re-wraps stdout/stderr as UTF-8 when their encoding is not
    already UTF-8, preferring TextIOWrapper.reconfigure() so the existing
    stream object is fixed in place (cached `sys.stdout` references keep
    working) and falling back to reopening the file descriptor with
    closefd=False (the CPython-recommended safe variant).

    No-op when the streams are already UTF-8: a healthy UTF-8 system sees no
    stream change and no environment mutation.

    Note: this is intentionally the earliest, platform-agnostic guard.
    artemis_cli/stdio.py::configure_windows_stdio() runs later from the entry
    points and layers on the Windows-only extras (console code-page flip,
    EDITOR default, PATH augmentation); its stream reconfiguration is a
    harmless idempotent no-op once we have already repaired the streams here.
    """
    repaired = False

    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream is None:
            continue
        try:
            encoding = (getattr(stream, "encoding", "") or "").lower().replace("-", "")
            if encoding == "utf8":
                continue

            # Preferred: reconfigure the existing TextIOWrapper in place. This
            # preserves object identity so any code already holding a reference
            # to the old sys.stdout benefits from the repair too.
            reconfigure = getattr(stream, "reconfigure", None)
            if callable(reconfigure):
                reconfigure(encoding="utf-8", errors="replace")
                repaired = True
                continue

            # Fallback: reopen the underlying file descriptor as UTF-8. Used
            # for streams that don't expose reconfigure() (e.g. some wrapped
            # or replaced streams). closefd=False keeps the original fd open.
            new_stream = open(
                stream.fileno(), "w", encoding="utf-8",
                errors="replace", buffering=1, closefd=False,
            )
            setattr(sys, stream_name, new_stream)
            repaired = True
        except (AttributeError, OSError, ValueError):
            pass

    # Only nudge child processes toward UTF-8 when we actually detected a
    # non-UTF-8 locale. On a healthy UTF-8 host children inherit UTF-8 from the
    # locale already, so leave the environment untouched (minimal footprint).
    if repaired:
        os.environ.setdefault("PYTHONUTF8", "1")
        os.environ.setdefault("PYTHONIOENCODING", "utf-8")


_ensure_utf8()
