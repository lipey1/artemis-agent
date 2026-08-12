#!/usr/bin/env python3
"""Regenerate Artemis app icons with squircle-clipped transparent corners.

Loads square master artwork, keeps a 1:1 canvas with centered artwork, and
clips to a superellipse so corner pixels are transparent (never black squares).

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


def prepare_source(img: Image.Image) -> Image.Image:
    """Ensure a square RGBA canvas; replace pure black with transparent.

    Do not crop letterboxing or pillarboxing. The master artwork is already
    square; aggressive cropping produced wide, short icons in 0.17.10+.
    """
    rgba = img.convert('RGBA')
    w, h = rgba.size

    if w != h:
        side = max(w, h)
        canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        ox = (side - w) // 2
        oy = (side - h) // 2
        canvas.paste(rgba, (ox, oy), rgba)
        rgba = canvas

    out = rgba.copy()
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


def generate_icon(source: Image.Image, size: int, *, linux_dock: bool = False) -> Image.Image:
    composite = source.resize((size, size), Image.LANCZOS)
    # GNOME/Ubuntu dock icons (<=48px hicolor) render without compositing
    # transparent corners onto the panel — squircle clipping makes them look
    # blank/invisible. Keep small Linux theme sizes fully opaque.
    if linux_dock and size <= 48:
        return composite
    n, scale = mask_params(size)
    mask = superellipse_mask(size, n=n, scale=scale)
    result = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    result.paste(composite, (0, 0), mask)
    return result


def verify_corners(img: Image.Image, label: str) -> list[str]:
    """Return list of verification errors."""
    errors: list[str] = []
    w, h = img.size

    if w != h:
        errors.append(f'{label}: not square ({w}x{h})')

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


def verify_square_content(img: Image.Image, label: str, max_ratio_delta: float = 0.08) -> list[str]:
    """Opaque bbox should be roughly square, not a wide rectangle."""
    errors: list[str] = []
    bbox = img.getbbox()
    if not bbox:
        errors.append(f'{label}: fully transparent image')
        return errors

    bw = bbox[2] - bbox[0]
    bh = bbox[3] - bbox[1]
    if bw <= 0 or bh <= 0:
        errors.append(f'{label}: empty opaque bbox {bbox}')
        return errors

    ratio = bw / bh
    if abs(ratio - 1.0) > max_ratio_delta:
        errors.append(f'{label}: opaque bbox {bbox} ratio={ratio:.3f}, expected ~1.0')
    return errors


def verify_center_opaque(img: Image.Image, label: str) -> list[str]:
    errors: list[str] = []
    w, h = img.size
    px = img.getpixel((w // 2, h // 2))
    if px[3] == 0:
        errors.append(f'{label}: center pixel transparent rgba={px}')
    return errors


def verify_opaque_bbox_ratio(
    img: Image.Image, label: str, min_ratio: float = 0.30
) -> list[str]:
    """Dock icons need enough opaque pixels inside the opaque bounding box."""
    errors: list[str] = []
    bbox = img.getbbox()
    if not bbox:
        errors.append(f'{label}: fully transparent image')
        return errors

    cropped = img.crop(bbox)
    data = list(cropped.getdata())
    opaque = sum(1 for p in data if p[3] > 200)
    ratio = opaque / len(data) if data else 0.0
    if ratio < min_ratio:
        errors.append(
            f'{label}: opaque bbox ratio {ratio:.1%} < {min_ratio:.0%} in {bbox}'
        )
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
        icon = generate_icon(source, size, linux_dock=True)
        icon.save(out, 'PNG')
        if size > 48:
            all_errors.extend(verify_corners(icon, f'{size}x{size}'))
        all_errors.extend(verify_center_opaque(icon, f'{size}x{size}'))
        if size in (48, 256, 1024):
            all_errors.extend(verify_square_content(icon, f'{size}x{size}'))
        if size == 48:
            all_errors.extend(verify_opaque_bbox_ratio(icon, f'{size}x{size}'))
            # Small dock sizes must not rely on transparent squircle corners.
            corners = (
                icon.getpixel((0, 0))[3],
                icon.getpixel((size - 1, 0))[3],
                icon.getpixel((0, size - 1))[3],
                icon.getpixel((size - 1, size - 1))[3],
            )
            if any(alpha < 200 for alpha in corners):
                all_errors.append(
                    f'{size}x{size}: dock corner alpha {corners}, expected fully opaque'
                )
        if size == 256:
            all_errors.extend(verify_no_black_bars(icon, f'{size}x{size}'))
        print(f'Wrote {out}')

    apple = generate_icon(source, 180)
    apple.save(ROOT / 'public' / 'apple-touch-icon.png', 'PNG')
    all_errors.extend(verify_corners(apple, '180 apple-touch'))
    all_errors.extend(verify_center_opaque(apple, '180 apple-touch'))
    print(f'Wrote {ROOT / "public" / "apple-touch-icon.png"}')

    all_errors.extend(verify_corners(master, '1024 master'))
    all_errors.extend(verify_square_content(master, '1024 master'))
    all_errors.extend(verify_no_black_bars(master, '1024 master'))
    all_errors.extend(verify_center_opaque(master, '1024 master'))

    if all_errors:
        print('\nVERIFICATION FAILED:', file=sys.stderr)
        for err in all_errors:
            print(f'  - {err}', file=sys.stderr)
        return 1

    print('\nVerification passed: square squircle icons, transparent corners, no black pillarboxing.')

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
