#!/usr/bin/env python3
"""Regenerate Artemis app icons with squircle-clipped transparent corners.

Loads square master artwork, removes black/beige letterboxing, crops to a
centered square, resizes full-bleed, and clips to a superellipse so corner
pixels are transparent (never black or beige squares).

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

# Beige parchment background in the master artwork.
BEIGE = (223, 207, 180)


def ensure_source() -> Path:
    if SOURCE.is_file():
        return SOURCE
    if SOURCE_BOOTSTRAP.is_file():
        SOURCE.parent.mkdir(parents=True, exist_ok=True)
        Image.open(SOURCE_BOOTSTRAP).convert('RGBA').save(SOURCE, 'PNG')
        print(f'Bootstrapped square master: {SOURCE}')
        return SOURCE
    raise FileNotFoundError(f'Missing artwork: {SOURCE} or {SOURCE_BOOTSTRAP}')


def _is_black(p: tuple[int, ...], threshold: int = 40) -> bool:
    return p[3] > 200 and p[0] < threshold and p[1] < threshold and p[2] < threshold


def _is_beige(p: tuple[int, ...], tolerance: int = 35) -> bool:
    return (
        p[3] > 200
        and abs(int(p[0]) - BEIGE[0]) < tolerance
        and abs(int(p[1]) - BEIGE[1]) < tolerance
        and abs(int(p[2]) - BEIGE[2]) < tolerance
    )


def _is_background(p: tuple[int, ...]) -> bool:
    return p[3] < 128 or _is_black(p) or _is_beige(p)


def _column_black_ratio(px, w: int, h: int, x: int, y0: int, y1: int) -> float:
    total = y1 - y0
    if total <= 0:
        return 0.0
    black = sum(1 for y in range(y0, y1) if _is_black(px[x, y]))
    return black / total


def _row_beige_ratio(px, w: int, y: int) -> float:
    beige = sum(1 for x in range(w) if _is_beige(px[x, y]))
    return beige / w


def prepare_source(img: Image.Image) -> Image.Image:
    """Crop letterboxing and pillarboxing, then center on a square canvas."""
    rgba = img.convert('RGBA')
    w, h = rgba.size
    px = rgba.load()

    y0, y1 = h // 4, (3 * h) // 4

    # Strip black pillarboxing from left/right.
    left = 0
    while left < w and _column_black_ratio(px, w, h, left, y0, y1) > 0.8:
        left += 1
    right = w - 1
    while right >= left and _column_black_ratio(px, w, h, right, y0, y1) > 0.8:
        right -= 1

    cropped = rgba.crop((left, 0, right + 1, h)) if right >= left else rgba
    w, h = cropped.size
    px = cropped.load()

    # Strip uniform beige letterboxing from top/bottom.
    top = 0
    for y in range(h):
        if _row_beige_ratio(px, w, y) < 0.85:
            top = y
            break
    bottom = h - 1
    for y in range(h - 1, -1, -1):
        if _row_beige_ratio(px, w, y) < 0.85:
            bottom = y
            break

    cropped = cropped.crop((0, top, w, bottom + 1))
    w, h = cropped.size
    px = cropped.load()

    # Foreground bbox (artwork + parchment, excluding outer black/beige pads).
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            if not _is_background(px[x, y]):
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)

    if maxx < 0:
        return cropped

    cx = (minx + maxx) // 2
    cy = (miny + maxy) // 2
    side = max(maxx - minx + 1, maxy - miny + 1)

    # Expand slightly so engraving lines near the edge are not clipped.
    side = min(max(w, h), int(side * 1.02))

    x0 = max(0, cx - side // 2)
    y0 = max(0, cy - side // 2)
    x1 = min(w, x0 + side)
    y1 = min(h, y0 + side)
    x0 = max(0, x1 - side)
    y0 = max(0, y1 - side)

    square = cropped.crop((x0, y0, x1, y1))

    # Pad to a perfect square when the crop hit an image edge.
    if square.size[0] != square.size[1]:
        side = max(square.size)
        canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        ox = (side - square.size[0]) // 2
        oy = (side - square.size[1]) // 2
        canvas.paste(square, (ox, oy), square)
        square = canvas

    # Replace any remaining black background pixels with transparent.
    out = square.copy()
    opx = out.load()
    ow, oh = out.size
    for y in range(oh):
        for x in range(ow):
            if _is_black(opx[x, y]):
                opx[x, y] = (0, 0, 0, 0)

    return out


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

    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        px = img.getpixel((x, y))
        if px[3] != 0:
            errors.append(f'{label}: corner ({x},{y}) rgba={px}, expected alpha=0')
        elif px[:3] != (0, 0, 0):
            errors.append(f'{label}: corner ({x},{y}) not transparent black, rgba={px}')

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
                    f'{label}: corner zone ({x},{y}) offset {d} rgba={px}, expected alpha=0'
                )
    return errors


def verify_no_black_bars(img: Image.Image, label: str) -> list[str]:
    """Reject opaque black edge runs in the horizontal mid scan."""
    errors: list[str] = []
    w, h = img.size
    mid = h // 2
    edge = max(2, w // 16)

    def edge_black_run(start: int, step: int) -> int:
        run = 0
        x = start
        while 0 <= x < w:
            px = img.getpixel((x, mid))
            if px[3] > 200 and _is_black(px):
                run += 1
                x += step
            else:
                break
        return run

    left_run = edge_black_run(0, 1)
    right_run = edge_black_run(w - 1, -1)
    if left_run >= edge:
        errors.append(f'{label}: black pillarbox on left ({left_run}px at y={mid})')
    if right_run >= edge:
        errors.append(f'{label}: black pillarbox on right ({right_run}px at y={mid})')
    return errors


def main() -> int:
    source_path = ensure_source()
    raw = Image.open(source_path).convert('RGBA')
    source = prepare_source(raw)
    if source.size != raw.size or source.tobytes() != raw.tobytes():
        source.save(source_path, 'PNG')
        print(f'Updated square master: {source_path} ({source.size[0]}x{source.size[1]})')

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
        if size == 256:
            all_errors.extend(verify_no_black_bars(icon, f'{size}x{size}'))
        print(f'Wrote {out}')

    apple = generate_icon(source, 180)
    apple.save(ROOT / 'public' / 'apple-touch-icon.png', 'PNG')
    all_errors.extend(verify_corners(apple, '180 apple-touch'))
    print(f'Wrote {ROOT / "public" / "apple-touch-icon.png"}')

    all_errors.extend(verify_corners(generate_icon(source, 48), '48 verify'))
    all_errors.extend(verify_no_black_bars(generate_icon(source, 256), '256 verify'))

    if all_errors:
        print('\nVERIFICATION FAILED:', file=sys.stderr)
        for err in all_errors:
            print(f'  - {err}', file=sys.stderr)
        return 1

    print('\nVerification passed: transparent squircle corners, no black pillarboxing.')

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
