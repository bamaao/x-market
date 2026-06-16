#!/usr/bin/env python3
"""Regenerate app icons from the source artwork with a consistent #1A1A2E background."""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image
from scipy import ndimage
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "mobile/x_market_flutter/assets/app_icon_source.png"
FLUTTER_ASSETS = ROOT / "mobile/x_market_flutter/assets"
APP_PUBLIC = ROOT / "app/public"
APP_SRC = ROOT / "app/src/app"

BG = (0x1A, 0x1A, 0x2E, 255)
SIZES = {
    "icon-192.png": 192,
    "icon-512.png": 512,
    "apple-touch-icon.png": 180,
    "favicon.png": 32,
}


def is_dark(pixel: tuple[int, ...], threshold: int = 55) -> bool:
    return pixel[3] > 200 and all(pixel[c] < threshold for c in range(3))


def dark_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    pixels = image.load()
    width, height = image.size
    xs: list[int] = []
    ys: list[int] = []
    for y in range(height):
        for x in range(width):
            if is_dark(pixels[x, y]):
                xs.append(x)
                ys.append(y)
    if not xs:
        raise RuntimeError("Could not detect the dark icon tile in the source artwork.")
    return min(xs), min(ys), max(xs), max(ys)


def crop_icon_tile(source: Image.Image) -> Image.Image:
    left, top, right, bottom = dark_bbox(source)
    return source.crop((left, top, right + 1, bottom + 1))


def icon_region_mask(tile: Image.Image) -> np.ndarray:
    rgba = np.array(tile.convert("RGBA"))
    dark = np.all(rgba[:, :, :3] < 70, axis=2) & (rgba[:, :, 3] > 200)
    return ndimage.binary_fill_holes(dark)


def compose_on_background(tile: Image.Image, size: int) -> Image.Image:
    rgba = np.array(tile.convert("RGBA"))
    region = icon_region_mask(tile)
    height, width = rgba.shape[:2]
    side = max(width, height)
    canvas = np.zeros((side, side, 4), dtype=np.uint8)
    canvas[:, :] = BG
    offset_y = (side - height) // 2
    offset_x = (side - width) // 2

    for y in range(height):
        for x in range(width):
            if not region[y, x]:
                continue
            pixel = rgba[y, x]
            if is_dark(tuple(pixel)):
                continue
            canvas[offset_y + y, offset_x + x] = pixel

    image = Image.fromarray(canvas, mode="RGBA")
    return image.resize((size, size), Image.Resampling.LANCZOS)


def extract_foreground(tile: Image.Image) -> Image.Image:
    rgba = np.array(tile.convert("RGBA"))
    region = icon_region_mask(tile)
    height, width = rgba.shape[:2]
    out = np.zeros((height, width, 4), dtype=np.uint8)
    for y in range(height):
        for x in range(width):
            if not region[y, x]:
                continue
            pixel = rgba[y, x]
            if is_dark(tuple(pixel)):
                continue
            out[y, x] = pixel
    return Image.fromarray(out, mode="RGBA")


def write_png(path: Path, image: Image.Image) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)


def write_ico(path: Path, image: Image.Image) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])


def ensure_source_backup() -> None:
    current = FLUTTER_ASSETS / "app_icon.png"
    if SOURCE.exists():
        return
    if not current.exists():
        raise FileNotFoundError(f"Missing source artwork: {current}")
    shutil.copy2(current, SOURCE)


def build_master_assets() -> tuple[Image.Image, Image.Image]:
    ensure_source_backup()
    source = Image.open(SOURCE).convert("RGBA")
    tile = crop_icon_tile(source)
    master = compose_on_background(tile, 1024)
    foreground = extract_foreground(tile)
    foreground_square = Image.new("RGBA", master.size, (0, 0, 0, 0))
    offset = (
        (master.size[0] - foreground.size[0]) // 2,
        (master.size[1] - foreground.size[1]) // 2,
    )
    foreground_square.paste(foreground, offset, foreground)
    write_png(FLUTTER_ASSETS / "app_icon.png", master)
    write_png(FLUTTER_ASSETS / "app_icon_foreground.png", foreground_square)
    return master, foreground_square


def export_web_assets(master: Image.Image) -> None:
    for filename, size in SIZES.items():
        resized = master.resize((size, size), Image.Resampling.LANCZOS)
        write_png(APP_PUBLIC / filename, resized)
    write_png(APP_SRC / "icon.png", master)
    write_png(APP_SRC / "apple-icon.png", master.resize((180, 180), Image.Resampling.LANCZOS))
    write_ico(APP_SRC / "favicon.ico", master.resize((48, 48), Image.Resampling.LANCZOS))


def main() -> None:
    master, _ = build_master_assets()
    export_web_assets(master)
    print("Generated consistent app icons with background #1A1A2E")
    print(f"  Flutter assets: {FLUTTER_ASSETS}")
    print(f"  Web public:     {APP_PUBLIC}")
    print(f"  Next app dir:   {APP_SRC}")
    print("Run `dart run flutter_launcher_icons` in mobile/x_market_flutter to refresh mobile icons.")


if __name__ == "__main__":
    main()
