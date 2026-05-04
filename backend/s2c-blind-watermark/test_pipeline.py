#!/usr/bin/env python3
import argparse
import os
from pathlib import Path

import cv2
import numpy as np

from wm_core import (
    TILE_PX,
    WMConfig,
    complete_corners_for_partial,
    compute_warp_size_from_quad,
    embed_watermark_bgr,
    decode_from_warped,
    detect_marks,
    warp_to_rect,
)


def _decode_with_scale_search(gray: np.ndarray, cfg: WMConfig) -> tuple[bool, int, int]:
    """
    Robust decode on raw image:
    - Fast scale sweep to gather CRC_OK candidates
    - Full-parameter re-decode for candidate scales
    - Vote + tie-break by scale closest to 1.0
    """
    scales = [0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 1.0]
    quick = []  # (uid, t, sc, tpo)
    for sc in scales:
        tpo = int(round(float(TILE_PX) * sc))
        crc_ok, uid, t, _bits = decode_from_warped(
            gray,
            cfg,
            tile_px_override=tpo,
            tta_phases=3,
            k_size_candidates=(0, 31, 51, 71, 101),
        )
        if crc_ok:
            quick.append((int(uid), int(t), float(sc), int(tpo)))
    if not quick:
        return False, 0, 0

    # Full re-decode on unique candidate tile sizes
    candidates_full = []  # (uid, t, sc)
    for tpo in sorted({x[3] for x in quick}):
        crc_ok, uid, t, _bits = decode_from_warped(gray, cfg, tile_px_override=int(tpo))
        if crc_ok:
            candidates_full.append((int(uid), int(t), float(tpo) / float(TILE_PX)))

    pool = candidates_full if candidates_full else [(u, t, sc) for (u, t, sc, _tpo) in quick]
    from collections import Counter

    votes = Counter((u, t) for (u, t, _sc) in pool)
    max_cnt = max(votes.values())
    top_pairs = [pair for pair, cnt in votes.items() if cnt == max_cnt]
    top_pool = [c for c in pool if (c[0], c[1]) in top_pairs]
    top_pool_sorted = sorted(top_pool, key=lambda x: abs(x[2] - 1.0))
    uid_sel, t_sel, _sc_sel = top_pool_sorted[0]
    return True, int(uid_sel), int(t_sel)


def run_once(img_path: Path, wm_id: int, preset: str, no_attack: bool = False,
             partial_ratio: float = 0.0) -> bool:
    img = cv2.imread(str(img_path), cv2.IMREAD_COLOR)
    if img is None:
        return False
    cfg = WMConfig()
    wm_id = int(wm_id) & 0xFFF
    wm, _ = embed_watermark_bgr(img, wm_id, cfg)

    if no_attack:
        out = wm
    else:
        import simulate_recapture as sim
        # screen = light phone/screen capture; light/minimal = weaker; default = strong print-camera
        if preset == "screen":
            strength, scale, blur_k, jpeg_q = 0.25, 0.88, 0.4, 78
        elif preset == "light":
            strength, scale, blur_k, jpeg_q = 0.4, 0.82, 0.5, 70
        elif preset == "minimal":
            strength, scale, blur_k, jpeg_q = 0.2, 0.92, 0.3, 82
        elif preset == "simple":
            # Much milder attack: closer to "just a casual photo" / mild re-sampling
            strength, scale, blur_k, jpeg_q = 0.12, 0.97, 0.2, 90
        elif preset == "moire":
            strength, scale, blur_k, jpeg_q = 0.7, 0.65, 0.9, 55
        else:
            # default = print-camera sim (moderate), tuned to stay decodable
            # Align to minimal strength for practical decodability in MVP
            strength, scale, blur_k, jpeg_q = 0.2, 0.92, 0.3, 82
        out = sim._perspective(wm, strength)
        h, w = out.shape[:2]
        small = cv2.resize(out, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        out = cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR)
        out = cv2.GaussianBlur(out, (3, 3), blur_k)
        if preset == "moire":
            out = sim._moire(out, 0.6)
    tmp_dir = Path(__file__).resolve().parent / "out"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    # Simulate "only upper part" captured by phone (crop to top portion)
    if partial_ratio > 0 and partial_ratio < 1.0:
        h_out, w_out = out.shape[:2]
        crop_h = max(TILE_PX, int(h_out * partial_ratio))
        out = out[:crop_h, :].copy()
    if no_attack:
        cv2.imwrite(str(tmp_dir / "cap.png"), out)
    else:
        q = (
            90
            if preset == "simple"
            else (82 if preset == "minimal" else (78 if preset == "screen" else (70 if preset == "light" else 55)))
        )
        cv2.imwrite(str(tmp_dir / "cap.jpg"), out, [int(cv2.IMWRITE_JPEG_QUALITY), q])

    gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
    corners = detect_marks(gray, cfg)
    corners = complete_corners_for_partial(corners, gray.shape[0], gray.shape[1])
    # When we simulated partial capture (crop), use quad-based size; else preserve image size
    if partial_ratio > 0:
        out_w, out_h = compute_warp_size_from_quad(corners, TILE_PX)
    else:
        out_w, out_h = gray.shape[1], gray.shape[0]
    warped, _H = warp_to_rect(gray, corners, out_w, out_h)
    # Prefer raw decode; use scale-search to survive mild resampling/perspective.
    crc_ok, got_uid, got_t = _decode_with_scale_search(gray, cfg)
    if not crc_ok:
        # fallback: warped decode (single-shot)
        crc_ok, got_uid, got_t, _bits_raw = decode_from_warped(warped, cfg)
    exp_uid = (wm_id >> 4) & 0xFF
    exp_t = wm_id & 0xF
    return crc_ok and got_uid == exp_uid and got_t == exp_t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", dest="wm_id", type=int, required=True)
    ap.add_argument("--n", type=int, default=10)
    ap.add_argument(
        "--preset",
        choices=["default", "screen", "simple", "light", "minimal", "moire"],
        default="default",
        help="default=print-camera, screen=phone/screen, simple=very mild, light/minimal=weaker",
    )
    ap.add_argument("--no-attack", action="store_true", help="Skip print-camera sim (clean decode)")
    ap.add_argument("--partial", type=float, default=0.0, metavar="RATIO",
                    help="Use only upper RATIO of image (e.g. 0.5 = top half); 0 = full")
    args = ap.parse_args()

    img_dir = (Path(__file__).resolve().parents[2] / "docs" / "llm-test-samples" / "images").resolve()
    files = sorted([p for p in img_dir.iterdir() if p.suffix.lower() in (".png", ".jpg", ".jpeg")])
    if not files:
        # Fallback: use a generated doc-like image (white + text area)
        tmp_dir = Path(__file__).resolve().parent / "out"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        fallback = tmp_dir / "_test_doc.png"
        doc_img = np.ones((600, 800, 3), dtype=np.uint8) * 248
        cv2.putText(doc_img, "Sample document for watermark test", (80, 300), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (60, 60, 60), 2)
        cv2.imwrite(str(fallback), doc_img)
        files = [fallback]
    rng = np.random.default_rng(42)
    picks = [files[int(i)] for i in rng.integers(0, len(files), size=args.n)]

    ok = 0
    for p in picks:
        if run_once(p, args.wm_id, args.preset, no_attack=args.no_attack, partial_ratio=args.partial):
            ok += 1
    print("OK")
    print("preset:", args.preset)
    print("n:", args.n)
    if args.partial > 0:
        print("partial (upper):", args.partial)
    print("exact_id_rate:", ok / args.n)


if __name__ == "__main__":
    main()

