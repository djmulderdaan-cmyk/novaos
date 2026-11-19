"""Maakt de afbeeldingen voor het opstartscherm en de shell.

Gebruik:  python tools/make_logo.py ["RandomOS"] ["#2aa8e8"]
Nodig:    assets/mascot.png  (maak die met tools/cutout_mascot.py)
"""
import shutil
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

name = sys.argv[1] if len(sys.argv) > 1 else "RandomOS"
color = sys.argv[2] if len(sys.argv) > 2 else "#2aa8e8"
root = Path(__file__).resolve().parent.parent
theme = root / "files/system/usr/share/plymouth/themes/randomos"
shell_img = root / "files/system/usr/lib/randomos-shell/app/ui/img"
theme.mkdir(parents=True, exist_ok=True)
shell_img.mkdir(parents=True, exist_ok=True)


def font(size):
    for f in ("seguisb.ttf", "segoeuib.ttf", "DejaVuSans-Bold.ttf", "arialbd.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default(size)


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# --- mascotte (zwevende astronaut) ---
mascot = Image.open(root / "assets/mascot.png").convert("RGBA")
boot_h = 300
boot_mascot = mascot.resize((round(mascot.width * boot_h / mascot.height), boot_h), Image.LANCZOS)
boot_mascot.save(theme / "mascot.png")
shell_mascot = mascot.resize((round(mascot.width * 520 / mascot.height), 520), Image.LANCZOS)
shell_mascot.save(shell_img / "mascot.png")

# --- woordmerk: naam met ruime letterafstand en zachte gloed ---
f = font(64)
spacing = 12
widths = [f.getbbox(c)[2] - f.getbbox(c)[0] for c in name]
text_w = sum(widths) + spacing * (len(name) - 1)
W, H = text_w + 80, 120
word = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(word)
asc = f.getbbox("R")
x, y = 40, (H - (asc[3] - asc[1])) // 2 - asc[1]
for c, w in zip(name, widths):
    d.text((x - f.getbbox(c)[0], y), c, font=f, fill=(255, 255, 255, 255))
    x += w + spacing
glow_txt = Image.new("RGBA", (W, H), rgb(color) + (0,))
glow_txt.putalpha(word.getchannel("A").filter(ImageFilter.GaussianBlur(10)).point(lambda a: a * 0.7))
wordmark = Image.alpha_composite(glow_txt, word)
wordmark.save(theme / "wordmark.png")

# --- zachte gloed achter de astronaut ---
gw, gh = 620, 620
glow = Image.new("RGBA", (gw, gh), (0, 0, 0, 0))
mask = Image.new("L", (gw, gh), 0)
ImageDraw.Draw(mask).ellipse([120, 120, gw - 120, gh - 120], fill=130)
mask = mask.filter(ImageFilter.GaussianBlur(70))
glow.paste(Image.new("RGBA", (gw, gh), rgb(color) + (255,)), (0, 0), mask)
glow.save(theme / "glow.png")

# --- laadbalk ---
Image.new("RGBA", (8, 8), (255, 255, 255, 255)).save(theme / "bar.png")

# oud logo opruimen
for old in ("logo.png",):
    (theme / old).unlink(missing_ok=True)

# --- preview voor jezelf (komt niet in het OS) ---
pv = Image.new("RGB", (1280, 720))
top, bot = (5, 23, 51), (0, 5, 18)
for yy in range(720):
    t = yy / 719
    ImageDraw.Draw(pv).line([(0, yy), (1280, yy)], fill=tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
cx, cy = 640, 300
pv.paste(glow, (cx - gw // 2, cy - gh // 2), glow)
pv.paste(boot_mascot, (cx - boot_mascot.width // 2, cy - boot_h // 2), boot_mascot)
wy = cy + boot_h // 2 + 18
pv.paste(wordmark, (cx - W // 2, wy), wordmark)
by = wy + H + 26
ImageDraw.Draw(pv).rectangle([520, by, 760, by + 2], fill=(40, 52, 80))
ImageDraw.Draw(pv).rectangle([520, by, 660, by + 2], fill=(235, 242, 255))
pv.save(root / "preview-opstartscherm.png")
print("Klaar")
