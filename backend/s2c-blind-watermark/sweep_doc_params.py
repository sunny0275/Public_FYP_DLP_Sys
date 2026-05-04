import cv2
from pathlib import Path

from wm_core import WMConfig, detect_marks, decode_from_warped, embed_watermark_bgr, warp_to_rect


def main() -> None:
    img_path = (
        Path(__file__).resolve().parents[2]
        / "docs"
        / "llm-test-samples"
        / "images"
        / "sample_confidential_0336.png"
    )
    img = cv2.imread(str(img_path), cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"Failed to read: {img_path}")

    wm_id = 1605  # userid=100, time=5
    exp_uid, exp_t = 100, 5

    for blur in [0.0, 0.3, 0.6, 0.9, 1.2]:
        for dy in [16.0, 18.0, 20.0, 22.0, 24.0]:
            for mark_dy in [10.0, 12.0, 14.0]:
                cfg = WMConfig(blur_sigma=blur, delta_y=dy, mark_delta_y=mark_dy)
                wm, _ = embed_watermark_bgr(img, wm_id, cfg)
                gray = cv2.cvtColor(wm, cv2.COLOR_BGR2GRAY)
                corners = detect_marks(gray, cfg)
                warped, _ = warp_to_rect(gray, corners, img.shape[1], img.shape[0])
                ok, uid, t, _ = decode_from_warped(warped, cfg)
                hit = ok and uid == exp_uid and t == exp_t
                print(
                    f"blur={blur:.1f} dy={dy:.1f} mark_dy={mark_dy:.1f} "
                    f"ok={ok} uid={uid} t={t} hit={hit}"
                )


if __name__ == "__main__":
    main()

