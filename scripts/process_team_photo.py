#!/usr/bin/env python3
"""Crop, zoom, and enhance the Ronnie & Annie photo for the Meet the Team block.

Source:  images/IMG_6434.jpeg  (full frame, couple is small in lower-right)
Output:  images/ronnie-annie.jpg  (zoomed portrait, sharpened, web-sized)
"""
from PIL import Image, ImageEnhance, ImageFilter
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "images" / "IMG_6434.jpeg"
DST = Path(__file__).resolve().parent.parent / "images" / "ronnie-annie.jpg"

im = Image.open(SRC).convert("RGB")
W, H = im.size  # 828 x 1316

# Couple stands in the lower-right of the frame in front of the clubhouse.
# Crop to a ~3:4 portrait that keeps the clubhouse and flag visible above them
# while making the couple the visual anchor.
# Roughly: pull in from the left to remove dead grass, drop the very top of the
# sky, and keep the flagpole + clubhouse for context.
left   = int(W * 0.10)
right  = int(W * 0.96)
top    = int(H * 0.18)
bottom = int(H * 0.99)
im = im.crop((left, top, right, bottom))

# Upscale slightly so the final image renders crisply on retina displays.
target_w = 1100
ratio = target_w / im.width
im = im.resize((target_w, int(im.height * ratio)), Image.LANCZOS)

# Enhancement pass: gentle, not soap-opera.
im = im.filter(ImageFilter.UnsharpMask(radius=1.4, percent=130, threshold=3))
im = ImageEnhance.Contrast(im).enhance(1.08)
im = ImageEnhance.Color(im).enhance(1.06)
im = ImageEnhance.Sharpness(im).enhance(1.25)

im.save(DST, "JPEG", quality=88, optimize=True, progressive=True)
print(f"Wrote {DST} — {DST.stat().st_size} bytes, size {im.size}")
