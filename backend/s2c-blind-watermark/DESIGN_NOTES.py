"""
Anti-Removal Dynamic Watermark Design for s2c_blind_wm

PROBLEM SUMMARY:
  - mark_delta=0.12 in Y: SNR≈0.01, undetectable even with bg-subtraction
  - mark_delta=5.0 in Cb: YUV Cr channel doesn't work as expected
  - Print-camera kills BPSK without registration marks
  - Clean corners can't isolate mark signal from content

SOLUTION: Use a TWO-TRACK system

Track 1: SOFT VISIBLE marks (anti-removal)
  - mark_delta=0.5 in Y, marks ONLY in the white corner margins
  - White margins = near-uniform background
  - marks are VERY subtle (0.5 pixel brightness = barely visible)
  - Designed: multiple concentric circles at 45° rotation
  - Anti-removal: pattern is embedded at multiple scales and rotations
  - Decoding: Laplacian edge detection finds the circles

Track 2: BPSK blind watermark (invisible, fragile)
  - Full BPSK in Y channel (delta_y=0.8)
  - Survives: screen capture, JPEG compression
  - Degrades: print-photo, rotation
  - No registration marks needed for screen capture use case

The key insight: For SCREEN CAPTURE use case (no registration marks needed).
For PRINT-PHOTO use case: use the visible corner marks as alignment reference.
"""
