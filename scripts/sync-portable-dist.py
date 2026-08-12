"""Sync rebuilt desktop dist into the Windows portable install and repack asar."""
from __future__ import annotations

import shutil
from pathlib import Path

DESKTOP_DIST = Path(r"C:\Users\Administrator\AppData\Local\artemis\artemis-agent\apps\desktop\dist")
DESKTOP_PUBLIC = Path(r"C:\Users\Administrator\AppData\Local\artemis\artemis-agent\apps\desktop\public")
DESKTOP_ASSETS = Path(r"C:\Users\Administrator\AppData\Local\artemis\artemis-agent\apps\desktop\assets")
PORTABLE = Path(r"E:\Projetos\Artemis\install\Artemis-win-portable")
UNPACKED = PORTABLE / "resources" / "app.asar.unpacked" / "dist"
ASAR_EXTRACT = Path(r"E:\Projetos\Artemis\install\_asar_extract")
ASAR_PATH = PORTABLE / "resources" / "app.asar"


def mirror_tree(src: Path, dst: Path, *, preserve_names: set[str] | None = None) -> None:
    preserve_names = preserve_names or set()
    if dst.exists():
        for child in list(dst.iterdir()):
            if child.name in preserve_names:
                continue
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()
    dst.mkdir(parents=True, exist_ok=True)
    for child in src.iterdir():
        target = dst / child.name
        if child.is_dir():
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(child, target)
        else:
            shutil.copy2(child, target)


def main() -> None:
    # Keep native modules that live under unpacked dist/node_modules
    print("syncing unpacked dist...")
    mirror_tree(DESKTOP_DIST, UNPACKED, preserve_names={"node_modules", "electron-main.mjs", "electron-preload.js"})

    # Ensure brand images exist even if vite didn't copy public assets
    for name in ("artemis.png", "artemis.png", "apple-touch-icon.png", "artemis-sprite.png"):
        src = DESKTOP_PUBLIC / name
        if src.exists():
            shutil.copy2(src, UNPACKED / name)
            print("copied", name)

    print("syncing asar extract dist/public/assets...")
    mirror_tree(DESKTOP_DIST, ASAR_EXTRACT / "dist", preserve_names={"node_modules", "electron-main.mjs", "electron-preload.js"})
    for name in ("artemis.png", "artemis.png", "apple-touch-icon.png", "artemis-sprite.png", "nous-girl.jpg"):
        src = DESKTOP_PUBLIC / name
        if src.exists():
            shutil.copy2(src, ASAR_EXTRACT / "public" / name)
            shutil.copy2(src, ASAR_EXTRACT / "dist" / name)
    for name in ("icon.png", "icon.ico", "icon.icns"):
        src = DESKTOP_ASSETS / name
        if src.exists():
            shutil.copy2(src, ASAR_EXTRACT / "assets" / name)

    # HTML title
    for html in (UNPACKED / "index.html", ASAR_EXTRACT / "dist" / "index.html"):
        if not html.exists():
            continue
        text = html.read_text(encoding="utf-8")
        text2 = text.replace("<title>Artemis</title>", "<title>Artemis</title>")
        if text2 != text:
            html.write_text(text2, encoding="utf-8")
            print("titled Artemis:", html)

    # package.json productName already Artemis in packaged asar; keep it
    pkg = ASAR_EXTRACT / "package.json"
    if pkg.exists():
        t = pkg.read_text(encoding="utf-8")
        t2 = t.replace('"productName": "Artemis"', '"productName": "Artemis"')
        if t2 != t:
            pkg.write_text(t2, encoding="utf-8")
            print("package.json productName Artemis")

    print("done sync")


if __name__ == "__main__":
    main()
