#!/usr/bin/env python3
import argparse
import os

import cv2
import numpy as np


def _perspective(img, strength: float):
    h, w = img.shape[:2]
    m = int(min(h, w) * 0.04 * strength)
    jitter = int(min(h, w) * 0.08 * strength)
    src = np.float32([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]])
    dst = np.float32([
        [np.random.randint(0, m + 1), np.random.randint(0, m + 1)],
        [w - 1 - np.random.randint(0, m + 1), np.random.randint(0, m + 1)],
        [w - 1 - np.random.randint(0, m + 1), h - 1 - np.random.randint(0, m + 1)],
        [np.random.randint(0, m + 1), h - 1 - np.random.randint(0, m + 1)],
    ])
    # add skew
    dst += np.random.uniform(-jitter, jitter, dst.shape).astype(np.float32)
    M = cv2.getPerspectiveTransform(src, dst)
    out = cv2.warpPerspective(img, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return out


def _moire(img, strength: float):
    # Simple moire-ish overlay: sinusoidal high-frequency pattern (not physically accurate)
    if strength <= 0:
        return img
    h, w = img.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    freq = 0.08 + 0.22 * strength
    angle = np.deg2rad(15 + 30 * strength)
    u = xx * np.cos(angle) + yy * np.sin(angle)
    patt = (np.sin(u * freq * 2 * np.pi) * 0.5 + 0.5)
    patt = (patt * 2 - 1)[:, :, None]
    out = img.astype(np.float32) + patt * (8.0 * strength)
    return np.clip(out, 0, 255).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_path", required=True)
    ap.add_argument("--out", dest="out_path", required=True)
    ap.add_argument("--preset", choices=["default", "moire"], default="default")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    np.random.seed(args.seed)
    img = cv2.imread(args.in_path, cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"Failed to read: {args.in_path}")

    out = _perspective(img, 0.7)
    # resample down/up
    h, w = out.shape[:2]
    s = 0.65
    small = cv2.resize(out, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    out = cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR)
    out = cv2.GaussianBlur(out, (3, 3), 0.9)
    if args.preset == "moire":
        out = _moire(out, 0.6)
    # jpeg
    os.makedirs(os.path.dirname(args.out_path) or ".", exist_ok=True)
    cv2.imwrite(args.out_path, out, [int(cv2.IMWRITE_JPEG_QUALITY), 55])
    print("OK")
    print("out:", os.path.abspath(args.out_path))


if __name__ == "__main__":
    main()

