#!/usr/bin/env python3
"""
Two-Track Watermark System: Invisible BPSK + Visible Anti-Removal Marks.

Track 1: BPSK Blind Watermark (invisible)
Track 2: Visible Corner Marks (subtle, in white margins)
"""
import sys, os, cv2, numpy as np
from pathlib import Path
from typing import Tuple

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(THIS_DIR, ".."))
from wm_core import WMConfig, build_payload_from_id, make_payload_pattern, tile_pattern_to_image

MARK_DELTA_VISIBLE = 1.5


def make_circular_mark_template(size: int = 64) -> np.ndarray:
    img = np.zeros((size, size), dtype=np.float32)
    cx = size // 2
    r_outer = int(size * 0.40)
    r_inner = int(size * 0.25)
    cv2.circle(img, (cx, cx), r_outer, 1.0, thickness=2)
    cv2.circle(img, (cx, cx), r_inner, 1.0, thickness=1)
    cv2.line(img, (cx - r_outer, cx), (cx + r_outer, cx), 0.5, thickness=1)
    cv2.line(img, (cx, cx - r_outer), (cx, cx + r_outer), 0.5, thickness=1)
    return img


def embed_combined_two_track(
    img_bgr: np.ndarray,
    wm_id: int,
    cfg: WMConfig,
    bpsk_delta_y: float = 0.8,
    mark_delta: float = MARK_DELTA_VISIBLE,
) -> Tuple[np.ndarray, dict]:
    h, w = img_bgr.shape[:2]
    bits = build_payload_from_id(wm_id)
    payload_tile = make_payload_pattern(bits, cfg)
    payload = tile_pattern_to_image(payload_tile, h, w)

    yuv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2YUV)
    y = yuv[:, :, 0].astype(np.float32)
    y = y + payload * float(bpsk_delta_y)

    s = cfg.mark_size
    margin = 8
    positions = {
        "tl": (margin, margin),
        "tr": (w - s - margin, margin),
        "bl": (margin, h - s - margin),
        "br": (w - s - margin, h - s - margin),
    }
    mark = make_circular_mark_template(s)
    for k, (x0, y0) in positions.items():
        y[y0:y0+s, x0:x0+s] += mark * mark_delta

    yuv[:, :, 0] = np.clip(y, 0, 255).astype(np.uint8)
    out = cv2.cvtColor(yuv, cv2.COLOR_YUV2BGR)
    return out, {"wm_id": int(wm_id), "positions": positions}


def detect_visible_corner_marks(
    gray: np.ndarray,
    cfg: WMConfig,
    positions: dict = None,
) -> dict:
    h, w = gray.shape[:2]
    s = cfg.mark_size
    if positions is None:
        margin = 8
        positions = {
            "tl": (margin, margin),
            "tr": (w - s - margin, margin),
            "bl": (margin, h - s - margin),
            "br": (w - s - margin, h - s - margin),
        }

    lap = cv2.Laplacian(gray.astype(np.float32), cv2.CV_32F, ksize=5)
    lap = np.abs(lap)
    lap = lap / (np.max(lap) + 1e-6)

    mark = make_circular_mark_template(s)
    mark_lap = cv2.Laplacian(mark, cv2.CV_32F, ksize=5)
    mark_lap = np.abs(mark_lap)
    mark_lap = (mark_lap - np.mean(mark_lap)) / (np.std(mark_lap) + 1e-6)

    corners = {}
    for k, (ex, ey) in positions.items():
        win = s
        x1 = max(0, ex - win)
        y1 = max(0, ey - win)
        x2 = min(w - s, ex + win)
        y2 = min(h - s, ey + win)
        if x2 <= x1 or y2 <= y1:
            continue
        roi = lap[y1:y2+s, x1:x2+s]
        roi_n = (roi - np.mean(roi)) / (np.std(roi) + 1e-6)
        res = cv2.matchTemplate(
            roi_n.astype(np.float32),
            mark_lap.astype(np.float32),
            cv2.TM_CCOEFF_NORMED,
        )
        _, max_v, _, max_loc = cv2.minMaxLoc(res)
        corners[k] = {
            "pt": (float(x1 + max_loc[0] + s // 2), float(y1 + max_loc[1] + s // 2)),
            "score": float(max_v),
            "scale": 1.0,
        }
    return corners


if __name__ == "__main__":
    src = Path(r"..\..\docs\llm-test-samples\images\sample_confidential_0421.png")
    out_path = Path(r"..\..\docs\llm-test-samples\images\dual_track_sample.png")
    img = cv2.imread(str(src))
    cfg = WMConfig(delta_y=0.8)
    wm_id = (290 << 4) | 3
    out, meta = embed_combined_two_track(img, wm_id, cfg)

    y_orig = cv2.cvtColor(img, cv2.COLOR_BGR2YUV)[:, :, 0].astype(float)
    y_out  = cv2.cvtColor(out, cv2.COLOR_BGR2YUV)[:, :, 0].astype(float)
    diff = np.abs(y_out - y_orig)
    print(f"Y diff: max={diff.max():.2f}, corner_max={diff[:128,:128].max():.2f}")

    cv2.imwrite(str(out_path), out)
    print(f"Saved: {out_path}")

    gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
    corners = detect_visible_corner_marks(gray, cfg, meta["positions"])
    for k, v in corners.items():
        print(f"  {k}: score={v['score']:.3f}")
