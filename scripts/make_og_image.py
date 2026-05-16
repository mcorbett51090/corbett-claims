#!/usr/bin/env python3
"""Generate a 1200x630 social-preview logo PNG matching the site's text logo.

Uses Montserrat Black for "CORBETT" and Playfair Display Bold Italic for
"Claims" (overlapped slightly onto CORBETT for a layered logo feel).
Font files are vendored in scripts/fonts/ so the script is reproducible.
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FONTS = ROOT / "fonts"

W, H = 1200, 630
PRIMARY = (30, 58, 95)
PRIMARY_DARK = (15, 39, 68)
WHITE = (255, 255, 255)

# Diagonal gradient background
img = Image.new("RGB", (W, H), PRIMARY)
draw = ImageDraw.Draw(img)
for y in range(H):
    t = y / (H - 1)
    r = int(PRIMARY[0] * (1 - t) + PRIMARY_DARK[0] * t)
    g = int(PRIMARY[1] * (1 - t) + PRIMARY_DARK[1] * t)
    b = int(PRIMARY[2] * (1 - t) + PRIMARY_DARK[2] * t)
    draw.line([(0, y), (W, y)], fill=(r, g, b))

def load_font(name, size, fallback):
    p = FONTS / name
    if p.exists():
        return ImageFont.truetype(str(p), size)
    return ImageFont.truetype(fallback, size)

DEJAVU_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
DEJAVU_SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"

corbett_font = load_font("Montserrat-Black.ttf", 170, DEJAVU_BOLD)
claims_font  = load_font("PlayfairDisplay-BoldItalic.ttf", 160, DEJAVU_SERIF)
tag_font     = load_font("Montserrat-Black.ttf", 26, DEJAVU_BOLD)

corbett = "CORBETT"
claims = "Claims"
tag = "AUTO  COLLISION    •    INSURANCE  CLAIMS    •    BATON  ROUGE,  LA"

def size(text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1], bbox[1]

cw, ch, c_top = size(corbett, corbett_font)
lw, lh, l_top = size(claims, claims_font)
tw, th, _    = size(tag, tag_font)

# Letter-spacing on CORBETT for a poster-like feel
tracking = 6
corbett_total_w = cw + tracking * (len(corbett) - 1)

# Vertical layout: overlap "Claims" upward into the bottom of CORBETT
overlap = 55
divider_gap = 40
tag_gap = 36
divider_w = 240

block_h = ch + lh - overlap + divider_gap + 4 + tag_gap + th
y_start = (H - block_h) // 2

# Subtle drop shadow on CORBETT
def draw_tracked(x, y, text, font, fill):
    for ch_ in text:
        bbox = draw.textbbox((0, 0), ch_, font=font)
        gw = bbox[2] - bbox[0]
        draw.text((x, y), ch_, font=font, fill=fill)
        x += gw + tracking

shadow_offset = 4
draw_tracked((W - corbett_total_w) // 2 + shadow_offset, y_start - c_top + shadow_offset,
             corbett, corbett_font, (0, 0, 0, 60))
draw_tracked((W - corbett_total_w) // 2, y_start - c_top,
             corbett, corbett_font, WHITE)

# Render "Claims" on a transparent layer so we can overlap and add a soft shadow
pad = 60
claims_layer = Image.new("RGBA", (lw + pad * 2, lh + pad * 2), (0, 0, 0, 0))
cdraw = ImageDraw.Draw(claims_layer)
cdraw.text((pad, pad - l_top), claims, font=claims_font, fill=(0, 0, 0, 90))   # shadow
cdraw.text((pad - 4, pad - l_top - 4), claims, font=claims_font, fill=WHITE)   # main

claims_x = (W - claims_layer.width) // 2
claims_y = y_start + ch - overlap - pad
img.paste(claims_layer, (claims_x, claims_y), claims_layer)

# Divider + tagline
divider_y = y_start + ch + lh - overlap + divider_gap
draw.line(
    [(W // 2 - divider_w // 2, divider_y), (W // 2 + divider_w // 2, divider_y)],
    fill=WHITE, width=2,
)
draw.text(((W - tw) // 2, divider_y + tag_gap),
          tag, font=tag_font, fill=(220, 230, 245))

out = ROOT.parent / "images" / "og-logo.png"
img.save(out, "PNG", optimize=True)
print(f"Wrote {out} ({out.stat().st_size} bytes)")
