from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass
from typing import Tuple

import cv2
import numpy as np


TILE_PX = 32 * 12  # tile_size * cell_px = 384, for multi-tile decode
DEFAULT_WARP_W = 384 * 3   # 1152
DEFAULT_WARP_H = 384 * 4   # 1536


@dataclass(frozen=True)
class WMConfig:
    tile_size: int = 32          # base tile (cells)
    cell_px: int = 12            # pixels per cell (upsample)
    delta_y: float = 3.0       # luminance modulation (balanced for robustness)
    blur_sigma: float = 0.0     # keep payload sharp (decode assumptions tuned for it)
    mark_size: int = 96          # registration mark size in px
    mark_delta_y: float = 40.0   # stronger for corner detection
    seed: int = 42


# Payload: 8-bit userid + 4-bit time + 8-bit CRC = 20 bits total
USERID_BITS = 8
TIME_BITS = 4
CRC_BITS = 8
PAYLOAD_BITS = USERID_BITS + TIME_BITS + CRC_BITS
ID_BITS = 12  # legacy: (userid<<4)|time


def _crc8(data: bytes) -> int:
    """CRC-16-CCITT, return low 8 bits."""
    crc = 0xFFFF
    for b in data:
        crc ^= (b << 8) & 0xFFFF
        for _ in range(8):
            crc = ((crc << 1) ^ (0x1021 if (crc & 0x8000) else 0)) & 0xFFFF
    return crc & 0xFF


def id_to_bits(val: int, bit_len: int) -> np.ndarray:
    if val < 0 or val >= (1 << bit_len):
        raise ValueError(f"val out of range for bit_len={bit_len}: {val}")
    s = format(val, f"0{bit_len}b")
    return np.array([int(c) for c in s], dtype=np.uint8)


def bits_to_id(bits01: np.ndarray) -> int:
    bits = np.array(bits01).astype(int).flatten().tolist()
    return int("".join(str(int(b)) for b in bits), 2)


def build_payload_bits(userid: int, time_val: int) -> np.ndarray:
    """8-bit userid + 4-bit time + 8-bit CRC -> 20 bits."""
    if not (0 <= userid < (1 << USERID_BITS) and 0 <= time_val < (1 << TIME_BITS)):
        raise ValueError(f"userid [0,255] time [0,15]: got {userid}, {time_val}")
    u_bits = id_to_bits(userid, USERID_BITS)
    t_bits = id_to_bits(time_val, TIME_BITS)
    data = bytes([userid, time_val])
    crc = _crc8(data)
    c_bits = id_to_bits(crc, CRC_BITS)
    return np.concatenate([u_bits, t_bits, c_bits], axis=0).astype(np.uint8)


def build_payload_from_id(wm_id: int) -> np.ndarray:
    """Legacy: 12-bit wm_id -> userid (high 8) + time (low 4)."""
    return build_payload_bits((wm_id >> TIME_BITS) & 0xFF, wm_id & 0xF)


def check_and_extract_id(bits16: np.ndarray) -> Tuple[bool, int, int]:
    """Validate CRC and return (ok, userid, time)."""
    bits16 = np.array(bits16).astype(np.uint8).flatten()
    if bits16.size != PAYLOAD_BITS:
        return False, 0, 0
    u_bits = bits16[:USERID_BITS]
    t_bits = bits16[USERID_BITS : USERID_BITS + TIME_BITS]
    c_bits = bits16[USERID_BITS + TIME_BITS :]
    userid = bits_to_id(u_bits)
    time_val = bits_to_id(t_bits)
    crc_got = bits_to_id(c_bits)
    data = bytes([userid, time_val])
    crc_exp = _crc8(data)
    return (crc_got == crc_exp), int(userid), int(time_val)


def _bits_to_grid(bits01: np.ndarray, tile_size: int) -> np.ndarray:
    """Map bits to a tile_size x tile_size BPSK grid via tiling/repetition."""
    bits01 = np.array(bits01).astype(np.uint8).flatten()
    if bits01.size == 0:
        raise ValueError("empty bits")
    # Fill grid row-major with repeated bits
    total = tile_size * tile_size
    rep = np.resize(bits01, total)
    grid = rep.reshape(tile_size, tile_size).astype(np.float32)
    # BPSK: 0 -> -1, 1 -> +1 (must use float to avoid uint8 wrap)
    return grid * 2.0 - 1.0


def make_payload_pattern(bits01: np.ndarray, cfg: WMConfig) -> np.ndarray:
    """Return a (H,W) float32 pattern in [-1,1] at cell resolution (tile_size*cell_px)."""
    grid = _bits_to_grid(bits01, cfg.tile_size)  # (tile_size, tile_size)
    pat = cv2.resize(grid, (cfg.tile_size * cfg.cell_px, cfg.tile_size * cfg.cell_px), interpolation=cv2.INTER_NEAREST)
    # smooth to reduce visibility
    if cfg.blur_sigma and cfg.blur_sigma > 0:
        k = int(max(3, int(cfg.blur_sigma * 6)))
        if k % 2 == 0:
            k += 1
        pat = cv2.GaussianBlur(pat, (k, k), cfg.blur_sigma)
        pat = np.clip(pat, -1.0, 1.0)
    return pat.astype(np.float32)


