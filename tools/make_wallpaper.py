#!/usr/bin/env python3
"""Render RandomOS desktop wallpapers from assets/mascot.png.

Output (relative to the project root):
  files/system/usr/share/wallpapers/RandomOS/contents/images/3840x2160.jpg
  files/system/usr/share/wallpapers/RandomOS/contents/images/2560x1600.jpg
  files/system/usr/share/wallpapers/RandomOS/contents/screenshot.jpg
plus a 1280x720 preview (default: <system temp>/randomos-wallpaper-preview-1280x720.jpg).

Usage:  python tools/make_wallpaper.py [--preview PATH]
Requires Pillow and numpy. Output is deterministic (fixed random seed).
"""
from __future__ import annotations

import math
import os
import random
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASCOT = os.path.join(ROOT, "assets", "mascot.png")
PKG = os.path.join(ROOT, "files", "system", "usr", "share", "wallpapers", "RandomOS")
IMAGES = os.path.join(PKG, "contents", "images")
PREVIEW = os.path.join(tempfile.gettempdir(), "randomos-wallpaper-preview-1280x720.jpg")

SEED = 20261119

# Brand colours
ACCENT = (0x2A, 0xA8, 0xE8)
NAVY_DEEP = (0x05, 0x08, 0x1A)
NAVY = (0x0A, 0x10, 0x30)
INDIGO = (0x2B, 0x23, 0x7A)  # quiet secondary hue for nebula depth
WHITE = (0xF2, 0xF6, 0xFF)


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    names = (
        ("Sora-SemiBold.ttf", "Inter-SemiBold.ttf", "seguisb.ttf", "segoeuib.ttf",
         "DejaVuSans-Bold.ttf", "arialbd.ttf")
        if bold else
        ("Sora-Light.ttf", "Inter-Light.ttf", "segoeuil.ttf", "segoeui.ttf",
         "DejaVuSans.ttf", "arial.ttf")
    )
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default(size)


# --------------------------------------------------------------------------- #
# Background: gradient + nebula, computed in float at reduced resolution
# --------------------------------------------------------------------------- #
def gaussian(xx, yy, cx, cy, rx, ry, angle=0.0):
    c, s = math.cos(angle), math.sin(angle)
    dx, dy = xx - cx, yy - cy
    u = (dx * c + dy * s) / rx
    v = (-dx * s + dy * c) / ry
    return np.exp(-(u * u + v * v))


