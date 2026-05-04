#!/usr/bin/env python3
"""
Print-Camera Simulation Test for Robust Dual Watermark.
Simulates: print -> photo capture -> decode BPSK + check dynamic watermark.

Degradation effects simulated:
  - Perspective warp (3D view angle)
  - Rotation (random -10 to +10 deg)
  - Scale jitter
  - Gaussian blur (print scattering)
  - JPEG-like compression noise
  - Color channel shift (CMYK->RGB conversion artifact)
  - Brightness/contrast variation
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import cv2
import numpy as np
from pathlib import Path


def simulate_print_camera(img: np.ndarray, seed: int = 42) -> np.ndarray:
    """
    Apply print-camera degradation pipeline to an image.
    """
    rng = np.random.default_rng(seed)
    h, w = img.shape[:2]

    # 1. Random rotation
    angle = rng.uniform(-12, 12)
    M_rot = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    img = cv2.warpAffine(img, M_rot, (w, h), borderMode=cv2.BORDER_REFLECT)

    # 2. Perspective warp (simulate 3D tilt)
    #   Project corners to simulate looking at the printed page from an angle
    disp = 0.08  # perspective distortion magnitude
    src_pts = np.float32([
        [0, 0],
        [w, 0],
        [w, h],
        [0, h],
    ])
    # Random viewpoint offset
    tx = rng.uniform(-w * disp * 0.3, w * disp * 0.3)
    ty = rng.uniform(-h * disp * 0.3, h * disp * 0.3)
    dst_pts = np.float32([
        [tx,         ty        ],
        [w - tx,     ty * 0.5  ],
        [w + tx * 0.5, h - ty * 0.5],
        [tx * 0.5,   h - ty    ],
    ])
    H = cv2.getPerspectiveTransform(src_pts, dst_pts)
    img = cv2.warpPerspective(img, H, (w, h), borderMode=cv2.BORDER_REFLECT)

    # 3. Scale jitter (zoom in slightly then crop back)
    scale = rng.uniform(0.92, 1.08)
    M_sc = cv2.getRotationMatrix2D((w / 2, h / 2), 0, scale)
    img = cv2.warpAffine(img, M_sc, (w, h), borderMode=cv2.BORDER_REFLECT)

    # 4. Gaussian blur (print dot gain / camera defocus)
    ksize = rng.integers(3, 7)
    if ksize % 2 == 0:
        ksize += 1
    img = cv2.GaussianBlur(img, (ksize, ksize), rng.uniform(0.5, 1.5))

    # 5. Motion blur (simulate handheld shake)
    mb_ksize = rng.integers(3, 7)
    mb_kernel = np.zeros((mb_ksize, mb_ksize))
    mb_kernel[mb_ksize // 2, :] = 1.0 / mb_ksize
    img = cv2.filter2D(img, -1, mb_kernel)

    # 6. Gaussian noise (sensor noise)
    noise_sigma = rng.uniform(3, 10)
    noise = rng.normal(0, noise_sigma, img.shape).astype(np.float32)
    img = np.clip(img.astype(np.float32) + noise, 0, 255).astype(np.uint8)

    # 7. Color channel shift via small affine translation (simulates lens chromatic aberration)
    shift_x = rng.uniform(-1.5, 1.5)
    shift_y = rng.uniform(-0.8, 0.8)
    M_shift = np.float32([[1, 0, shift_x], [0, 1, shift_y]])
    img = cv2.warpAffine(img, M_shift, (w, h), borderMode=cv2.BORDER_REFLECT)

    # 8. Brightness/contrast variation
    alpha = rng.uniform(0.85, 1.15)  # contrast
    beta = rng.uniform(-20, 20)       # brightness
    img = np.clip(img.astype(np.float32) * alpha + beta, 0, 255).astype(np.uint8)

    # 9. Slight color temperature shift (warm/cool)
    if rng.random() > 0.5:
        img[:, :, 0] = np.clip(img[:, :, 0].astype(np.int16) + rng.integers(-10, 10), 0, 255)  # B
    else:
        img[:, :, 2] = np.clip(img[:, :, 2].astype(np.int16) + rng.integers(-10, 10), 0, 255)  # R

    # 10. JPEG-like quality degradation (repeated save/load simulation)
    #    (we skip actual JPEG to keep PNG integrity, but add final noise pass)
    final_noise = rng.normal(0, 2, img.shape).astype(np.float32)
    img = np.clip(img.astype(np.float32) + final_noise, 0, 255).astype(np.uint8)

    return img


def test_print_camera(
    src_path: str,
    out_path: str = None,
    userid: int = 290,
    time_val: int = 3,
    timestamp: str = "2026-02-22 22:39:52",
    bpsk_delta_y: float = 0.8,
    seed: int = 42,
):
    """
    Full print-camera test pipeline.
    """
    from robust_dynamic_wm import embed_robust_combined
    from wm_core import WMConfig, decode_from_image_no_reg, TILE_PX, build_payload_from_id

    print(f"=== Print-Camera Test ===")
    print(f"Source: {src_path}")
    print(f"UserID: {userid}, Time: {time_val}, Seed: {seed}")
    print()

    # Step 1: Embed watermarks
    if out_path is None:
        out_path = src_path.replace(".png", "_watermarked.png")
    embed_robust_combined(
        src_path, out_path,
        userid=userid, time_val=time_val,
        timestamp=timestamp, bpsk_delta_y=bpsk_delta_y,
    )

    # Step 2: Load watermarked image
    wm_img = cv2.imread(out_path)
    if wm_img is None:
        print(f"ERROR: cannot load {out_path}")
        return

    # Step 3: Simulate print-camera degradation
    degraded = simulate_print_camera(wm_img, seed=seed)
    degraded_path = out_path.replace(".png", "_degraded.png")
    cv2.imwrite(degraded_path, degraded)
    print(f"\nDegraded image saved: {degraded_path}")

    # Step 4: Decode BPSK from degraded image
    cfg = WMConfig(delta_y=bpsk_delta_y)
    wm_id = (userid << 4) | (time_val & 0xF)
    expected_bits = build_payload_from_id(wm_id)

    print(f"\n--- BPSK Decode from Degraded Image (quick) ---")
    # Quick decode with default params
    for tile_px in [384]:
        for tta in [4]:
            crc_ok, dec_uid, dec_time, bits = decode_from_image_no_reg(
                degraded, cfg, tile_px=tile_px, tta_phases=tta
            )
            match = bytes(bits) == bytes(expected_bits) if crc_ok else False
            print(f"  tile={tile_px}, tta={tta}: CRC={crc_ok}, uid={dec_uid}(exp {userid}), "
                  f"time={dec_time}(exp {time_val}), match={match}")
            if crc_ok:
                return True, dec_uid, dec_time, bits

    print("  No CRC match.")
    return False, 0, 0, None


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("image", help="Source image")
    parser.add_argument("-o", "--output", help="Watermarked output")
    parser.add_argument("--userid", type=int, default=290)
    parser.add_argument("--time", type=int, default=3)
    parser.add_argument("--ts", default="2026-02-22 22:39:52")
    parser.add_argument("--bpsk", type=float, default=0.8)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    test_print_camera(
        args.image, args.output,
        userid=args.userid, time_val=args.time,
        timestamp=args.ts, bpsk_delta_y=args.bpsk,
        seed=args.seed,
    )
