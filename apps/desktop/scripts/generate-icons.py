#!/usr/bin/env python3
"""Regenerate Artemis app icons with visible squircle corners.

Source artwork: public/artemis.png
Outputs: assets/icon.png, assets/linux-icons/*, public/apple-touch-icon.png
Also run ImageMagick for icon.ico / icon.icns after this script.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public' / 'artemis.png'
OUT_DIR = ROOT / 'assets'
LINUX_DIR = OUT_DIR / 'linux-icons'
SIZES = (16, 22, 24, 32, 48, 64, 72, 96, 128, 256, 512, 1024)

# Visible dock rounding: margin + superellipse clip.
CORNER_RADIUS_PCT = 0.225
CONTENT_SCALE = 0.90
SHADOW = True


def squircle_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    r = min(radius, size // 2)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=255)
    return mask


def superellipse_mask(size: int, n: float = 4.5) -> Image.Image:
    mask = Image.new('L', (size, size), 0)
    cx = cy = (size - 1) / 2.0
    a = b = size / 2.0
    px = mask.load()
    for y in range(size):
        for x in range(size):
            nx = (x - cx) / a
            ny = (y - cy) / b
            if abs(nx) ** n + abs(ny) ** n <= 1.0:
                px[x, y] = 255
    return mask


def generate_icon(size: int) -> Image.Image:
    src = Image.open(SOURCE).convert('RGBA')
    inner = max(1, int(size * CONTENT_SCALE))
    src_scaled = src.resize((inner, inner), Image.LANCZOS)

    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ox = (size - inner) // 2
    oy = (size - inner) // 2

    if SHADOW and size >= 64:
        shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        shadow_layer = Image.new('RGBA', (inner, inner), (0, 0, 0, 180))
        blur = max(2, size // 64)
        shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(blur))
        shadow.paste(
            shadow_layer,
            (ox + max(1, size // 128), oy + max(1, size // 96)),
            shadow_layer,
        )
        canvas = Image.alpha_composite(canvas, shadow)

    canvas.paste(src_scaled, (ox, oy), src_scaled)

    radius = int(size * CORNER_RADIUS_PCT)
    mask = superellipse_mask(size) if size >= 128 else squircle_mask(size, radius)
    result = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    result.paste(canvas, (0, 0), mask)
    return result


def main() -> int:
    if not SOURCE.is_file():
        print(f'Missing source artwork: {SOURCE}', file=sys.stderr)
        return 1

    LINUX_DIR.mkdir(parents=True, exist_ok=True)

    master = generate_icon(1024)
    master.save(OUT_DIR / 'icon.png', 'PNG')
    print(f'Wrote {OUT_DIR / "icon.png"}')

    for size in SIZES:
        out = LINUX_DIR / f'{size}x{size}.png'
        generate_icon(size).save(out, 'PNG')
        print(f'Wrote {out}')

    generate_icon(180).save(ROOT / 'public' / 'apple-touch-icon.png', 'PNG')
    print(f'Wrote {ROOT / "public" / "apple-touch-icon.png"}')

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