def background(w: int, h: int, layout: dict) -> np.ndarray:
    """Return float32 HxWx3 array in 0..255."""
    sw, sh = max(64, w // 4), max(36, h // 4)
    ys, xs = np.mgrid[0:sh, 0:sw].astype(np.float32)
    # Normalised coordinates: x in [0, w/h], y in [0, 1] so blobs stay round.
    aspect = w / h
    xx = xs / (sw - 1) * aspect
    yy = ys / (sh - 1)

    # Diagonal base gradient: lighter navy upper-left -> deep navy lower-right.
    t = np.clip((xx / aspect) * 0.45 + yy * 0.75, 0, 1) ** 1.1
    base = np.empty((sh, sw, 3), np.float32)
    for i in range(3):
        base[..., i] = NAVY[i] * (1 - t) + NAVY_DEEP[i] * t

    mx = layout["mascot_x"] * aspect
    my = layout["mascot_y"]

    def add(color, strength, field):
        for i in range(3):
            base[..., i] += color[i] * strength * field

    # Main accent nebula behind the astronaut, elongated and tilted.
    add(ACCENT, 0.30, gaussian(xx, yy, mx + 0.02, my - 0.02, 0.48, 0.30, -0.5))
    add(ACCENT, 0.18, gaussian(xx, yy, mx + 0.10, my + 0.10, 0.22, 0.16, -0.3))
    # Indigo depth around it.
    add(INDIGO, 0.38, gaussian(xx, yy, mx - 0.28, my + 0.22, 0.55, 0.30, 0.35))
    add(INDIGO, 0.22, gaussian(xx, yy, mx + 0.35, my - 0.45, 0.45, 0.25, -0.2))
    # Faint accent wash in the far upper-left to balance the composition.
    add(ACCENT, 0.06, gaussian(xx, yy, 0.05, 0.05, 0.55, 0.35, 0.2))

    # Wispy nebula texture: multi-octave noise modulating the accent glow.
    rng = np.random.default_rng(SEED)
    n = np.zeros((sh, sw), np.float32)
    amp_total = 0.0
    for octave, amp in ((5, 1.0), (11, 0.55), (23, 0.3)):
        gw, gh = max(2, int(octave * aspect)), octave
        layer = Image.fromarray((rng.random((gh, gw)) * 255).astype(np.uint8))
        layer = layer.resize((sw, sh), Image.BICUBIC).filter(ImageFilter.GaussianBlur(sw / (octave * 6)))
        n += amp * np.asarray(layer, np.float32) / 255.0
        amp_total += amp
    n /= amp_total
    n = np.clip((n - 0.42) * 3.2, 0, 1) ** 1.5
    band = gaussian(xx, yy, mx - 0.05, my + 0.02, 0.95, 0.30, -0.42)
    add(ACCENT, 0.22, band * n)
    add(INDIGO, 0.30, gaussian(xx, yy, mx - 0.45, my + 0.10, 0.9, 0.35, -0.42) * (1 - n) * 0.8)

    # Gentle vignette.
    vx = (xx / aspect - 0.55) / 0.85
    vy = (yy - 0.5) / 0.75
    vig = np.clip(1 - (vx * vx + vy * vy) * 0.55, 0.45, 1)
    base *= vig[..., None]

    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB")
    big = np.asarray(img.resize((w, h), Image.BICUBIC), np.float32)
    # Dither to avoid banding in the smooth gradient.
    big += np.random.default_rng(SEED + 1).normal(0, 0.9, (h, w, 1)).astype(np.float32)
    return big


# --------------------------------------------------------------------------- #
# Stars
# --------------------------------------------------------------------------- #
def starfield(w: int, h: int, layout: dict) -> Image.Image:
    """RGBA layer with stars (alpha carries brightness)."""
    rng = random.Random(SEED)
    scale = h / 2160.0
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    # Keep a calm zone around the wordmark.
    wx0, wy0 = 0, h * 0.78
    wx1, wy1 = w * 0.30, h

    def free(x, y):
        return not (wx0 <= x <= wx1 and wy0 <= y <= wy1)

    count = int(1400 * (w * h) / (3840 * 2160))
    for _ in range(count):
        x, y = rng.random() * w, rng.random() * h
        if not free(x, y):
            continue
        b = rng.random() ** 3.2  # most stars faint
        r = (0.5 + b * 1.6) * scale
        a = int(40 + 200 * b)
        tint = rng.random()
        col = (200, 225, 255) if tint < 0.7 else ((255, 240, 225) if tint < 0.9 else (170, 215, 255))
        d.ellipse((x - r, y - r, x + r, y + r), fill=col + (a,))

    # A handful of brighter stars with a soft halo.
    halo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    for _ in range(int(16 * w / 3840 * 1.0) + 6):
        x, y = rng.random() * w, rng.random() * h
        if not free(x, y):
            continue
        r = (2.2 + rng.random() * 1.6) * scale
        hd.ellipse((x - r * 5, y - r * 5, x + r * 5, y + r * 5), fill=(120, 190, 255, 60))
        d.ellipse((x - r, y - r, x + r, y + r), fill=(240, 248, 255, 255))
    halo = halo.filter(ImageFilter.GaussianBlur(6 * scale))
    out = Image.alpha_composite(halo, layer)
    return out


# --------------------------------------------------------------------------- #
# Mascot
# --------------------------------------------------------------------------- #
def mascot_layers(w: int, h: int, layout: dict):
    src = Image.open(MASCOT).convert("RGBA")
    target_h = int(h * layout["mascot_h"])
    mw = int(src.width * target_h / src.height)
    m = src.resize((mw, target_h), Image.LANCZOS)
    m = m.rotate(layout["mascot_rot"], resample=Image.BICUBIC, expand=True)
    cx, cy = int(w * layout["mascot_x"]), int(h * layout["mascot_y"])
    pos = (cx - m.width // 2, cy - m.height // 2)

    alpha = m.getchannel("A")
    canvas_a = Image.new("L", (w, h), 0)
    canvas_a.paste(alpha, pos)

    # Wide soft accent glow + tighter rim glow.
    wide = canvas_a.filter(ImageFilter.GaussianBlur(h * 0.045))
    tight = canvas_a.filter(ImageFilter.GaussianBlur(h * 0.010))
    glow = Image.new("RGBA", (w, h), ACCENT + (0,))
    ga = Image.eval(wide, lambda v: int(v * 0.55))
    ta = Image.eval(tight, lambda v: int(v * 0.28))
    glow.putalpha(Image.fromarray(np.maximum(np.asarray(ga), np.asarray(ta))))

    body = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    body.paste(m, pos, m)
    return glow, body


# --------------------------------------------------------------------------- #
# Wordmark
# --------------------------------------------------------------------------- #
def wordmark(img: Image.Image, layout: dict) -> None:
    w, h = img.size
    size = int(h * 0.030)
    f = font(size, bold=True)
    x = int(w * 0.045)
    y = int(h * layout["word_y"])

    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    tracking = size * 0.04

    def draw_tracked(x, text, fill):
        for ch in text:
            d.text((x, y), ch, font=f, fill=fill, anchor="ls")
            x += f.getlength(ch) + tracking
        return x

    # Small diamond mark (nod to the ace of diamonds) before the name.
    dm = size * 0.30
    dcx, dcy = x + dm, y - size * 0.36
    d.polygon([(dcx, dcy - dm * 1.25), (dcx + dm, dcy), (dcx, dcy + dm * 1.25), (dcx - dm, dcy)],
              fill=(0xE5, 0x41, 0x3A, 235))
    tx = x + dm * 2 + size * 0.45
    tx = draw_tracked(tx, "Random", WHITE + (235,))
    draw_tracked(tx, "OS", ACCENT + (255,))

    shadow = layer.filter(ImageFilter.GaussianBlur(size * 0.25))
    sh_a = Image.eval(shadow.getchannel("A"), lambda v: int(v * 0.5))
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sh.putalpha(sh_a)
    img.alpha_composite(sh)
    img.alpha_composite(layer)


# --------------------------------------------------------------------------- #
LAYOUTS = {
    # Fractions of width/height; tuned per aspect ratio.
    "16:9": dict(mascot_x=0.715, mascot_y=0.50, mascot_h=0.64, mascot_rot=11, word_y=0.885),
    "16:10": dict(mascot_x=0.705, mascot_y=0.50, mascot_h=0.60, mascot_rot=11, word_y=0.895),
}


def render(w: int, h: int, layout: dict) -> Image.Image:
    bg = background(w, h, layout)
    img = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    img.alpha_composite(starfield(w, h, layout))
    glow, body = mascot_layers(w, h, layout)
    img.alpha_composite(glow)
    img.alpha_composite(body)
    wordmark(img, layout)
    return img.convert("RGB")


def save_jpg(img: Image.Image, path: str, quality: int = 92, limit: int = 2_500_000) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    q = quality
    while True:
        img.save(path, "JPEG", quality=q, optimize=True, progressive=True, subsampling="4:2:0")
        size = os.path.getsize(path)
        if size <= limit or q <= 80:
            break
        q -= 2
    print(f"{path}  {img.width}x{img.height}  q={q}  {size / 1e6:.2f} MB")


def main() -> None:
    preview_path = PREVIEW
    if "--preview" in sys.argv:
        preview_path = os.path.abspath(sys.argv[sys.argv.index("--preview") + 1])
    uhd = render(3840, 2160, LAYOUTS["16:9"])
    save_jpg(uhd, os.path.join(IMAGES, "3840x2160.jpg"))
    wide = render(2560, 1600, LAYOUTS["16:10"])
    save_jpg(wide, os.path.join(IMAGES, "2560x1600.jpg"))
    preview = uhd.resize((1280, 720), Image.LANCZOS)
    save_jpg(preview, preview_path, quality=90)
    shot = uhd.resize((400, 225), Image.LANCZOS)
    save_jpg(shot, os.path.join(PKG, "contents", "screenshot.jpg"), quality=88)


if __name__ == "__main__":
    main()
