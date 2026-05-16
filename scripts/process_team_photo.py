#!/usr/bin/env python3
"""Crop the Ronnie & Annie photo to a LinkedIn-style head-and-shoulders frame.

Source:  images/IMG_6434.jpeg  (full frame, couple is small in lower-right)
Output:  images/ronnie-annie.jpg  (tight upper-body crop, denoised+sharpened)

The original is a phone photo taken from far away — the couple occupies a
small portion of the frame, so straight cropping leaves visible JPEG noise
and pixelation. This script crops to just their upper bodies, then runs a
denoise → upscale → unsharp-mask pipeline to recover apparent detail.
"""
from PIL import Image, ImageEnhance, ImageFilter
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "images" / "IMG_6434.jpeg"
DST = Path(__file__).resolve().parent.parent / "images" / "ronnie-annie.jpg"

im = Image.open(SRC).convert("RGB")
W, H = im.size  # 828 x 1316

# Empirically-tuned crop box around their heads + shoulders.
# Crop is centered on the midpoint *between* Ronnie and Annie so neither
# of them dominates the frame — measured midpoint sits at ~0.78W in the
# original 828x1316 source.
left   = int(W * 0.625)
right  = int(W * 0.940)
top    = int(H * 0.504)
bottom = int(H * 0.700)
crop = im.crop((left, top, right, bottom))
cw, ch = crop.size

# 1) Denoise on the small crop (smooths blocky JPEG artifacts).
crop = crop.filter(ImageFilter.MedianFilter(size=3))

# 2) Upscale 3x with LANCZOS for a high-DPI source.
target_w = cw * 3
target_h = ch * 3
crop = crop.resize((target_w, target_h), Image.LANCZOS)

# 3) Two-stage unsharp mask: broad first to recover structure,
#    then a finer pass for edge crispness.
crop = crop.filter(ImageFilter.UnsharpMask(radius=2.6, percent=130, threshold=2))
crop = crop.filter(ImageFilter.UnsharpMask(radius=1.0, percent=80,  threshold=1))

# 4) Gentle tonal pass.
crop = ImageEnhance.Contrast(crop).enhance(1.10)
crop = ImageEnhance.Color(crop).enhance(1.08)
crop = ImageEnhance.Sharpness(crop).enhance(1.20)

# 5) Resize down to web-friendly square-ish dimensions (will be displayed
#    inside a ~160px round avatar, so 600px is plenty even on retina).
final_size = 600
side = min(crop.size)
# Center-crop to square (the source crop is close to 1:1 already).
left2 = (crop.width - side) // 2
top2 = (crop.height - side) // 2
crop = crop.crop((left2, top2, left2 + side, top2 + side))
crop = crop.resize((final_size, final_size), Image.LANCZOS)

crop.save(DST, "JPEG", quality=90, optimize=True, progressive=True)
print(f"Wrote {DST} — {DST.stat().st_size} bytes, size {crop.size}")
