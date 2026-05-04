#!/usr/bin/env python3
"""
Demo: Invisible watermark WITHOUT registration marks.
- Dynamic watermark: DLP Platform diagonal + Emp/Date footer
- Invisible watermark: s2c BPSK in Y channel (no corner marks)

Encode -> Decode shows it works without corner marks.
"""
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.dirname(__file__))

import cv2
import numpy as np
from wm_core import (
    WMConfig, embed_watermark_bgr_no_reg, decode_from_image_no_reg,
    TILE_PX, PAYLOAD_BITS, build_payload_from_id, check_and_extract_id
)

def apply_dynamic_watermark(src_path: str, out_path: str, emp_no: str, timestamp: str):
    """Apply dynamic watermark using PIL (simplified from apply_watermark.py)."""
    from PIL import Image, ImageDraw, ImageFont

    img = Image.open(src_path).convert("RGB")
    draw = ImageDraw.Draw(img)

    # Try to get font
    font_size = 48
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        font = ImageFont.load_default()

    W, H = img.size
    # Diagonal watermark
    text = "DLP Platform"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]

    # Tile diagonally
    spacing = int(max(tw, th) * 1.5)
    angle = 45
    import math
    diagonal = math.hypot(W, H)

    overlay = Image.new("RGBA", (int(diagonal), int(diagonal)), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for y in range(0, int(diagonal), spacing):
        for x in range(0, int(diagonal), spacing):
            od.text((x, y), text, font=font, fill=(255, 255, 255, 100))

    overlay = overlay.rotate(angle, expand=True)
    ox, oy = (diagonal - W) / 2, (diagonal - H) / 2
    ox2, oy2 = (diagonal + W) / 2, (diagonal + H) / 2
    cropped = overlay.crop((ox, oy, ox2, oy2))
    img.paste(cropped, (0, 0), cropped)

    # Footer: Emp + Date
    footer_text = f"Emp:{emp_no} | {timestamp}"
    footer_size = 24
    try:
        footer_font = ImageFont.truetype("arial.ttf", footer_size)
    except:
        footer_font = ImageFont.load_default()

    fbbox = draw.textbbox((0, 0), footer_text, font=footer_font)
    fw, fh = fbbox[2] - fbbox[0], fbbox[3] - fbbox[1]
    pad = 10
    draw.rectangle([W - fw - pad * 2, H - fh - pad * 2, W, H], fill=(255, 255, 255, 220))
    draw.text((W - fw - pad, H - fh - pad), footer_text, font=footer_font, fill=(80, 80, 80))

    img.save(out_path)

def demo_no_reg():
    # 1. Load original image
    src = r"..\..\docs\llm-test-samples\images\sample_confidential_0421.png"
    out_path = r"..\..\docs\llm-test-samples\images\no_reg_sample.png"
    img = cv2.imread(src)
    if img is None:
        print(f"ERROR: cannot load {src}")
        return

    # 2. Apply dynamic watermark first (PIL-based, matches backend style)
    apply_dynamic_watermark(src, out_path, emp_no="EMP-290", timestamp="2026-02-22 22:39:52")

    # 3. Reload and embed invisible BPSK watermark (no reg marks)
    cfg = WMConfig(delta_y=0.8)  # low enough to be invisible
    wm_id = (290 << 4) | 3       # userid=290, time=3

    base_with_dyn = cv2.imread(out_path)
    wm_final, meta = embed_watermark_bgr_no_reg(base_with_dyn, wm_id, cfg)

    # 4. Save
    cv2.imwrite(out_path, wm_final)
    print(f"Saved: {out_path}")

    # 5. Decode (no registration marks needed)
    crc_ok, userid, time_val, bits = decode_from_image_no_reg(
        wm_final, cfg, tile_px=TILE_PX
    )
    print(f"\n=== Decode Result ===")
    print(f"CRC OK: {crc_ok}")
    print(f"User ID: {userid} (expected 290)")
    print(f"Time:    {time_val} (expected 3)")
    print(f"Bits:    {''.join(str(b) for b in bits)}")
    print(f"Full ID: userid={userid}, time={time_val}")

    # 6. Visual check: show Y channel diff
    y_orig = cv2.cvtColor(img, cv2.COLOR_BGR2YUV)[:,:,0].astype(float)
    y_wm   = cv2.cvtColor(wm_final, cv2.COLOR_BGR2YUV)[:,:,0].astype(float)
    diff = np.abs(y_wm - y_orig)
    print(f"\nY-channel max diff: {diff.max():.2f} (should be < 3 for invisible)")
    print(f"Y-channel mean diff: {diff.mean():.4f}")


if __name__ == "__main__":
    demo_no_reg()
