#!/usr/bin/env python3
import argparse
import os
from datetime import datetime

import cv2
import numpy as np

from wm_core import WMConfig, embed_watermark_bgr


def add_diagonal_text(img_bgr, text: str, *, alpha: float = 0.18, angle_deg: float = -35.0):
    if not text:
        return img_bgr
    h, w = img_bgr.shape[:2]
    overlay = img_bgr.copy()
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale = max(0.8, min(2.4, min(w, h) / 900.0))
    thickness = max(1, int(round(scale * 2)))
    color = (120, 120, 120)
    (tw, th), _ = cv2.getTextSize(text, font, scale, thickness)
    x = (w - tw) // 2
    y = (h + th) // 2
    cv2.putText(overlay, text, (x, y), font, scale, color, thickness, cv2.LINE_AA)
    M = cv2.getRotationMatrix2D((w / 2.0, h / 2.0), angle_deg, 1.0)
    rot = cv2.warpAffine(overlay, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    out = (img_bgr.astype("float32") * (1.0 - alpha) + rot.astype("float32") * alpha).clip(0, 255).astype("uint8")
    return out


def _mask_corners_for_marks(img_bgr: np.ndarray, mark_size: int, margin: int):
    """
    Carve out 4 corner holes so visible watermarks don't cover registration marks.
    Returns a masked copy of img_bgr (corners zeroed) and the list of corner rects.
    """
    h, w = img_bgr.shape[:2]
    s = mark_size
    m = margin
    mask = np.ones((h, w), dtype=np.uint8)
    rects = {
        "tl": (m, m, m + s, m + s),
        "tr": (w - s - m, m, w - m, m + s),
        "bl": (m, h - s - m, m + s, h - m),
        "br": (w - s - m, h - s - m, w - m, h - m),
    }
    for (x1, y1, x2, y2) in rects.values():
        mask[y1:y2, x1:x2] = 0
    masked = img_bgr.copy()
    masked[mask == 0] = 0
    return masked, rects


def add_tiled_diagonal_text(
    img_bgr, text: str, *, angle_deg: float = 45.0, alpha: float = 0.06,
    spacing_px: int = 72, color_gray: int = 180, font_scale: float = 0.5, thickness: int = 1,
    mark_size: int = 96, mark_margin: int = 12,
):
    """
    Dense repeating diagonal text (e.g. 'DLP Platform') at 45°, low opacity.
    Like reference wm.png: 斜45 水印, very light grid over whole page.
    Skips 4 corner regions (mark_size + margin) so blind-watermark corner marks remain clean.
    """
    if not text:
        return img_bgr
    h, w = img_bgr.shape[:2]
    diag = int(np.ceil(np.hypot(w, h)))
    pad = diag // 2 + max(spacing_px * 4, 200)
    cw, ch = w + 2 * pad, h + 2 * pad
    canvas = np.zeros((ch, cw, 3), dtype=np.uint8)
    canvas[:] = (128, 128, 128)
    font = cv2.FONT_HERSHEY_SIMPLEX
    (tw, th), _ = cv2.getTextSize(text, font, font_scale, thickness)
    step_x = max(tw + 24, spacing_px)
    step_y = max(th + 16, spacing_px // 2)
    color = (color_gray, color_gray, color_gray)
    for cy in range(0, ch + step_y, step_y):
        for cx in range(0, cw + step_x, step_x):
            cv2.putText(canvas, text, (cx, cy + th), font, font_scale, color, thickness, cv2.LINE_AA)
    M = cv2.getRotationMatrix2D((cw / 2.0, ch / 2.0), angle_deg, 1.0)
    rotated = cv2.warpAffine(canvas, M, (cw, ch), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    x0, y0 = pad, pad
    roi = rotated[y0 : y0 + h, x0 : x0 + w].astype(np.float32)

    # Carve corner holes in the tiled text layer so marks stay visible
    s = mark_size
    m = mark_margin
    corner_mask = np.ones((h, w), dtype=np.float32)
    for (x1, y1, x2, y2) in [
        (m,     m,     m + s, m + s),
        (w - s - m, m,     w - m, m + s),
        (m,     h - s - m, m + s, h - m),
        (w - s - m, h - s - m, w - m, h - m),
    ]:
        corner_mask[y1:y2, x1:x2] = 0.0

    roi = roi * corner_mask[:, :, np.newaxis]
    out = (
        img_bgr.astype(np.float32) * (1.0 - alpha)
        + roi.astype(np.float32) * alpha
    ).clip(0, 255).astype(np.uint8)
    return out


def add_footer_text(
    img_bgr, text: str, *, margin_x: int = 16, margin_y: int = 10,
    color=(80, 80, 80), font_scale: float = 0.4, thickness: int = 1,
):
    """Horizontal footer bottom-right (system footwatermark). e.g. Emp:EMP-101 | 2026-03-19 12:00:00"""
    if not text:
        return img_bgr
    h, w = img_bgr.shape[:2]
    font = cv2.FONT_HERSHEY_SIMPLEX
    (tw, th), _ = cv2.getTextSize(text, font, font_scale, thickness)
    x = w - tw - margin_x
    y = h - margin_y
    out = img_bgr.copy()
    cv2.putText(out, text, (x, y), font, font_scale, color, thickness, cv2.LINE_AA)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_path", required=True)
    ap.add_argument("--out", dest="out_path", required=True)
    ap.add_argument("--id", dest="wm_id", type=int, default=None, help="12-bit: (userid<<4)|time; optional if --userid and --time given")
    ap.add_argument("--userid", type=int, default=None, help="8-bit user id (0-255)")
    ap.add_argument("--time", type=int, default=None, help="4-bit time slot (0-15)")
    ap.add_argument("--profile", choices=["robust", "stealth"], default="stealth",
                    help="robust=stronger but more visible; stealth=less visible (recommended for demo)")
    ap.add_argument("--delta-y", type=float, default=None)
    ap.add_argument("--tile", type=int, default=32)
    ap.add_argument("--cell", type=int, default=12)
    ap.add_argument("--blur-sigma", type=float, default=None, help="Payload blur to reduce visibility (stealth)")
    ap.add_argument("--mark-delta-y", type=float, default=None)
    ap.add_argument("--diag-text", default="", help="Large central diagonal text (e.g. CONFIDENTIAL)")
    ap.add_argument("--diag-alpha", type=float, default=None)
    ap.add_argument("--diag-angle", type=float, default=-35.0)
    ap.add_argument("--tiled-text", default="", help="Dense 45° repeating text (e.g. DLP Platform), like wm.png")
    ap.add_argument("--tiled-alpha", type=float, default=None, help="Opacity of tiled diagonal (default by profile)")
    ap.add_argument("--footer", default="", help="Footer text; use {userid} {time} {ts}; empty = auto Emp:EMP-{userid} | {ts}")
    ap.add_argument("--blind-only", action="store_true", default=False, help="Embed blind watermark ONLY, skip visible layers (tiled text, diagonal, footer)")
    args = ap.parse_args()

    img = cv2.imread(args.in_path, cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"Failed to read: {args.in_path}")

    if args.userid is not None and args.time is not None:
        wm_id = ((int(args.userid) & 0xFF) << 4) | (int(args.time) & 0xF)
    elif args.wm_id is not None:
        wm_id = int(args.wm_id) & 0xFFF
    else:
        raise SystemExit("Provide either --id or both --userid and --time")
    # Profile defaults (can be overridden by explicit args)
    if args.profile == "robust":
        delta_y = 35.0
        mark_delta_y = 40.0
        blur_sigma = 0.0
        diag_alpha = 0.12
        tiled_alpha = 0.08
    else:  # stealth: 不太明顯, like wm.png
        delta_y = 10.0
        mark_delta_y = 18.0
        blur_sigma = 0.7
        diag_alpha = 0.05
        tiled_alpha = 0.06

    if args.delta_y is not None:
        delta_y = float(args.delta_y)
    if args.mark_delta_y is not None:
        mark_delta_y = float(args.mark_delta_y)
    if args.blur_sigma is not None:
        blur_sigma = float(args.blur_sigma)
    if args.diag_alpha is not None:
        diag_alpha = float(args.diag_alpha)
    if args.tiled_alpha is not None:
        tiled_alpha = float(args.tiled_alpha)

    cfg = WMConfig(
        tile_size=args.tile,
        cell_px=args.cell,
        delta_y=delta_y,
        mark_delta_y=mark_delta_y,
        blur_sigma=blur_sigma,
    )
    out, meta = embed_watermark_bgr(img, wm_id, cfg)
    
    # Order: blind is already in out; then subtle visible layers (like wm.png)
    # Note: visible watermark layers can interfere with blind watermark extraction.
    # Use --blind-only for DLP Platform integration where visible watermark is applied separately.
    if not args.blind_only:
        if args.tiled_text:
            out = add_tiled_diagonal_text(
                out, args.tiled_text,
                angle_deg=45.0, alpha=float(tiled_alpha),
                spacing_px=72, color_gray=180, font_scale=0.5,
            )
        out = add_diagonal_text(out, args.diag_text, alpha=float(diag_alpha), angle_deg=float(args.diag_angle))
        # System footer (Emp:EMP-xxx | timestamp)
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        userid = (wm_id >> 4) & 0xFF
        time_slot = wm_id & 0xF
        if args.footer:
            footer_text = args.footer.replace("{userid}", str(userid)).replace("{time}", str(time_slot)).replace("{ts}", ts)
        else:
            footer_text = f"Emp:EMP-{userid} | {ts}"
        out = add_footer_text(out, footer_text)

    os.makedirs(os.path.dirname(args.out_path) or ".", exist_ok=True)
    ok = cv2.imwrite(args.out_path, out)
    if not ok:
        raise SystemExit(f"Failed to write: {args.out_path}")
    print("OK")
    print("out:", os.path.abspath(args.out_path))
    print("wm_id:", wm_id, "-> userid:", (wm_id >> 4) & 0xFF, "time:", wm_id & 0xF)


if __name__ == "__main__":
    main()

