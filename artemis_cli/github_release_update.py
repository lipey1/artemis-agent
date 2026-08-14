"""Apply Artemis updates from GitHub Releases (NSIS / deb / source zip).

Packaged Windows installs have no git checkout, so ``artemis update`` must
download the latest release asset and refresh the AppData engine tree.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile
from pathlib import Path
from typing import Any, Callable, Optional

GITHUB_API_LATEST = "https://api.github.com/repos/lipey1/artemis-agent/releases/latest"
GITHUB_RELEASES_PAGE = "https://github.com/lipey1/artemis-agent/releases/latest"
USER_AGENT = "Artemis-Update"

ENGINE_SKIP_DIRS = {
    ".git",
    "venv",
    "node_modules",
    "__pycache__",
    "release",
    "win-unpacked",
    "dist",
}


def parse_version(value: str) -> tuple[int, ...]:
    parts: list[int] = []
    for chunk in str(value).lstrip("vV").split("."):
        num = ""
        for ch in chunk:
            if ch.isdigit():
                num += ch
            else:
                break
        parts.append(int(num) if num else 0)
    return tuple(parts) if parts else (0,)


def pick_release_asset(assets: list[dict[str, Any]], platform: str = sys.platform) -> Optional[dict[str, Any]]:
    names = [(asset, str(asset.get("name") or "")) for asset in assets if asset.get("browser_download_url")]
    if platform.startswith("win"):
        ranked = [item for item in names if item[1].endswith("-win-x64.exe") and "blockmap" not in item[1]]
        return ranked[0][0] if ranked else None
    if platform.startswith("linux"):
        deb = [item for item in names if item[1].endswith(".deb")]
        if deb:
            return deb[0][0]
        appimage = [item for item in names if item[1].endswith(".AppImage")]
        return appimage[0][0] if appimage else None
    if platform == "darwin":
        dmg = [item for item in names if item[1].endswith(".dmg")]
        if dmg:
            return dmg[0][0]
        zips = [item for item in names if item[1].endswith("-mac.zip") or item[1].endswith("-darwin.zip")]
        return zips[0][0] if zips else None
    return None


def _request_json(url: str, timeout: int = 30) -> dict[str, Any]:
    req = urllib.request.Request(
        url,
        headers={"Accept": "application/vnd.github+json", "User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_latest_release(fetcher: Callable[[str], dict[str, Any]] = _request_json) -> dict[str, Any]:
    return fetcher(GITHUB_API_LATEST)


def current_version() -> str:
    try:
        from artemis_cli import __version__

        return str(__version__).lstrip("v")
    except Exception:
        return "0"


def engine_root() -> Path:
    override = os.environ.get("ARTEMIS_ENGINE_ROOT", "").strip()
    if override:
        return Path(override)
    from artemis_constants import get_artemis_home

    preferred = get_artemis_home() / "artemis-agent"
    if preferred.exists():
        return preferred
    return get_artemis_home() / "artemis-agent"


def _progress(message: str) -> None:
    """ASCII prefix so Windows consoles (CP850) do not turn `→` into `ÔåÆ`."""
    print(f"* {message}")


def _download(url: str, dest: Path, label: str) -> None:
    _progress(f"Downloading {label}")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as resp, dest.open("wb") as out:
        shutil.copyfileobj(resp, out)


def _kill_desktop() -> None:
    if not sys.platform.startswith("win"):
        return
    subprocess.run(
        ["taskkill", "/IM", "Artemis.exe", "/F"],
        capture_output=True,
        text=True,
        check=False,
    )


def _overlay_engine_from_zip(zip_path: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="artemis-src-") as raw:
        extract_root = Path(raw)
        with zipfile.ZipFile(zip_path) as archive:
            archive.extractall(extract_root)
        tops = [path for path in extract_root.iterdir() if path.is_dir()]
        src = tops[0] if len(tops) == 1 else extract_root
        for child in src.iterdir():
            if child.name in ENGINE_SKIP_DIRS:
                continue
            target = dest / child.name
            if child.is_dir():
                if target.exists():
                    shutil.rmtree(target)
                shutil.copytree(
                    child,
                    target,
                    ignore=shutil.ignore_patterns(*ENGINE_SKIP_DIRS, "*.pyc"),
                )
            else:
                shutil.copy2(child, target)


def _seed_skills(root: Path) -> None:
    skills_src = root / "skills"
    if not skills_src.is_dir():
        return
    try:
        from tools.skills_sync import ensure_bundled_skills

        ensure_bundled_skills(quiet=False)
    except Exception as exc:
        print(f"! Could not seed bundled skills: {exc}")


def _run_windows_installer(installer: Path) -> int:
    _progress(f"Installing {installer.name} (silent)")
    completed = subprocess.run([str(installer), "/S"], check=False)
    return int(completed.returncode or 0)


def _run_posix_installer(installer: Path) -> int:
    if installer.suffix == ".deb":
        _progress(f"Installing {installer.name} with dpkg")
        completed = subprocess.run(["sudo", "dpkg", "-i", str(installer)], check=False)
        return int(completed.returncode or 0)
    mode = installer.stat().st_mode
    installer.chmod(mode | 0o111)
    _progress(f"Launching {installer.name}")
    if sys.platform == "darwin":
        completed = subprocess.run(["open", str(installer)], check=False)
    else:
        completed = subprocess.run([str(installer)], check=False)
    return int(completed.returncode or 0)


def check_github_release_update() -> int:
    """Print whether a newer GitHub release exists. Returns 0 if up to date."""
    try:
        release = fetch_latest_release()
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        print(f"Could not reach GitHub Releases: {exc}")
        print(f"  {GITHUB_RELEASES_PAGE}")
        return 1
    tag = str(release.get("tag_name") or "").lstrip("v")
    local = current_version()
    if not tag:
        print("GitHub latest release has no tag.")
        return 1
    if parse_version(tag) <= parse_version(local):
        print(f"Artemis {local} is up to date.")
        return 0
    print(f"Artemis {tag} is available (you have {local}).")
    print(f"  Run: artemis update")
    print(f"  {GITHUB_RELEASES_PAGE}")
    return 0


def apply_github_release_update(*, force: bool = False) -> int:
    """Download the latest GitHub release, refresh the engine, install the GUI."""
    try:
        release = fetch_latest_release()
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        print(f"Could not reach GitHub Releases: {exc}")
        print(f"  {GITHUB_RELEASES_PAGE}")
        return 1

    tag = str(release.get("tag_name") or "").lstrip("v")
    local = current_version()
    zip_url = str(release.get("zipball_url") or "")
    assets = list(release.get("assets") or [])
    asset = pick_release_asset(assets)

    if not tag:
        print("GitHub latest release has no tag.")
        return 1

    if parse_version(tag) <= parse_version(local) and not force:
        print(f"Artemis {local} is up to date.")
        return 0

    _progress(f"Updating Artemis {local} -> {tag}")
    print(f"  {GITHUB_RELEASES_PAGE}")

    root = engine_root()
    with tempfile.TemporaryDirectory(prefix="artemis-update-") as raw:
        work = Path(raw)
        if zip_url:
            src_zip = work / f"artemis-{tag}-src.zip"
            try:
                _download(zip_url, src_zip, f"source {tag}")
                _overlay_engine_from_zip(src_zip, root)
                print(f"  OK Engine refreshed at {root}")
            except (urllib.error.URLError, OSError, zipfile.BadZipFile) as exc:
                print(f"! Engine source download failed: {exc}")
        else:
            print("! Release has no source zip; engine files were not refreshed.")

        _seed_skills(root)

        if not asset:
            print("No installer asset for this OS in the latest release.")
            print("Engine/skills update finished. Install the GUI from:")
            print(f"  {GITHUB_RELEASES_PAGE}")
            return 0

        from artemis_constants import get_artemis_home

        keep_dir = get_artemis_home() / "cache" / "updates"
        keep_dir.mkdir(parents=True, exist_ok=True)
        installer = keep_dir / str(asset["name"])
        try:
            _download(str(asset["browser_download_url"]), installer, asset["name"])
        except (urllib.error.URLError, OSError) as exc:
            print(f"Installer download failed: {exc}")
            return 1

        _kill_desktop()
        if sys.platform.startswith("win"):
            code = _run_windows_installer(installer)
        else:
            code = _run_posix_installer(installer)
        if code != 0:
            print(f"Installer exited with code {code}.")
            print(f"You can run it manually: {installer}")
            return code

    print(f"OK Artemis {tag} installed. Reopen Desktop if it did not restart.")
    return 0
