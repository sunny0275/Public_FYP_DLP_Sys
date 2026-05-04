import cv2
import numpy as np
from pathlib import Path

from wm_core import WMConfig, embed_watermark_bgr


def main() -> None:
    img_path = (
        Path(__file__).resolve().parents[2]
        / "docs"
        / "llm-test-samples"
        / "images"
        / "sample_confidential_0424.png"
    )
    img = cv2.imread(str(img_path), cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"Failed to read: {img_path}")

    # userid=100, time=5 => wm_id=1605
    wm_id = 1605
    cfg = WMConfig()
    wm_bgr, _ = embed_watermark_bgr(img, wm_id, cfg)

    # minimal attack parameters (aligned with test_pipeline.py)
    import simulate_recapture as sim

    strength, scale, blur_k, jpeg_q = 0.2, 0.92, 0.3, 82
    attacked = sim._perspective(wm_bgr, strength)
    h, w = attacked.shape[:2]
    attacked = cv2.resize(attacked, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    attacked = cv2.resize(attacked, (w, h), interpolation=cv2.INTER_LINEAR)
    attacked = cv2.GaussianBlur(attacked, (3, 3), blur_k)
    attacked = attacked.clip(0, 255).astype(np.uint8)

    out_dir = Path(__file__).resolve().parent / "out"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_original = out_dir / "minimal_original.png"
    out_wm = out_dir / "minimal_watermarked.png"
    out_attacked = out_dir / "minimal_attacked.jpg"
    out_compare = out_dir / "minimal_attack_compare.png"

    cv2.imwrite(str(out_original), img)
    cv2.imwrite(str(out_wm), wm_bgr)
    cv2.imwrite(str(out_attacked), attacked, [int(cv2.IMWRITE_JPEG_QUALITY), int(jpeg_q)])

    # Create a side-by-side comparison image (resize to common height)
    def _resize_keep_aspect(im: np.ndarray, target_h: int) -> np.ndarray:
        hh, ww = im.shape[:2]
        tw = int(round(ww * (target_h / hh)))
        return cv2.resize(im, (tw, target_h), interpolation=cv2.INTER_AREA)

    target_h = 480
    ims = [img, wm_bgr, attacked]
    ims = [_resize_keep_aspect(im, target_h) for im in ims]
    # Pad to same height
    maxw = max(im.shape[1] for im in ims)
    padded = []
    for im in ims:
        pad_w = maxw - im.shape[1]
        padded.append(cv2.copyMakeBorder(im, 0, 0, 0, pad_w, borderType=cv2.BORDER_CONSTANT, value=(255, 255, 255)))
    compare = cv2.hconcat(padded)
    cv2.imwrite(str(out_compare), compare)

    print("OK")
    print("original:", out_original)
    print("watermarked:", out_wm)
    print("attacked:", out_attacked)
    print("compare:", out_compare)


if __name__ == "__main__":
    main()