def tile_pattern_to_image(pattern: np.ndarray, h: int, w: int) -> np.ndarray:
    """Tile a (ph,pw) pattern to (h,w)."""
    ph, pw = pattern.shape[:2]
    reps_y = math.ceil(h / ph)
    reps_x = math.ceil(w / pw)
    tiled = np.tile(pattern, (reps_y, reps_x))
    return tiled[:h, :w].astype(np.float32)


def make_registration_mark(cfg: WMConfig, kind: str) -> np.ndarray:
    """
    Create a small template to embed in Y channel.
    kind: 'tl','tr','bl','br' to make templates distinct (reduce corner confusion).
    Uses a crosshair + concentric rings design: high edge contrast even on white backgrounds.
    """
    s = cfg.mark_size
    img = np.zeros((s, s), np.float32)
    cx, cy = s // 2, s // 2

    # Outer solid circle (creates strong outer edge)
    r_outer = int(round(s * 0.40))
    cv2.circle(img, (cx, cy), r_outer, 1.0, thickness=-1)

    # Dark inner solid circle (creates sharp inner edge)
    r_inner = int(round(s * 0.20))
    cv2.circle(img, (cx, cy), r_inner, -1.0, thickness=-1)

    # Crosshair arms (horizontal + vertical bars for orientation)
    arm_w = max(2, int(round(s * 0.06)))
    arm_l = int(round(s * 0.32))
    cv2.rectangle(img, (cx - arm_l, cy - arm_w), (cx + arm_l, cy + arm_w), -1.0, thickness=-1)
    cv2.rectangle(img, (cx - arm_w, cy - arm_l), (cx + arm_w, cy + arm_l), -1.0, thickness=-1)

    # Corner notch (unique per corner for disambiguation)
    notch_h = max(3, s // 6)
    notch_w = max(4, s // 3)
    if kind == "tl":
        cv2.rectangle(img, (0, 0), (notch_w, notch_h), 1.0, thickness=-1)
    elif kind == "tr":
        cv2.rectangle(img, (s - notch_w, 0), (s, notch_h), 1.0, thickness=-1)
    elif kind == "bl":
        cv2.rectangle(img, (0, s - notch_h), (notch_w, s), 1.0, thickness=-1)
    elif kind == "br":
        cv2.rectangle(img, (s - notch_w, s - notch_h), (s, s), 1.0, thickness=-1)

    img = img - np.mean(img)
    img = img / (np.max(np.abs(img)) + 1e-6)
    return img.astype(np.float32)


def embed_watermark_bgr(img_bgr: np.ndarray, wm_id: int, cfg: WMConfig, *, bit_len: int = PAYLOAD_BITS) -> Tuple[np.ndarray, dict]:
    """Embed tiled pattern + 4 registration marks. wm_id = (userid<<4)|time (12-bit)."""
    h, w = img_bgr.shape[:2]
    wm_id = int(wm_id) & 0xFFF
    bits = build_payload_from_id(wm_id)
    payload_tile = make_payload_pattern(bits, cfg)
    payload = tile_pattern_to_image(payload_tile, h, w)

    yuv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2YUV)
    y = yuv[:, :, 0].astype(np.float32)
    y = y + payload * float(cfg.delta_y)

    # registration marks (embed stronger, but still in Y)
    marks = {
        "tl": make_registration_mark(cfg, "tl"),
        "tr": make_registration_mark(cfg, "tr"),
        "bl": make_registration_mark(cfg, "bl"),
        "br": make_registration_mark(cfg, "br"),
    }
    s = cfg.mark_size
    margin = 12
    positions = {
        "tl": (margin, margin),
        "tr": (w - s - margin, margin),
        "bl": (margin, h - s - margin),
        "br": (w - s - margin, h - s - margin),
    }
    for k, m in marks.items():
        x0, y0 = positions[k]
        y[y0 : y0 + s, x0 : x0 + s] += m * float(cfg.mark_delta_y)

    yuv[:, :, 0] = np.clip(y, 0, 255).astype(np.uint8)
    out = cv2.cvtColor(yuv, cv2.COLOR_YUV2BGR)
    meta = {"wm_id": int(wm_id), "bit_len": int(bit_len), "cfg": cfg, "positions": positions}
    return out, meta


# ---------------------------------------------------------------------------
# Invisible Registration Marks (ultra-low strength + robust NCC detection)
# ---------------------------------------------------------------------------

# Lower default for invisible marks (when user wants unobtrusive corners)
INVISIBLE_MARK_DELTA = 0.15


INVISIBLE_MARK_DELTA = 5.0   # strength for Cb-channel marks (eye-insensitive to blue)


def embed_watermark_bgr_invisible_reg(
    img_bgr: np.ndarray, wm_id: int, cfg: WMConfig, *, bit_len: int = PAYLOAD_BITS,
    mark_delta: float = INVISIBLE_MARK_DELTA,
) -> Tuple[np.ndarray, dict]:
    """
    Embed tiled BPSK pattern + ultra-low-strength registration marks.

    Strategy:
      - BPSK in Y channel (invisible, fragile to print-camera)
      - Registration marks: embedded at VERY low strength in Y channel corners
        (mark_delta=0.12 gives < 0.12 pixel brightness change, invisible on any background)

    The corner marks survive print-camera degradation because they are isolated from
    content (we clear BPSK in corner regions), and their low-frequency mark pattern
    (large circle + cross) survives Gaussian blur better than high-frequency BPSK.
    """
    h, w = img_bgr.shape[:2]
    wm_id = int(wm_id) & 0xFFF
    bits = build_payload_from_id(wm_id)
    payload_tile = make_payload_pattern(bits, cfg)
    payload = tile_pattern_to_image(payload_tile, h, w)

    yuv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2YUV)
    y = yuv[:, :, 0].astype(np.float32)
    y = y + payload * float(cfg.delta_y)

    # Clear BPSK in corner regions, then embed marks on clean corners
    marks = {
        "tl": make_registration_mark(cfg, "tl"),
        "tr": make_registration_mark(cfg, "tr"),
        "bl": make_registration_mark(cfg, "bl"),
        "br": make_registration_mark(cfg, "br"),
    }
    s = cfg.mark_size
    margin = 12
    positions = {
        "tl": (margin, margin),
        "tr": (w - s - margin, margin),
        "bl": (margin, h - s - margin),
        "br": (w - s - margin, h - s - margin),
    }
    for k, m in marks.items():
        x0, y0 = positions[k]
        # Zero out BPSK at corners
        payload[y0:y0+s, x0:x0+s] = 0.0

    # Rebuild Y with cleared corners
    y = yuv[:, :, 0].astype(np.float32) + payload * float(cfg.delta_y)

    # Add marks at corners on top
    for k, m in marks.items():
        x0, y0 = positions[k]
        y[y0:y0+s, x0:x0+s] += m * mark_delta

    yuv[:, :, 0] = np.clip(y, 0, 255).astype(np.uint8)
    out = cv2.cvtColor(yuv, cv2.COLOR_YUV2BGR)
    meta = {"wm_id": int(wm_id), "bit_len": int(bit_len), "cfg": cfg, "positions": positions}
    return out, meta


