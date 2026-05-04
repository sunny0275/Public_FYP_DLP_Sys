#!/usr/bin/env python3
import argparse
import os

import cv2

from wm_core import (
    DEFAULT_WARP_H,
    DEFAULT_WARP_W,
    TILE_PX,
    WMConfig,
    complete_corners_for_partial,
    compute_warp_size_from_quad,
    decode_from_warped,
    detect_marks,
    detect_marks_multiscale,
    warp_bgr_to_rect,
)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_path", required=True)
    ap.add_argument("--out-w", type=int, default=0, help="0 = auto from quad (supports partial capture)")
    ap.add_argument("--out-h", type=int, default=0, help="0 = auto from quad")
    ap.add_argument("--tile", type=int, default=32)
    ap.add_argument("--cell", type=int, default=12)
    ap.add_argument("--save-warped", default="")
    args = ap.parse_args()

    img = cv2.imread(args.in_path, cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"Failed to read: {args.in_path}")

    cfg = WMConfig(tile_size=args.tile, cell_px=args.cell)
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Multi-scale detect to estimate pixel scale under phone capture.
    scales = [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.35, 1.5, 1.7]
    corners = detect_marks_multiscale(gray, cfg, scales=scales)
    from wm_core import PARTIAL_MARK_SCORE_THRESHOLD
    is_partial = (corners["bl"]["score"] < PARTIAL_MARK_SCORE_THRESHOLD or
                  corners["br"]["score"] < PARTIAL_MARK_SCORE_THRESHOLD)

    # Estimate scale from top marks (rough). For phone captures, we will still
    # do a small scale search for raw decoding.
    scale_candidates = []
    for k in ("tl", "tr"):
        if corners[k]["score"] > 0.05 and "scale" in corners[k]:
            scale_candidates.append(float(corners[k]["scale"]))
    scale_est = float(sum(scale_candidates) / len(scale_candidates)) if scale_candidates else 1.0
    tile_px_override = int(round(float(TILE_PX) * scale_est))

    # Raw decode scale search (fast-ish) to handle incorrect scale estimation.
    # Collect all CRC-ok results and vote by frequency to reduce CRC8 collisions.
    candidates = []  # (userid, time, bits, sc, tpo)
    for sc in [0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 1.0]:
        tpo = int(round(float(TILE_PX) * sc))
        crc_ok_raw, userid_raw, time_val_raw, bits_raw = decode_from_warped(
            gray,
            cfg,
            tile_px_override=tpo,
            tta_phases=3,
            k_size_candidates=(0, 31, 51, 71, 101),
            enable_smooth=False,
        )
        if crc_ok_raw:
            candidates.append((int(userid_raw), int(time_val_raw), bits_raw, float(sc), int(tpo)))

    if candidates:
        # Re-decode with full parameters for the candidate tile_px_overrides.
        unique_tpo = sorted({c[4] for c in candidates})
        candidates_full = []
        for tpo in unique_tpo:
            crc_ok_full, uid_full, t_full, bits_full = decode_from_warped(
                gray, cfg, tile_px_override=tpo, enable_smooth=False
            )
            if crc_ok_full:
                sc_full = float(tpo) / float(TILE_PX)
                candidates_full.append((int(uid_full), int(t_full), bits_full, sc_full, tpo))

        pool = candidates_full if candidates_full else candidates

        from collections import Counter

        votes = Counter((u, t) for u, t, _b, _sc, _tpo in pool)
        max_count = votes.most_common(1)[0][1]
        # If there is no stability across candidates, don't claim OK (avoid false positives).
        if max_count < 2 and len(votes) > 1:
            print("CRC_FAIL")
            print("userid:", 0)
            print("time:", 0)
            print("bits:", "0" * 20)
            print("corner_scores:", {k: round(v["score"], 3) for k, v in corners.items()})
            return
        top_pairs = [pair for pair, cnt in votes.items() if cnt == max_count]
        top_pool = [c for c in pool if (c[0], c[1]) in top_pairs]
        top_pool_sorted = sorted(top_pool, key=lambda x: abs(x[3] - 1.0))
        userid, time_val, bits, _sc, _tpo = top_pool_sorted[0]
        crc_ok = True
        print("OK" if crc_ok else "CRC_FAIL")
        print("userid:", userid)
        print("time:", time_val)
        print("bits:", "".join(str(int(b)) for b in bits.tolist()))
        print("corner_scores:", {k: round(v["score"], 3) for k, v in corners.items()})
        return

    corners = complete_corners_for_partial(
        corners, h, w, scale_factor=scale_est, mark_size=cfg.mark_size
    )
    if args.out_w > 0 and args.out_h > 0:
        out_w, out_h = args.out_w, args.out_h
    elif is_partial:
        out_w, out_h = compute_warp_size_from_quad(corners, tile_px_override)
    else:
        out_w, out_h = w, h
    warped_bgr, H = warp_bgr_to_rect(img, corners, out_w, out_h)
    warped_gray = cv2.cvtColor(warped_bgr, cv2.COLOR_BGR2GRAY)

    # Raw decode failed; try warped decode with the estimated scale.
    crc_ok, userid, time_val, bits = decode_from_warped(
        warped_gray,
        cfg,
        tile_px_override=tile_px_override,
        tta_phases=3,
        k_size_candidates=(0, 31, 51, 71, 101),
        enable_smooth=False,
    )

    if args.save_warped:
        os.makedirs(os.path.dirname(args.save_warped) or ".", exist_ok=True)
        cv2.imwrite(args.save_warped, warped_bgr)

    print("OK" if crc_ok else "CRC_FAIL")
    print("userid:", userid)
    print("time:", time_val)
    print("bits:", "".join(str(int(b)) for b in bits.tolist()))
    print("corner_scores:", {k: round(v["score"], 3) for k, v in corners.items()})
    if args.save_warped:
        print("warped:", os.path.abspath(args.save_warped))


if __name__ == "__main__":
    main()

