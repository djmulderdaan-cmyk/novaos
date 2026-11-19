"""Maakt de afbeeldingen voor het opstartscherm.

Gebruik:  python tools/make_logo.py "NovaOS" "#7fb8ff"
Wil je een eigen logo? Zet dan zelf een logo.png (transparante achtergrond,
max ~600px breed) in files/system/usr/share/plymouth/themes/novaos/.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

name = sys.argv[1] if len(sys.argv) > 1 else "NovaOS"
color = sys.argv[2] if len(sys.argv) > 2 else "#7fb8ff"
out = Path(__file__).resolve().parent.parent / "files/system/usr/share/plymouth/themes/novaos"
out.mkdir(parents=True, exist_ok=True)


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


# --- logo: ring-icoon + naam met ruime letterafstand ---
f = font(84)
spacing = 14
widths = [f.getbbox(c)[2] - f.getbbox(c)[0] if c != " " else 30 for c in name]
text_w = sum(widths) + spacing * (len(name) - 1)
ring = 92
gap = 34
W = ring + gap + text_w + 40
H = 150
logo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(logo)

# ring met puntje (een "planeet")
rx, ry = 20, (H - ring) // 2
d.ellipse([rx, ry, rx + ring, ry + ring], outline=rgb(color) + (255,), width=7)
dot = 20
d.ellipse([rx + ring - dot + 4, ry - 2, rx + ring + 4, ry + dot - 2], fill=(255, 255, 255, 255))

x = rx + ring + gap
asc = f.getbbox("N")
y = (H - (asc[3] - asc[1])) // 2 - asc[1]
for c, w in zip(name, widths):
    if c != " ":
        d.text((x - f.getbbox(c)[0], y), c, font=f, fill=(255, 255, 255, 255))
    x += w + spacing
logo.save(out / "logo.png")

# --- zachte gloed achter het logo ---
gw, gh = W + 260, H + 260
glow = Image.new("RGBA", (gw, gh), (0, 0, 0, 0))
mask = Image.new("L", (gw, gh), 0)
ImageDraw.Draw(mask).ellipse([90, 100, gw - 90, gh - 100], fill=150)
mask = mask.filter(ImageFilter.GaussianBlur(55))
glow.paste(Image.new("RGBA", (gw, gh), rgb(color) + (255,)), (0, 0), mask)
glow.save(out / "glow.png")

# --- laadbalk (wit blokje, wordt geschaald in het script) ---
Image.new("RGBA", (8, 8), (255, 255, 255, 255)).save(out / "bar.png")

# --- preview voor jezelf (komt niet in het OS) ---
pv = Image.new("RGB", (1280, 720), (5, 8, 23))
pv.paste(glow, ((1280 - gw) // 2, (720 - gh) // 2), glow)
pv.paste(logo, ((1280 - W) // 2, (720 - H) // 2), logo)
bar_y = (720 + H) // 2 + 60
ImageDraw.Draw(pv).rectangle([520, bar_y, 760, bar_y + 2], fill=(40, 44, 60))
ImageDraw.Draw(pv).rectangle([520, bar_y, 660, bar_y + 2], fill=(230, 235, 245))
pv.save(Path(__file__).resolve().parent.parent / "preview-opstartscherm.png")
print("Klaar:", out)
