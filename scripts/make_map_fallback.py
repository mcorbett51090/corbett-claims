#!/usr/bin/env python3
"""Generate a static service-area fallback PNG for the <noscript> path."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

W, H = 1200, 700
PRIMARY = (30, 58, 95)
PRIMARY_DARK = (15, 39, 68)
ACCENT = (59, 130, 246)
WHITE = (255, 255, 255)
SOFT = (243, 244, 246)

img = Image.new("RGB", (W, H), SOFT)
draw = ImageDraw.Draw(img)

sans_bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
sans = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

title_font = ImageFont.truetype(sans_bold, 56)
state_font = ImageFont.truetype(sans_bold, 38)
hint_font = ImageFont.truetype(sans, 24)
pin_font = ImageFont.truetype(sans_bold, 28)

draw.rectangle([0, 0, W, 110], fill=PRIMARY)

def center_text(text, font, y, fill=WHITE):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, y), text, font=font, fill=fill)

center_text("Service Area", title_font, 26)

# State badges arranged in a row
states = [
    ("Texas", "TX"),
    ("Louisiana", "LA"),
    ("Mississippi", "MS"),
    ("Alabama", "AL"),
    ("Florida", "FL"),
]

card_w, card_h = 180, 180
gap = 28
total_w = card_w * len(states) + gap * (len(states) - 1)
x_start = (W - total_w) // 2
y_cards = 200

for i, (name, abbr) in enumerate(states):
    x = x_start + i * (card_w + gap)
    draw.rounded_rectangle([x, y_cards, x + card_w, y_cards + card_h],
                           radius=20, fill=WHITE, outline=ACCENT, width=3)
    abbr_bbox = draw.textbbox((0, 0), abbr, font=title_font)
    aw, ah = abbr_bbox[2] - abbr_bbox[0], abbr_bbox[3] - abbr_bbox[1]
    draw.text((x + (card_w - aw) // 2, y_cards + 38), abbr, font=title_font, fill=PRIMARY)
    name_bbox = draw.textbbox((0, 0), name, font=hint_font)
    nw = name_bbox[2] - name_bbox[0]
    draw.text((x + (card_w - nw) // 2, y_cards + 120), name, font=hint_font, fill=PRIMARY_DARK)

# HQ banner
banner_y = 460
draw.rounded_rectangle([100, banner_y, W - 100, banner_y + 90],
                       radius=16, fill=PRIMARY)
center_text("📍  Headquarters: Baton Rouge, Louisiana", pin_font, banner_y + 30, fill=WHITE)

# Footer copy
center_text("We proudly serve clients across the Southeast", state_font, 590, fill=PRIMARY_DARK)
center_text("Call (225) 663-2217 for a free estimate", hint_font, 650, fill=(75, 85, 99))

out = Path(__file__).resolve().parent.parent / "images" / "southeast_us_gis_map.png"
img.save(out, "PNG", optimize=True)
print(f"Wrote {out} ({out.stat().st_size} bytes)")
