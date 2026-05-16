#!/usr/bin/env python3
"""Generate a 1200x630 social-preview logo PNG matching the site's text logo."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

W, H = 1200, 630
PRIMARY = (30, 58, 95)
PRIMARY_DARK = (15, 39, 68)
WHITE = (255, 255, 255)

img = Image.new("RGB", (W, H), PRIMARY)

# Diagonal gradient PRIMARY -> PRIMARY_DARK
draw = ImageDraw.Draw(img)
for y in range(H):
    t = y / (H - 1)
    r = int(PRIMARY[0] * (1 - t) + PRIMARY_DARK[0] * t)
    g = int(PRIMARY[1] * (1 - t) + PRIMARY_DARK[1] * t)
    b = int(PRIMARY[2] * (1 - t) + PRIMARY_DARK[2] * t)
    draw.line([(0, y), (W, y)], fill=(r, g, b))

sans_bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
serif_bold = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"

corbett_font = ImageFont.truetype(sans_bold, 150)
claims_font = ImageFont.truetype(serif_bold, 120)
tag_font = ImageFont.truetype(sans_bold, 28)

def text_size(text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]

corbett = "CORBETT"
claims = "Claims"
tag = "AUTO COLLISION  •  INSURANCE CLAIMS  •  BATON ROUGE, LA"

cw, ch = text_size(corbett, corbett_font)
lw, lh = text_size(claims, claims_font)
tw, th = text_size(tag, tag_font)

gap = 20
divider_pad = 50
tag_pad = 50
block_h = ch + gap + lh + divider_pad + tag_pad + th
y_start = (H - block_h) // 2

# Render "Claims" onto its own transparent layer and shear it into italic
claims_layer = Image.new("RGBA", (lw + 200, lh + 80), (0, 0, 0, 0))
ImageDraw.Draw(claims_layer).text((50, 20), claims, font=claims_font, fill=WHITE)
claims_layer = claims_layer.transform(
    claims_layer.size,
    Image.AFFINE,
    (1, -0.22, 0, 0, 1, 0),
    resample=Image.BICUBIC,
)

draw.text(((W - cw) // 2, y_start), corbett, font=corbett_font, fill=WHITE)
img.paste(claims_layer, ((W - claims_layer.width) // 2, y_start + ch + gap - 20), claims_layer)

divider_y = y_start + ch + gap + lh + divider_pad
draw.line([(W // 2 - 200, divider_y), (W // 2 + 200, divider_y)],
          fill=(255, 255, 255), width=2)

draw.text(((W - tw) // 2, divider_y + tag_pad), tag, font=tag_font, fill=(220, 230, 245))

out = Path(__file__).resolve().parent.parent / "images" / "og-logo.png"
img.save(out, "PNG", optimize=True)
print(f"Wrote {out} ({out.stat().st_size} bytes)")
