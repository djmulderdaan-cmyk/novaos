"""Haalt de blauwe achtergrond weg achter de mascotte.

Gebruik:  python tools/cutout_mascot.py
Leest assets/mascot-bron.png, schrijft assets/mascot.png (transparant, bijgesneden).
"""
from collections import deque
from pathlib import Path
from PIL import Image, ImageFilter

root = Path(__file__).resolve().parent.parent
img = Image.open(root / "assets/mascot-bron.png").convert("RGB")
w, h = img.size
px = img.load()


def bluish(c):
    r, g, b = c
    # achtergrondblauw, donkere spikkels en schaduw: blauw duidelijk sterker dan rood
    return b > 90 and b - r > 60 and g > r


# flood-fill vanaf de randen over alles wat blauw is; binnen de zwarte omlijning blijft alles staan
bg = bytearray(w * h)
q = deque()
for x in range(w):
    q.append((x, 0)); q.append((x, h - 1))
for y in range(h):
    q.append((0, y)); q.append((w - 1, y))
while q:
    x, y = q.popleft()
    i = y * w + x
    if bg[i] or not bluish(px[x, y]):
        continue
    bg[i] = 1
    if x > 0: q.append((x - 1, y))
    if x < w - 1: q.append((x + 1, y))
    if y > 0: q.append((x, y - 1))
    if y < h - 1: q.append((x, y + 1))

alpha = Image.frombytes("L", (w, h), bytes(0 if v else 255 for v in bg))
# randje iets zachter maken
alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
out = img.convert("RGBA")
out.putalpha(alpha)
out = out.crop(alpha.getbbox())
out.save(root / "assets/mascot.png")
print("Klaar:", out.size)