def detect_marks_invisible(
    gray_or_bgr: np.ndarray,
    cfg: WMConfig,
    mark_delta: float = INVISIBLE_MARK_DELTA,
    scales: tuple[float, ...] = (0.7, 0.8, 0.9, 1.0, 1.1, 1.2),
) -> dict:
    """
    Detect registration marks from the Y channel (luminance).

    Since marks are embedded in Y channel corners with BPSK cleared, we detect
    using a background-subtracted approach: large blur isolates the mark's
    low-frequency pattern from high-frequency content.

    mark_delta=0.12 in Y = < 0.12 pixel brightness change (essentially invisible).

    Returns corners dict with 'pt' (mark CENTER), 'score', and 'scale'.
    """
    # Extract Y channel
    if len(gray_or_bgr.shape) == 2:
        y = gray_or_bgr.astype(np.float32)
        h, w = y.shape
    else:
        yuv = cv2.cvtColor(gray_or_bgr, cv2.COLOR_BGR2YUV)
        y = yuv[:, :, 0].astype(np.float32)
        h, w = gray_or_bgr.shape[:2]

    s = cfg.mark_size
    margin = 12
    exp_cx = {
        "tl": (float(margin + s // 2), float(margin + s // 2)),
        "tr": (float(w - s - margin + s // 2), float(margin + s // 2)),
        "bl": (float(margin + s // 2), float(h - s - margin + s // 2)),
        "br": (float(w - s - margin + s // 2), float(h - s - margin + s // 2)),
    }

    # Background subtraction: large Gaussian blur to estimate content at mark scale
    # This removes the mark signal (which is at a different spatial scale from content)
    bg = cv2.GaussianBlur(y, (max(3, s // 2) * 2 + 1, max(3, s // 2) * 2 + 1), 0)
    residual = y - bg

    corners = {}
    for kind in ["tl", "tr", "bl", "br"]:
        raw_templ = make_registration_mark(cfg, kind).astype(np.float32)
        # Apply same background subtraction to template
        t_bg = cv2.GaussianBlur(raw_templ, (max(3, s // 2) * 2 + 1, max(3, s // 2) * 2 + 1), 0)
        templ = raw_templ - t_bg
        t_mean = float(np.mean(templ))
        t_std = float(np.std(templ))
        if t_std < 1e-6:
            t_std = 1.0
        t_norm = (templ - t_mean) / t_std

        best_score = -1.0
        best_pt = exp_cx[kind]
        best_scale = 1.0

        for sc in scales:
            ts = int(round(s * sc))
            if ts < 8:
                continue
            t_sc = cv2.resize(t_norm, (ts, ts), interpolation=cv2.INTER_LINEAR)

            ecx, ecy = exp_cx[kind]
            win = int(max(40, s * 2))
            x1 = max(0, int(ecx - win))
            y1 = max(0, int(ecy - win))
            x2 = min(w - ts, int(ecx + win))
            y2 = min(h - ts, int(ecy + win))
            if x2 <= x1 or y2 <= y1:
                continue

            roi = residual[int(y1):int(y1)+ts, int(x1):int(x1)+ts].astype(np.float32)
            roi_norm = (roi - np.mean(roi)) / (np.std(roi) + 1e-6)

            step = max(1, ts // 8)
            for ry in range(0, int(roi_norm.shape[0]) - ts + 1, step):
                for rx in range(0, int(roi_norm.shape[1]) - ts + 1, step):
                    patch = roi_norm[ry:ry+ts, rx:rx+ts]
                    ncc = float(np.mean(patch * t_sc))
                    if ncc > best_score:
                        best_score = ncc
                        best_pt = (x1 + rx + ts / 2, y1 + ry + ts / 2)
                        best_scale = sc

        corners[kind] = {
            "pt": best_pt,
            "score": float(best_score),
            "scale": float(best_scale),
        }

    return corners


def embed_watermark_bgr_no_reg(
    img_bgr: np.ndarray, wm_id: int, cfg: WMConfig, *, bit_len: int = PAYLOAD_BITS
) -> Tuple[np.ndarray, dict]:
    """
    Embed tiled payload ONLY (no registration marks).
    Invisible BPSK pattern in Y channel.
    Decoding requires knowing tile alignment (use default TILE_PX=384 grid).
    Simpler than full reg-mark decode: just extract Y channel and correlate.
    """
    h, w = img_bgr.shape[:2]
    wm_id = int(wm_id) & 0xFFF
    bits = build_payload_from_id(wm_id)
    payload_tile = make_payload_pattern(bits, cfg)
    payload = tile_pattern_to_image(payload_tile, h, w)

    yuv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2YUV)
    y = yuv[:, :, 0].astype(np.float32)
    y = y + payload * float(cfg.delta_y)

    yuv[:, :, 0] = np.clip(y, 0, 255).astype(np.uint8)
    out = cv2.cvtColor(yuv, cv2.COLOR_YUV2BGR)
    meta = {"wm_id": int(wm_id), "bit_len": int(bit_len), "cfg": cfg}
    return out, meta


# When a corner score is below this, treat as missing (e.g. partial upper-only capture)
PARTIAL_MARK_SCORE_THRESHOLD = 0.35


def detect_marks(gray: np.ndarray, cfg: WMConfig) -> dict:
    """Detect 4 marks using template matching. Returns corners dict with 'pt' and 'score' per key."""
    h, w = gray.shape[:2]
    s = cfg.mark_size
    margin = 12
    expected = {
        "tl": (margin, margin),
        "tr": (w - s - margin, margin),
        "bl": (margin, h - s - margin),
        "br": (w - s - margin, h - s - margin),
    }
    # Edge magnitude feature map (abs(Laplacian)), matches a non-signed edge template too
    hp = cv2.Laplacian(gray, cv2.CV_32F, ksize=3)
    hp = np.abs(hp).astype(np.float32)
    hp = hp / (float(np.max(hp)) + 1e-6)
    corners = {}
    for kind in ["tl", "tr", "bl", "br"]:
        templ = make_registration_mark(cfg, kind).astype(np.float32)
        templ = cv2.Laplacian(templ, cv2.CV_32F, ksize=3)
        templ = np.abs(templ).astype(np.float32)
        templ = templ - float(np.mean(templ))  # zero-mean for TM_CCOEFF_NORMED

        ex, ey = expected[kind]  # template top-left expected position in the image

        # Two-stage search:
        # - use a small window to avoid matching random text edges
        # - if score is low, fall back to larger window for stronger distortions
        win_small = int(max(6, cfg.mark_size * 0.45))
        win_large = int(max(10, cfg.mark_size * 0.9))

        def _match(win: int) -> tuple[float, tuple[int, int]]:
            x1 = max(0, ex - win)
            y1 = max(0, ey - win)
            x2 = min(w - s, ex + win)
            y2 = min(h - s, ey + win)
            roi = hp[y1 : y2 + s, x1 : x2 + s]
            res = cv2.matchTemplate(roi, templ.astype(np.float32), cv2.TM_CCOEFF_NORMED)
            # Pick among top-K peaks by "closest to expected position" to avoid
            # random text edges producing slightly higher NCC.
            yy, xx = res.shape[:2]
            vals = res.reshape(-1)
            top_k = int(min(20, vals.size))
            if top_k <= 0:
                return -1.0, (int(x1), int(y1))

            idxs = np.argpartition(vals, -top_k)[-top_k:]
            best = None  # (dist2, -score, px, py)
            for idx in idxs:
                y_idx = int(idx // xx)
                x_idx = int(idx % xx)
                score = float(vals[idx])
                px = int(x1 + x_idx)
                py = int(y1 + y_idx)
                dist2 = (px - ex) * (px - ex) + (py - ey) * (py - ey)
                cand = (dist2, -score, px, py)
                if best is None or cand < best:
                    best = cand
            _, _, px, py = best
            score_out = float(res[py - y1, px - x1])
            return score_out, (px, py)

        score, (px, py) = _match(win_small)
        thresh = 0.25
        if kind in ("bl", "br"):
            # bottom marks are often harder; avoid large-window drift
            thresh = 0.08
        if score < thresh:
            score, (px, py) = _match(win_large)

        corners[kind] = {"pt": (px + s / 2.0, py + s / 2.0), "score": float(score)}
    return corners


def detect_marks_multiscale(
    gray: np.ndarray, cfg: WMConfig, *, scales: list[float]
) -> dict:
    """
    Multi-scale mark detection.
    Returns corners[kind] = {"pt": (cx,cy), "score": float, "scale": best_scale}.
    scale means: observed_mark_px = cfg.mark_size * scale.
    """
    h, w = gray.shape[:2]
    s0 = cfg.mark_size

    # Edge magnitude feature map (better for documents)
    hp = cv2.Laplacian(gray, cv2.CV_32F, ksize=3)
    hp = np.abs(hp).astype(np.float32)
    hp = hp / (float(np.max(hp)) + 1e-6)

    margin_ratio = 0.125  # 12/96 in the default config
    corners: dict = {}
    for kind in ["tl", "tr", "bl", "br"]:
        base_templ = make_registration_mark(cfg, kind).astype(np.float32)
        best = (-1.0, 1.0, (0.0, 0.0))  # (score, scale, (px,py))
        for sc in scales:
            s = int(round(s0 * sc))
            if s < 20 or s >= min(h, w) // 2:
                continue
            templ = cv2.resize(base_templ, (s, s), interpolation=cv2.INTER_LINEAR)
            templ = templ - float(np.mean(templ))
            templ_hp = cv2.Laplacian(templ, cv2.CV_32F, ksize=3)
            templ_hp = np.abs(templ_hp).astype(np.float32)
            templ_hp = templ_hp - float(np.mean(templ_hp))
            templ_hp = templ_hp / (float(np.std(templ_hp)) + 1e-6)

            # Expected top-left position at this scale
            margin = int(round(margin_ratio * s))
            if kind == "tl":
                ex, ey = margin, margin
            elif kind == "tr":
                ex, ey = w - s - margin, margin
            elif kind == "bl":
                ex, ey = margin, h - s - margin
            else:  # br
                ex, ey = w - s - margin, h - s - margin

            # Larger window helps when the photo is cropped / perspective-shifted.
            win_mul = 4.0 if kind in ("bl", "br") else 2.5
            win = int(max(10, s * win_mul))
            x1 = max(0, ex - win)
            y1 = max(0, ey - win)
            x2 = min(w - s, ex + win)
            y2 = min(h - s, ey + win)
            if x2 <= x1 or y2 <= y1:
                continue
            roi = hp[y1 : y2 + s, x1 : x2 + s]
            res = cv2.matchTemplate(roi, templ_hp, cv2.TM_CCOEFF_NORMED)
            _, maxv, _, maxloc = cv2.minMaxLoc(res)
            px = x1 + maxloc[0]
            py = y1 + maxloc[1]
            if float(maxv) > best[0]:
                best = (float(maxv), float(sc), (px + s / 2.0, py + s / 2.0))

        score, sc_best, (cx, cy) = best
        corners[kind] = {"pt": (float(cx), float(cy)), "score": float(score), "scale": float(sc_best)}
    return corners


def complete_corners_for_partial(
    corners: dict, img_h: int, img_w: int, *, scale_factor: float = 1.0, mark_size: int = 96
) -> dict:
    """
    If bottom marks (bl, br) have low score (e.g. only upper part captured), estimate them
    from top marks so we still have a 4-point quad for homography.
    """
    out = {k: dict(v) for k, v in corners.items()}
    tl_x, tl_y = corners["tl"]["pt"]
    tr_x, tr_y = corners["tr"]["pt"]
    # margin used to extrapolate missing bottom corners
    margin = int(round(mark_size * 0.125 * float(scale_factor)))
    if margin <= 0:
        margin = 12
    # Use bottom of image as estimated bottom edge (axis-aligned crop)
    bot_y = float(max(img_h - 1 - margin, tl_y + 50))
    if corners["bl"]["score"] < PARTIAL_MARK_SCORE_THRESHOLD:
        out["bl"] = {"pt": (tl_x, bot_y), "score": 0.0}
    if corners["br"]["score"] < PARTIAL_MARK_SCORE_THRESHOLD:
        out["br"] = {"pt": (tr_x, bot_y), "score": 0.0}
    return out


def compute_warp_size_from_quad(corners: dict, tile_px: int,
                                min_w: int = 0, min_h: int = 0) -> Tuple[int, int]:
    """Compute out_w, out_h from the 4 corners (tile-aligned). Use min_w/min_h to avoid scaling down."""
    tl = np.array(corners["tl"]["pt"], dtype=np.float64)
    tr = np.array(corners["tr"]["pt"], dtype=np.float64)
    br = np.array(corners["br"]["pt"], dtype=np.float64)
    bl = np.array(corners["bl"]["pt"], dtype=np.float64)
    width = float(np.linalg.norm(tr - tl))
    height_left = float(np.linalg.norm(bl - tl))
    height_right = float(np.linalg.norm(br - tr))
    height = (height_left + height_right) * 0.5
    out_w = tile_px * max(1, int(round(width / tile_px)))
    out_h = tile_px * max(1, int(round(height / tile_px)))
    if min_w > 0 or min_h > 0:
        out_w = max(out_w, min_w)
        out_h = max(out_h, min_h)
        out_w = tile_px * max(1, out_w // tile_px)
        out_h = tile_px * max(1, out_h // tile_px)
    return out_w, out_h


def warp_to_rect(gray: np.ndarray, corners: dict, out_w: int, out_h: int) -> Tuple[np.ndarray, np.ndarray]:
    """Compute homography and warp."""
    src = np.array([corners["tl"]["pt"], corners["tr"]["pt"], corners["br"]["pt"], corners["bl"]["pt"]], dtype=np.float32)
    dst = np.array([[0, 0], [out_w - 1, 0], [out_w - 1, out_h - 1], [0, out_h - 1]], dtype=np.float32)
    H = cv2.getPerspectiveTransform(src, dst)
    # Use nearest-neighbor to avoid smearing low-amplitude luminance modulation.
    warped = cv2.warpPerspective(gray, H, (out_w, out_h), flags=cv2.INTER_NEAREST)
    return warped, H


def warp_bgr_to_rect(img_bgr: np.ndarray, corners: dict, out_w: int, out_h: int) -> Tuple[np.ndarray, np.ndarray]:
    """Compute homography from detected corners and warp a BGR image."""
    src = np.array([corners["tl"]["pt"], corners["tr"]["pt"], corners["br"]["pt"], corners["bl"]["pt"]], dtype=np.float32)
    dst = np.array([[0, 0], [out_w - 1, 0], [out_w - 1, out_h - 1], [0, out_h - 1]], dtype=np.float32)
    H = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(img_bgr, H, (out_w, out_h), flags=cv2.INTER_NEAREST)
    return warped, H


def _decode_single_phase(hp: np.ndarray, cfg: WMConfig, bit_len: int, tile_px: int,
                         weight_by_smooth: bool = False) -> np.ndarray:
    """Aggregate votes over full tiles. If weight_by_smooth, use 1/(1+var/400) to downweight text."""
    h, w = hp.shape[:2]
    cell_sz = tile_px // cfg.tile_size
    votes = np.zeros(bit_len, np.float32)
    counts = np.zeros(bit_len, np.float32)
    ny = h // tile_px
    nx = w // tile_px
    if ny == 0 or nx == 0:
        return (np.zeros(bit_len, np.float32) >= 0).astype(np.uint8)
    for iy in range(ny):
        for ix in range(nx):
            y0, y1 = iy * tile_px, (iy + 1) * tile_px
            x0, x1 = ix * tile_px, (ix + 1) * tile_px
            block = hp[y0:y1, x0:x1]
            cell_img = cv2.resize(block, (cfg.tile_size, cfg.tile_size), interpolation=cv2.INTER_AREA)
            for ci in range(cfg.tile_size):
                for cj in range(cfg.tile_size):
                    bi = (ci * cfg.tile_size + cj) % bit_len
                    v = cell_img[ci, cj]
                    if weight_by_smooth:
                        sy, sx = ci * cell_sz, cj * cell_sz
                        var = float(np.var(block[sy:sy + cell_sz, sx:sx + cell_sz]))
                        w = 1.0 / (1.0 + var / 400.0)
                    else:
                        w = 1.0
                    votes[bi] += v * w
                    counts[bi] += w
    mean = votes / np.maximum(1e-9, counts)
    bits = (mean >= 0).astype(np.uint8)
    return bits, mean


def decode_from_warped(
    warped_gray: np.ndarray,
    cfg: WMConfig,
    bit_len: int = PAYLOAD_BITS,
    tta_phases: int = 5,
    *,
    tile_px_override: int | None = None,
    k_size_candidates: tuple[int, ...] | None = None,
    enable_smooth: bool = False,
) -> Tuple[bool, int, int, np.ndarray]:
    """
    Multi-tile decode with TTA: try a few spatial phases (roll), vote per bit, then CRC check.
    Returns (crc_ok, userid, time_val, bits16).
    """
    base_tile_px = int(cfg.tile_size * cfg.cell_px)  # expected 384
    tile_px = int(tile_px_override) if tile_px_override is not None else base_tile_px
    scale_factor = float(tile_px) / float(base_tile_px) if tile_px_override is not None else 1.0
    y = warped_gray.astype(np.float32)
    h, w = y.shape[:2]
    best_bits = None
    best_crc = False
    best_userid = best_time = 0
    # Collect (userid, time) from all kernel sizes and polarities that pass CRC; use consensus
    crc_results: list = []  # (userid, time, bits, confidence)
    # TTA shifts: try both coarse tile-boundary shifts and fine intra-tile shifts.
    # This addresses homography alignment error that can be smaller than a full cell.
    cell = max(1, int(round(tile_px / cfg.tile_size)))
    coarse_shifts = [0]
    if tta_phases > 1:
        coarse_shifts = [int(round(i * tile_px / tta_phases)) % tile_px for i in range(tta_phases)]
    fine_shifts = sorted({0, cell // 2, cell, (cell * 3) // 2, cell * 2})
    shift_candidates = sorted({s for s in coarse_shifts + fine_shifts if 0 <= s < tile_px})

    # Wider kernel sweep to survive stronger blur/resampling (screen capture)
    # Scale kernel sizes with estimated pixel scale.
    base_k_sizes = k_size_candidates if k_size_candidates is not None else (0, 21, 31, 41, 51, 61, 71, 101, 131, 151, 181, 201, 251)
    k_sizes_scaled = []
    for v in base_k_sizes:
        if v == 0:
            k_sizes_scaled.append(0)
        else:
            k_sizes_scaled.append(int(round(v * scale_factor)))
    # Dedup while preserving order
    seen = set()
    k_candidates = []
    for k in k_sizes_scaled:
        if k not in seen:
            k_candidates.append(k)
            seen.add(k)

    for k_size in k_candidates:
        if k_size <= 0:
            hp = y - np.mean(y)
        else:
            if k_size % 2 == 0:
                k_use = k_size + 1
            else:
                k_use = k_size
            local = cv2.GaussianBlur(y, (k_use, k_use), k_use / 3.0)
            hp = y - local
        if k_size > 0:
            hp = cv2.GaussianBlur(hp, (0, 0), 0.6)
        hp = hp / (np.std(hp) + 1e-6)
        # Mask out registration mark corners so they don't dominate payload correlation
        # Mark region masking should be small; too large will remove payload votes
        m = int(max(0, cfg.mark_size * 0.45))
        if m > 0 and h > m * 2 and w > m * 2:
            hp[:m, :m] = 0
            hp[:m, w - m : w] = 0
            hp[h - m : h, :m] = 0
            hp[h - m : h, w - m : w] = 0
        all_bits = []
        for shift in shift_candidates:
            if shift > 0:
                hp_shifted = np.roll(hp, (-shift, -shift), axis=(0, 1))[: (h - shift), : (w - shift)]
            else:
                hp_shifted = hp
            nh, nw = hp_shifted.shape[0] // tile_px, hp_shifted.shape[1] // tile_px
            if nh > 0 and nw > 0:
                bits, mean = _decode_single_phase(hp_shifted, cfg, bit_len, tile_px)
                all_bits.append(bits)
                # Check CRC per-shift to avoid majority-vote dilution
                for bits_candidate in (bits, 1 - bits):
                    crc_ok, userid, time_val = check_and_extract_id(bits_candidate)
                    if crc_ok:
                        conf = float(np.sum(np.abs(mean)))
                        crc_results.append((int(userid), int(time_val), bits_candidate, conf))

        # Majority vote fallback estimate (used only if no CRC candidate exists)
        if not all_bits:
            bits01 = np.zeros(bit_len, dtype=np.uint8)
        else:
            stacked = np.stack(all_bits, axis=0)
            bits01 = (np.sum(stacked, axis=0) > (len(all_bits) / 2.0)).astype(np.uint8)
        # Also CRC-check the majority-vote result (more robust under heavy noise)
        for bits_candidate in (bits01, 1 - bits01):
            crc_ok, userid, time_val = check_and_extract_id(bits_candidate)
            if crc_ok:
                # Majority vote candidate confidence not computed; use low default.
                crc_results.append((int(userid), int(time_val), bits_candidate, 0.0))
        # Smooth-weighted decode (downweight text) is expensive on large phone photos.
        # Enable explicitly when needed.
        if enable_smooth:
            nh0, nw0 = hp.shape[0] // tile_px, hp.shape[1] // tile_px
            if nh0 > 0 and nw0 > 0:
                bits_smooth, mean_smooth = _decode_single_phase(
                    hp, cfg, bit_len, tile_px, weight_by_smooth=True
                )
                for bits_candidate in (bits_smooth, 1 - bits_smooth):
                    crc_ok, userid, time_val = check_and_extract_id(bits_candidate)
                    if crc_ok:
                        conf = float(np.sum(np.abs(mean_smooth)))
                        crc_results.append((int(userid), int(time_val), bits_candidate, conf))
        best_bits = bits01
        best_crc, best_userid, best_time = check_and_extract_id(bits01)
    if crc_results:
        # Return the CRC-ok candidate with the strongest residual confidence.
        best = max(crc_results, key=lambda x: x[3])
        return True, int(best[0]), int(best[1]), best[2]
    return best_crc, best_userid, best_time, best_bits if best_bits is not None else np.zeros(bit_len, dtype=np.uint8)


# ---------------------------------------------------------------------------
# No-registration-mark decode (for images embedded with embed_watermark_bgr_no_reg)
# ---------------------------------------------------------------------------

def decode_from_image_no_reg(
    img_bgr: np.ndarray,
    cfg: WMConfig,
    *,
    tile_px: int = TILE_PX,
    bit_len: int = PAYLOAD_BITS,
    tta_phases: int = 4,
    k_size_candidates: tuple[int, ...] | None = None,
) -> Tuple[bool, int, int, np.ndarray]:
    """
    Decode wm_id from an image embedded WITHOUT registration marks.
    Uses high-pass filter (Laplacian) to extract the BPSK watermark signal from Y channel.
    Then multi-phase TTA + majority vote + CRC check.

    Returns: (crc_ok, userid, time_val, bits)
    """
    # Extract Y channel
    yuv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2YUV)
    y = yuv[:, :, 0].astype(np.float32)
    h, w = y.shape

    # High-pass filter to isolate watermark signal (same as original decode_from_warped)
    if k_size_candidates is None:
        k_sizes = (0, 21, 31, 41, 51, 71, 101)
    else:
        k_sizes = k_size_candidates

    best_bits = None
    best_crc = False
    best_userid = best_time = 0
    crc_results: list = []

    # TTA: try a few spatial offsets for the tile grid
    phase_shifts = sorted(set(
        int(round(i * tile_px / tta_phases)) % tile_px for i in range(tta_phases)
    ))

    cell = max(1, int(round(tile_px / cfg.tile_size)))

    for k_size in k_sizes:
        if k_size == 0:
            hp = y - np.mean(y)
        else:
            k_use = k_size if k_size % 2 == 1 else k_size + 1
            blurred = cv2.GaussianBlur(y, (k_use, k_use), 0)
            hp = y - blurred

        hp = hp.astype(np.float32)

        for shift_px in phase_shifts:
            bits_votes = np.zeros(bit_len, np.float32)
            bits_counts = np.zeros(bit_len, np.float32)

            for r in range(0, h - tile_px + 1, tile_px):
                for c in range(0, w - tile_px + 1, tile_px):
                    ry0, ry1 = r + shift_px, r + shift_px + tile_px
                    rx0, rx1 = c + shift_px, c + shift_px + tile_px
                    if ry1 > h or rx1 > w:
                        continue

                    tile = hp[ry0:ry1, rx0:rx1]

                    # Decode each cell: positive HP => bit 1, negative => bit 0
                    for ci in range(cfg.tile_size):
                        for cj in range(cfg.tile_size):
                            by0, by1 = ci * cell, (ci + 1) * cell
                            bx0, bx1 = cj * cell, (cj + 1) * cell
                            cell_val = np.mean(tile[by0:by1, bx0:bx1])
                            bi = (ci * cfg.tile_size + cj) % bit_len
                            if cell_val >= 0:
                                bits_votes[bi] += 1
                            else:
                                bits_votes[bi] -= 1
                            bits_counts[bi] += 1

            if np.max(bits_counts) == 0:
                continue

            bits01 = (bits_votes > 0).astype(np.uint8)

            # CRC check both polarities
            for bits_candidate in (bits01, 1 - bits01):
                crc_ok, userid, time_val = check_and_extract_id(bits_candidate)
                if crc_ok:
                    conf = float(np.mean(np.abs(bits_votes)))
                    crc_results.append((int(userid), int(time_val), bits_candidate, conf))

            if best_bits is None:
                best_bits = bits01
                best_crc, best_userid, best_time = check_and_extract_id(bits01)

    if crc_results:
        best = max(crc_results, key=lambda x: x[3])
        return True, int(best[0]), int(best[1]), best[2]
    return best_crc, best_userid, best_time, best_bits if best_bits is not None else np.zeros(bit_len, dtype=np.uint8)

