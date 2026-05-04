#!/usr/bin/env python3
"""
No-registration blind decode for s2c_blind_wm with visible watermark denoising.

Works by:
  1. Denoise: subtract the 45-deg tiled visible watermark pattern from the image.
     This uses a frequency-domain mask to target only the text interference band.
  2. Brute-force tile size / offset / kernel across the whole image, check CRC.

Usage:
  python decode_no_reg.py --in photo.jpg [--tile 32] [--cell 12]
                          [--wm-text "DLP Platform"] [--wm-angle 45]
                          [--wm-spacing 72] [--wm-alpha 0.06]
"""
import argparse
import cv2
import numpy as np
from collections import Counter
from numpy.fft import fft2, fftshift, ifftshift

from wm_core import (
    WMConfig,
    TILE_PX,
    build_payload_from_id,
    check_and_extract_id,
    decode_from_warped,
)


def render_visible_watermark_pattern(
    gray: np.ndarray,
    text: str = "DLP Platform",
    angle_deg: float = 45.0,
    spacing_px: int = 72,
    alpha: float = 0.06,
    font_scale: float = 0.5,
    color_gray: int = 180,
) -> np.ndarray:
    """
    Render the 45-deg tiled watermark text pattern at the center of the image.
    Returns a floating-point pattern (0-centered) suitable for subtraction.
    """
    h, w = gray.shape
    vis = np.full((h, w), fill_value=128, dtype=np.float32)

    font = cv2.FONT_HERSHEY_SIMPLEX
    thickness = 1

    angle_rad = np.deg2rad(angle_deg)
    cos_a, sin_a = np.cos(angle_rad), np.sin(angle_rad)

    # Text size estimate
    (tw, th), _ = cv2.getTextSize(text, font, font_scale, thickness)
    row_step = max(th, spacing_px)
    col_step = max(tw + 20, spacing_px * 2)

    # How many rows to cover the image diagonally?
    diag = int(np.ceil(np.hypot(w, h) + max(tw, th) * 2))
    pad = diag // 2 + tw * 2
    cw, ch = w + pad * 2, h + pad * 2

    # Build on temp canvas
    tmp = np.full((ch, cw), fill_value=128, dtype=np.float32)
    (tw2, th2), _ = cv2.getTextSize(text, font, font_scale, thickness)
    baseline_y = th2  # y offset from text top to baseline

    # Rows of text needed
    n_rows = int(np.ceil(ch / row_step)) + 4
    for r in range(-n_rows, n_rows * 2):
        row_x = r * col_step
        for col_off in [0, col_step // 2]:  # stagger
            px = int(round(row_x + col_off))
            py = int(round(r * row_step))
            px += pad
            py += pad
            if -tw2 - pad < px < cw + tw2 and -baseline_y - pad < py < ch + baseline_y:
                cv2.putText(tmp, text, (int(px), int(py)), font, font_scale,
                            int(color_gray), thickness, cv2.LINE_AA)

    # Rotate to match the image angle
    M = cv2.getRotationMatrix2D((cw / 2, ch / 2), angle_deg, 1.0)
    rot = cv2.warpAffine(tmp, M, (cw, ch),
                          flags=cv2.INTER_LINEAR,
                          borderValue=128)

    # Extract the center region matching the original image
    x0 = (cw - w) // 2
    y0 = (ch - h) // 2
    rendered = rot[y0:y0 + h, x0:x0 + w].astype(np.float32)

    # Center at 0: positive = watermark pixels, negative = background
    pattern = rendered - 128.0
    # Scale to match actual contribution: alpha * color_range
    contribution = alpha * (color_gray - 128)
    pattern = pattern * (contribution / max(np.std(pattern), 1e-6))

    return pattern


def denoise_visible_watermark(
    gray: np.ndarray,
    text: str = "DLP Platform",
    angle_deg: float = 45.0,
    spacing_px: int = 72,
    alpha: float = 0.06,
    font_scale: float = 0.5,
    color_gray: int = 180,
    fft_strength: float = 1.0,
) -> np.ndarray:
    """
    Remove the 45-deg tiled visible watermark from the grayscale image.
    Uses both pattern subtraction and frequency-domain masking.
    """
    h, w = gray.shape
    g = gray.astype(np.float32)

    # Method 1: Pattern subtraction
    pattern = render_visible_watermark_pattern(
        gray, text, angle_deg, spacing_px, alpha, font_scale, color_gray
    )
    residual = g - pattern

    # Method 2: Frequency-domain notch filter
    # The 45-deg tiled text creates peaks at specific frequencies
    F = fftshift(fft2(g.astype(np.float32)))
    F_abs = np.abs(F)
    F_angle = np.angle(F)

    # Find dominant frequency of tiled text
    cy, cx = h // 2, w // 2
    fy, fx = np.ogrid[:h, :w]
    r_band = np.sqrt((fx - cx) ** 2 + (fy - cy) ** 2)

    # Create annular mask to isolate text frequency band
    # Estimate tile size from spacing: freq = 1/spacing
    text_freq = 1.0 / max(spacing_px, 1)
    # Convert to radial distance in FFT
    text_radius = text_freq * min(h, w) / 2

    # Also mask the 45-deg orientation: (u+v)/sqrt(2) direction
    # In Fourier domain, rotation by theta → rotation of spectrum by theta
    # The text is at 45 deg, so its spectrum has peaks at ±45 deg
    theta_rad = np.deg2rad(angle_deg)
    u = fx - cx
    v = fy - cy
    # Project onto text direction
    proj = u * np.cos(theta_rad) + v * np.sin(theta_rad)

    # Create notch mask: keep only low-freq + watermark signal bands
    # Remove the 45-deg text band
    notch = np.ones((h, w), dtype=np.float32)
    band_width = max(2, int(0.03 * min(h, w)))  # ~3% of image width

    for offset in [-1, 0, 1]:
        r_center = text_radius + offset * band_width
        mask = np.abs(r_band - r_center) < band_width
        notch *= (1.0 - mask.astype(np.float32) * fft_strength * 0.5)

    F_filtered = F * notch
    freq_denoised = np.real(ifftshift(fft2(F_filtered)))

    # Combine: use residual where freq filter was strong, freq_denoised otherwise
    strength_map = 1.0 - notch
    denoised = residual * (1.0 - strength_map * 0.3) + freq_denoised * (strength_map * 0.3)

    return denoised.astype(np.float32)


def decode_raw(
    gray: np.ndarray,
    cfg: WMConfig,
    tile_px_override: int,
    tta_phases: int = 5,
    k_size_candidates=None,
) -> tuple:
    return decode_from_warped(
        gray,
        cfg,
        tile_px_override=tile_px_override,
        tta_phases=tta_phases,
        k_size_candidates=k_size_candidates,
        enable_smooth=False,
    )


def main():
    parser = argparse.ArgumentParser(description="Decode s2c blind watermark with visible denoising")
    parser.add_argument("--in", dest="in_path", required=True)
    parser.add_argument("--tile", type=int, default=32)
    parser.add_argument("--cell", type=int, default=12)
    parser.add_argument("--min-scale", type=float, default=0.1)
    parser.add_argument("--max-scale", type=float, default=3.0)
    parser.add_argument("--scale-step", type=float, default=0.05)
    parser.add_argument("--wm-text", default="DLP Platform")
    parser.add_argument("--wm-angle", type=float, default=45.0)
    parser.add_argument("--wm-spacing", type=int, default=72)
    parser.add_argument("--wm-alpha", type=float, default=0.06)
    parser.add_argument("--wm-font-scale", type=float, default=0.5)
    parser.add_argument("--wm-color-gray", type=int, default=180)
    parser.add_argument("--fft-strength", type=float, default=0.8)
    parser.add_argument("--no-denoise", action="store_true",
                        help="Skip visible watermark denoising (raw decode)")
    parser.add_argument("--coarse", action="store_true",
                        help="Coarse search only (faster)")
    args = parser.parse_args()

    img = cv2.imread(args.in_path, cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"Failed to read: {args.in_path}")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    print(f"Image: {w}x{h}", flush=True)

    cfg = WMConfig(tile_size=args.tile, cell_px=args.cell)
    base_tile = TILE_PX

    step = 0.02 if args.coarse else args.scale_step
    max_sc = 3.5 if args.coarse else args.max_scale
    scales = []
    sc = args.min_scale
    while sc <= max_sc + 1e-6:
        scales.append(round(sc, 4))
        sc += step
    scales = sorted(set(scales))

    k_base = (0, 11, 21, 31, 51, 71, 101, 131, 161, 201, 251, 301, 401, 501)
    if args.coarse:
        k_base = (0, 21, 51, 101, 201, 401)

    print(f"Scales: {len(scales)}, K-sizes: {len(k_base)}", flush=True)

    # Pre-compute denoised image ONCE
    denoised_img = None
    if not args.no_denoise:
        print("Pre-computing visible watermark denoising...", flush=True)
        denoised_img = denoise_visible_watermark(
            gray,
            text=args.wm_text,
            angle_deg=args.wm_angle,
            spacing_px=args.wm_spacing,
            alpha=args.wm_alpha,
            font_scale=args.wm_font_scale,
            color_gray=args.wm_color_gray,
            fft_strength=args.fft_strength,
        )
        print("Denoising done.", flush=True)

    all_raw = []
    all_denoise = []

    total = len(scales) * len(k_base)
    done = 0

    for sc in scales:
        tpo = int(round(base_tile * sc))
        if tpo < 8 or tpo > max(h, w) * 2:
            continue

        k_sizes = []
        for k in k_base:
            if k == 0:
                k_sizes.append(0)
            else:
                ks = int(round(k * sc))
                if ks % 2 == 0:
                    ks += 1
                k_sizes.append(ks)
        k_sizes = sorted(set(k_sizes))

        for k in k_sizes:
            done += 1

            k_cand = (k,)
            tile_override = tpo

            if not args.no_denoise and denoised_img is not None:
                crc_ok, uid, tval, bits = decode_from_warped(
                    denoised_img.astype(np.uint8),
                    cfg,
                    tile_px_override=tile_override,
                    tta_phases=5,
                    k_size_candidates=k_cand,
                    enable_smooth=False,
                )
                if crc_ok:
                    all_denoise.append((sc, tpo, k, uid, tval, bits.tolist()))
                    print(f"  [DN] sc={sc:.2f} tpo={tpo} k={k} uid={uid} t={tval} bits={''.join(str(int(b)) for b in bits)}")

            # Also try raw decode for comparison
            crc_ok, uid, tval, bits = decode_raw(
                gray, cfg, tile_override,
                tta_phases=5,
                k_size_candidates=k_cand,
            )
            if crc_ok:
                all_raw.append((sc, tpo, k, uid, tval, bits.tolist()))
                print(f"  [RW] sc={sc:.2f} tpo={tpo} k={k} uid={uid} t={tval} bits={''.join(str(int(b)) for b in bits)}")

        if done % 50 == 0:
            print(f"  ... {done}/{total} ({100*done//total}%)", flush=True)

    print(f"\nRaw CRC-OK: {len(all_raw)}")
    print(f"Denoise CRC-OK: {len(all_denoise)}")

    for label, results in [("RAW", all_raw), ("DENOISE", all_denoise)]:
        if not results:
            continue
        votes = Counter((u, t) for _, _, _, u, t, _ in results)
        top = votes.most_common(5)
        best_pair = top[0][0]
        best_uid, best_tval = best_pair

        best_sc = None
        best_bits = None
        best_results = [(sc, bits) for sc, tpo, k, uid, tval, bits in results
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
