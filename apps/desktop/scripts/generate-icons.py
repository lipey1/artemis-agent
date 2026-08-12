#!/usr/bin/env python3
"""Regenerate Artemis app icons with squircle-clipped transparent corners.

Loads square master artwork, resizes full-bleed, clips the entire composite
(background + artwork) to a superellipse so corner pixels are transparent.

Source: assets/artemis-source.png (square master; bootstrapped from public/artemis.png)
Outputs: assets/icon.png, assets/linux-icons/*, public/artemis.png,
         public/apple-touch-icon.png, icon.ico, icon.icns
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets' / 'artemis-source.png'
SOURCE_BOOTSTRAP = ROOT / 'public' / 'artemis.png'
OUT_DIR = ROOT / 'assets'
LINUX_DIR = OUT_DIR / 'linux-icons'
SIZES = (16, 22, 24, 32, 48, 64, 72, 96, 128, 256, 512, 1024)

# ~20% corner radius feel via superellipse exponent (n=4 is standard squircle).
SUPERELLIPSE_N = 4.0


def ensure_source() -> Path:
    if SOURCE.is_file():
        return SOURCE
    if SOURCE_BOOTSTRAP.is_file():
        SOURCE.parent.mkdir(parents=True, exist_ok=True)
        Image.open(SOURCE_BOOTSTRAP).convert('RGBA').save(SOURCE, 'PNG')
        print(f'Bootstrapped square master: {SOURCE}')
        return SOURCE
    raise FileNotFoundError(f'Missing artwork: {SOURCE} or {SOURCE_BOOTSTRAP}')


def superellipse_mask(size: int, n: float = SUPERELLIPSE_N, scale: float = 1.0) -> Image.Image:
    """Superellipse (squircle) alpha mask. scale < 1 shrinks the visible area."""
    mask = Image.new('L', (size, size), 0)
    cx = cy = (size - 1) / 2.0
    a = b = (size / 2.0) * scale
    px = mask.load()
    for y in range(size):
        for x in range(size):
            nx = (x - cx) / a
            ny = (y - cy) / b
            if abs(nx) ** n + abs(ny) ** n <= 1.0:
                px[x, y] = 255
    return mask


def mask_params(size: int) -> tuple[float, float]:
    """Size-adaptive squircle: small dock icons need rounder clipping."""
    if size <= 32:
        return 3.0, 0.88
    if size <= 48:
        return 3.0, 0.90
    if size <= 64:
        return 3.5, 0.95
    return SUPERELLIPSE_N, 1.0


def generate_icon(source: Image.Image, size: int) -> Image.Image:
    composite = source.resize((size, size), Image.LANCZOS)
    n, scale = mask_params(size)
    mask = superellipse_mask(size, n=n, scale=scale)
    result = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    result.paste(composite, (0, 0), mask)
    return result


def verify_corners(img: Image.Image, label: str) -> list[str]:
    """Return list of verification errors."""
    errors: list[str] = []
    w, h = img.size

    # Exact corners must be fully transparent.
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        px = img.getpixel((x, y))
        if px[3] != 0:
            errors.append(f'{label}: corner ({x},{y}) alpha={px[3]}, expected 0')

    # Near-corner pixels along diagonals must also be transparent (visible rounding).
    # Depth scales with icon size; large icons drive GNOME app search.
    if w >= 128:
        depth = max(8, int(w * 0.06))
    elif w >= 48:
        depth = 4
    else:
        depth = 1

    for d in range(1, depth + 1):
        for x, y in ((d, d), (w - 1 - d, d), (d, h - 1 - d), (w - 1 - d, h - 1 - d)):
            px = img.getpixel((x, y))
            if px[3] != 0:
                errors.append(
                    f'{label}: corner zone ({x},{y}) offset {d} alpha={px[3]}, expected 0'
                )
    return errors


def main() -> int:
    source_path = ensure_source()
    source = Image.open(source_path).convert('RGBA')

    LINUX_DIR.mkdir(parents=True, exist_ok=True)

    all_errors: list[str] = []

    master = generate_icon(source, 1024)
    master.save(OUT_DIR / 'icon.png', 'PNG')
    print(f'Wrote {OUT_DIR / "icon.png"}')

    master.save(ROOT / 'public' / 'artemis.png', 'PNG')
    print(f'Wrote {ROOT / "public" / "artemis.png"}')

    for size in SIZES:
        out = LINUX_DIR / f'{size}x{size}.png'
        icon = generate_icon(source, size)
        icon.save(out, 'PNG')
        all_errors.extend(verify_corners(icon, f'{size}x{size}'))
        print(f'Wrote {out}')

    apple = generate_icon(source, 180)
    apple.save(ROOT / 'public' / 'apple-touch-icon.png', 'PNG')
    all_errors.extend(verify_corners(apple, '180 apple-touch'))
    print(f'Wrote {ROOT / "public" / "apple-touch-icon.png"}')

    all_errors.extend(verify_corners(generate_icon(source, 256), '256 verify'))

    if all_errors:
        print('\nVERIFICATION FAILED:', file=sys.stderr)
        for err in all_errors:
            print(f'  - {err}', file=sys.stderr)
        return 1

    print('\nVerification passed: all corner pixels transparent, no beige in corner zones.')

    icon_png = OUT_DIR / 'icon.png'
    subprocess.run(
        [
            'convert',
            str(icon_png),
            '-define',
            'icon:auto-resize=256,128,64,48,32,16',
            str(OUT_DIR / 'icon.ico'),
        ],
        check=True,
    )
    subprocess.run(['convert', str(icon_png), str(OUT_DIR / 'icon.icns')], check=True)
    print(f'Wrote {OUT_DIR / "icon.ico"} and {OUT_DIR / "icon.icns"}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
