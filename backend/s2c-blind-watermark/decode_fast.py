#!/usr/bin/env python3
"""
Fast targeted decode: uses image dimensions to estimate exact tile_px.
Runs denoising + raw decode with coarse grid, then fine-tunes best candidates.
"""
import cv2
import numpy as np
from collections import Counter
from numpy.fft import fft2, fftshift, ifftshift

from wm_core import WMConfig, decode_from_warped, TILE_PX, check_and_extract_id
from embed import add_tiled_diagonal_text


def render_visible_pattern(gray, text="DLP Platform", angle_deg=45.0,
                           spacing_px=72, alpha=0.06, font_scale=0.5, color_gray=180):
    h, w = gray.shape
    font = cv2.FONT_HERSHEY_SIMPLEX
    thickness = 1
    (tw, th), _ = cv2.getTextSize(text, font, font_scale, thickness)
    row_step = max(th, spacing_px)
    col_step = max(tw + 20, spacing_px * 2)
    diag = int(np.ceil(np.hypot(w, h) + max(tw, th) * 2))
    pad = diag // 2 + tw * 2
    cw, ch = w + pad * 2, h + pad * 2
    tmp = np.full((ch, cw), fill_value=128, dtype=np.float32)
    (tw2, th2), _ = cv2.getTextSize(text, font, font_scale, thickness)
    baseline_y = th2
    n_rows = int(np.ceil(ch / row_step)) + 4
    for r in range(-n_rows, n_rows * 2):
        row_x = r * col_step
        for col_off in [0, col_step // 2]:
            px = int(round(row_x + col_off)) + pad
            py = int(round(r * row_step)) + pad
            if -tw2 - pad < (px - pad) < cw + tw2 and -baseline_y - pad < (py - pad) < ch + baseline_y:
                cv2.putText(tmp, text, (int(px), int(py)), font, font_scale,
                            int(color_gray), thickness, cv2.LINE_AA)
    M = cv2.getRotationMatrix2D((cw / 2, ch / 2), angle_deg, 1.0)
    rot = cv2.warpAffine(tmp, M, (cw, ch), flags=cv2.INTER_LINEAR, borderValue=128)
    x0, y0 = (cw - w) // 2, (ch - h) // 2
    rendered = rot[y0:y0 + h, x0:x0 + w].astype(np.float32)
    pattern = rendered - 128.0
    contribution = alpha * (color_gray - 128)
    pattern = pattern * (contribution / max(np.std(pattern), 1e-6))
    return pattern


def denoise_visible(gray, text="DLP Platform", angle_deg=45.0, spacing_px=72,
                    alpha=0.06, font_scale=0.5, color_gray=180):
    g = gray.astype(np.float32)
    pattern = render_visible_pattern(gray, text, angle_deg, spacing_px, alpha, font_scale, color_gray)
    residual = g - pattern
    # Low-pass filter to also remove some high-freq noise
    lp = cv2.GaussianBlur(g, (0, 0), sigmaX=3.0)
    return (residual * 0.7 + lp * 0.3).astype(np.uint8)


def fast_decode(gray, cfg, tile_px_override, k_candidates=None, denoised_img=None):
    """Decode with optional pre-denoised image."""
    target = denoised_img if denoised_img is not None else gray
    return decode_from_warped(target, cfg, tile_px_override=tile_px_override,
                               tta_phases=5, k_size_candidates=k_candidates or (0, 21, 51, 101))


def estimate_tile_px_from_image(h, w, base_tile=TILE_PX):
    """Estimate tile_px from image dimensions. Returns (scale, tile_px, quality) tuples."""
    candidates = []
    # For each dimension, compute how many tiles fit
    for dim, dim_name in [(h, "height"), (w, "width")]:
        for n_tiles in [1, 2, 3, 4, 5, 6, 7, 8]:
            tp = dim // n_tiles
            if tp < 16:
                break
            sc = tp / base_tile
            quality = n_tiles  # more tiles = more votes = better
            candidates.append((sc, tp, quality))
    # Also try: scale directly
    for sc in np.arange(0.1, 6.0, 0.05):
        tp = int(round(base_tile * sc))
        if tp < 16:
            continue
        n_tiles_h = h // tp
        n_tiles_w = w // tp
        if n_tiles_h >= 1 and n_tiles_w >= 1:
            quality = n_tiles_h * n_tiles_w
            candidates.append((sc, tp, quality))
    return sorted(candidates, key=lambda x: -x[2])  # best quality first


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="in_path", required=True)
    parser.add_argument("--tile", type=int, default=32)
    parser.add_argument("--cell", type=int, default=12)
    parser.add_argument("--wm-text", default="DLP Platform")
    parser.add_argument("--wm-angle", type=float, default=45.0)
    parser.add_argument("--wm-spacing", type=int, default=72)
    parser.add_argument("--wm-alpha", type=float, default=0.06)
    args = parser.parse_args()

    img = cv2.imread(args.in_path, cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"Failed: {args.in_path}")
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    print(f"Image: {w}x{h}", flush=True)

    cfg = WMConfig(tile_size=args.tile, cell_px=args.cell)
    candidates = estimate_tile_px_from_image(h, w)
    print(f"Tile candidates: {len(candidates)}", flush=True)

    # Pre-compute denoised
    print("Denoising visible watermark...", flush=True)
    denoised = denoise_visible(gray, text=args.wm_text, angle_deg=args.wm_angle,
                                spacing_px=args.wm_spacing, alpha=args.wm_alpha)
    print("Done.", flush=True)

    k_candidates = (0, 21, 51, 101, 201, 401)

    all_raw = []
    all_denoise = []

    # Try top 20 tile_px candidates by quality
    top_candidates = candidates[:20]
    print(f"Trying {len(top_candidates)} best tile_px candidates...", flush=True)

    for i, (sc, tp, quality) in enumerate(top_candidates):
        print(f"  [{i+1}/{len(top_candidates)}] sc={sc:.3f} tile_px={tp} quality={quality}", flush=True)

        # Raw
        crc_ok, uid, tval, bits = fast_decode(gray, cfg, tp, k_candidates)
        if crc_ok:
            wm_id = ((uid & 0xFF) << 4) | (tval & 0xF)
            all_raw.append((sc, tp, uid, tval, wm_id, bits.tolist()))
            print(f"    [RAW] OK uid={uid} t={tval} wm_id={wm_id}", flush=True)

        # Denoised
        crc_ok, uid, tval, bits = fast_decode(gray, cfg, tp, k_candidates, denoised)
        if crc_ok:
            wm_id = ((uid & 0xFF) << 4) | (tval & 0xF)
            all_denoise.append((sc, tp, uid, tval, wm_id, bits.tolist()))
            print(f"    [DEN] OK uid={uid} t={tval} wm_id={wm_id}", flush=True)

    print(f"\nRaw OK: {len(all_raw)}, Denoise OK: {len(all_denoise)}", flush=True)

    for label, results in [("RAW", all_raw), ("DEN", all_denoise)]:
        if not results:
            continue
        votes = Counter((u, t) for _, _, u, t, _, _ in results)
        top = votes.most_common(5)
        best_pair = top[0][0]
        best_uid, best_tval = best_pair
        best_sc = None
        best_bits = None
        best_results = [(sc, bits) for sc, tp, uid, tval, wmid, bits in results
                       if uid == best_uid and tval == best_tval]
        if best_results:
            best_results.sort(key=lambda x: abs(x[0] - 1.0))
            best_sc, best_bits = best_results[0]
        wm_id = ((best_uid & 0xFF) << 4) | (best_tval & 0xF)
        print(f"\n{label} BEST: uid={best_uid} t={best_tval} wm_id={wm_id} sc={best_sc}")
        if best_bits:
            print(f"  Bits: {''.join(str(int(b)) for b in best_bits)}")
        print(f"  Top votes: {top[:5]}")


if __name__ == "__main__":
    main()
