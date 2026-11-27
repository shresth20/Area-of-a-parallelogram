#!/usr/bin/env python3
"""
Rebuild Swiftee's idle + talk clips as one stable "face" sheet.

WHY
  The shipped sheets are AI-drawn: every cell is a separate drawing, so even
  where the bird is meant to stand still its eyes change size, the pupils
  wander, the beak reshapes and the head drifts 2-11px from cell to cell.
  Played at 20fps that reads as boiling / jerking, and the face looks like it
  is twitching far too fast.

WHAT THIS DOES
  Every idle and talk frame is rebuilt on ONE drawing - the rest pose that
  every *_start clip opens on and every *_stop clip ends on (blinking cell 10)
  - so the body, helmet and eyes never move by a pixel.  Only the parts that
  are meant to change are lifted from the original drawings:

    mouth   the beak region of each talking cell, aligned onto the rest face
            (head tracked for x, y and scale) and feather-blended in, with its
            colour matched to the rest face around the seam
    blink   the eye region of the drawn blink cells, the same way

  The result is a small sheet of unique cells.  The clips are then SEQUENCES
  over those cells (see SEQ in js/mascot.js), played at a natural pace: a
  mouth that changes ~10 times a second, blinks every few seconds.

  The rest cell is the same drawing the mood clips start and end on, so going
  idle -> wave_start, or celebrate_stop -> idle, still joins without a jump.

Run (from this folder):
  python3 mascot_rebuild.py            build the sheet
  python3 mascot_rebuild.py --preview  also write preview GIFs + a contact
                                       sheet into --out-preview=DIR

Needs numpy, scipy, Pillow.  Output is committed; the game never runs this.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

import sprite_stabilizer as S

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "assets/astronaut-swiftee-assets/spritesheets/2x"
OUT = ROOT / "assets/astronaut-swiftee-assets/spritesheets/stable"
CELL = 512

# clip: (frames, cols) of the source sheets this tool reads
SOURCE = {"blinking": (40, 7), "talking": (8, 3)}

REST = ("blinking", 10)            # the shared rest pose
HEAD_PT = (257.0, 140.0)           # head reference point in the rest cell
HEAD_BOX = (114, 60, 402, 205)     # helmet + crest + eyes (no mouth)
EYES = ((212, 222), (302, 222))    # eye centres in the rest cell
EYE_R = 41                         # eye disc radius (outer pale ring)
BEAK_C = (262.5, 233.0)            # beak centre in the rest cell
BEAK_AX = (27.0, 31.0)             # minimum mouth ellipse (the closed beak + margin)
MOUTH_SEARCH = (44.0, 52.0)        # how far an open mouth may reach from BEAK_C

# The cells of the output sheet, in order: (name, eyes-from, mouth-from).
# None = keep the rest drawing for that part.
CELLS = [
    ("rest",        None,              None),
    ("blink_half",  ("blinking", 28),  None),
    ("blink_shut",  ("blinking", 29),  None),
    ("blink_open",  ("blinking", 31),  None),
    ("mouth_small", None,              ("talking", 1)),
    ("mouth_mid",   None,              ("talking", 6)),
    ("mouth_wide",  None,              ("talking", 2)),
    ("mouth_o",     None,              ("talking", 4)),
    ("mouth_smile", None,              ("talking", 0)),
]
COLS = 3


def load_sheet(clip):
    return np.array(Image.open(SRC / f"swiftee_{clip}@2x.webp").convert("RGBA"))


_sheets = {}


def frame(clip, i):
    if clip not in _sheets:
        _sheets[clip] = load_sheet(clip)
    n, cols = SOURCE[clip]
    r, c = divmod(i, cols)
    return _sheets[clip][r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL].copy()


def ellipse(cx, cy, ax, ay):
    yy, xx = np.mgrid[0:CELL, 0:CELL].astype(np.float32)
    return ((xx - cx) / ax) ** 2 + ((yy - cy) / ay) ** 2 <= 1.0


def feather(mask, sigma):
    return np.clip(ndimage.gaussian_filter(mask.astype(np.float32), sigma), 0, 1)


def aligned(rest, src):
    """`src` warped so its head sits exactly on the rest cell's head."""
    head = S.Part(rest, HEAD_BOX, HEAD_PT)
    hx, hy, s, score, _ = head.find(src, scales=np.linspace(0.95, 1.07, 49),
                                    region=(60, 20, 452, 260))
    if score < 0.85:
        raise SystemExit(f"head match too weak ({score:.3f}) - check the source sheet")
    # src -> rest: x_rest = (x_src - hx) / s + HEAD_PT.x
    m = (1 / s, 0, HEAD_PT[0] - hx / s, 0, 1 / s, HEAD_PT[1] - hy / s)
    return S.warp(src, m, (CELL, CELL)), (hx, hy, s, score)


def mouth_pixels(a):
    """Beak + open mouth: the warm pixels (red over green - orange beak, red
    mouth, pink tongue, dark-red throat) around the beak; the teal face, the
    cream eyes and the dark pupils are all excluded."""
    rgb = a[..., :3].astype(np.int16)
    warm = (rgb[..., 0] > rgb[..., 1] + 25) & (a[..., 3] > 200)
    warm &= ellipse(*BEAK_C, *MOUTH_SEARCH)
    lab, n = ndimage.label(warm)
    if n == 0:
        return warm
    keep = lab[int(BEAK_C[1]), int(BEAK_C[0])]
    if keep == 0:
        keep = 1 + int(np.argmax(ndimage.sum(warm, lab, range(1, n + 1))))
    return ndimage.binary_fill_holes(lab == keep)


def blend(base, part, w, ring):
    """Feather `part` into `base` with weight `w` (premultiplied), after
    shifting the part's colour so it matches the base in the `ring` band."""
    a0 = base[..., 3:4].astype(np.float32) / 255
    a1 = part[..., 3:4].astype(np.float32) / 255
    p0 = base[..., :3].astype(np.float32) * a0
    p1 = part[..., :3].astype(np.float32) * a1
    if ring.sum() > 40:
        # match the redraw's face tone to the rest face around the seam;
        # robust and clamped, so a stray mouth pixel cannot tint the part
        shift = np.clip(np.median(p0[ring] - p1[ring], 0), -14, 14)
        p1 = p1 + shift * a1
    w = w[..., None]
    pa = p0 * (1 - w) + p1 * w
    aa = a0 * (1 - w) + a1 * w
    rgb = pa / np.maximum(aa, 1e-3)
    out = np.dstack([np.clip(rgb, 0, 255), np.clip(aa * 255, 0, 255)])
    out[aa[..., 0] < 0.004] = 0
    out = out.round().astype(np.uint8)
    # outside the mask the base is kept bit for bit
    return np.where(w > 0, out, base)


def build():
    rest = frame(*REST)
    beak = ellipse(*BEAK_C, *BEAK_AX)
    eyes = ellipse(*EYES[0], EYE_R, EYE_R) | ellipse(*EYES[1], EYE_R, EYE_R)

    rest_mouth = mouth_pixels(rest)
    # weights: hard core, soft ~3px edge. The eyes run right under the beak
    # (the rest drawing's eye whites must not peek out beside it), and the
    # rest beak is then laid back on top, as it sits in the drawing.
    eyes_w = feather(eyes, 2.2)
    # the solid beak only: its anti-aliased rim is blended with the eye
    # whites behind it in the rest drawing, and would bring a pale halo along
    beak_on_top = feather(rest_mouth, 0.7)
    no_ring = np.zeros_like(eyes)
    eyes_ring = ndimage.binary_dilation(eyes, iterations=6) & ~ndimage.binary_dilation(eyes, iterations=2) & ~beak

    cells, log = [], []
    for name, eyes_from, mouth_from in CELLS:
        out = rest.copy()
        if eyes_from:
            part, t = aligned(rest, frame(*eyes_from))
            out = blend(out, part, eyes_w, eyes_ring & (rest[..., 3] > 250))
            out = blend(out, rest, beak_on_top, no_ring)
            log.append(f"  {name:12s} eyes  <- {eyes_from}  head dx={t[0]-HEAD_PT[0]:+.2f} dy={t[1]-HEAD_PT[1]:+.2f} s={t[2]:.3f} ncc={t[3]:.3f}")
        if mouth_from:
            part, t = aligned(rest, frame(*mouth_from))
            # the mask covers the rest beak AND the new mouth, however wide
            m = beak | ndimage.binary_dilation(rest_mouth | mouth_pixels(part), iterations=4)
            ring = ndimage.binary_dilation(m, iterations=5) & ~ndimage.binary_dilation(m, iterations=1) & ~eyes
            ring &= (rest[..., 3] > 250) & ~mouth_pixels(part) & ~rest_mouth
            out = blend(out, part, feather(m, 2.2), ring)
            log.append(f"  {name:12s} mouth <- {mouth_from}  head dx={t[0]-HEAD_PT[0]:+.2f} dy={t[1]-HEAD_PT[1]:+.2f} s={t[2]:.3f} ncc={t[3]:.3f}")
        cells.append(out)

    rows = (len(cells) + COLS - 1) // COLS
    sheet = np.zeros((rows * CELL, COLS * CELL, 4), np.uint8)
    for i, c in enumerate(cells):
        r, k = divmod(i, COLS)
        sheet[r * CELL:(r + 1) * CELL, k * CELL:(k + 1) * CELL] = c

    OUT.mkdir(parents=True, exist_ok=True)
    dst = OUT / "swiftee_face@2x.webp"
    # lossless: the body must be bit-identical in every cell, or the
    # encoder's per-block noise shimmers on it as the mouth changes
    Image.fromarray(sheet).save(dst, "WEBP", lossless=True, quality=100, method=6, exact=True)
    print("\n".join(log))
    print(f"wrote {dst.relative_to(ROOT)}  {COLS}x{rows} cells, {dst.stat().st_size // 1024} KB")
    print("cells: " + ", ".join(f"{i}={n}" for i, (n, _, _) in enumerate(CELLS)))
    return cells


def preview(cells, outdir):
    """Contact sheet + GIFs of the new idle/talk next to the old ones, on the
    game's dark backdrop, for eyeballing."""
    outdir = Path(outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    def on_bg(a, size=320):
        bg = Image.new("RGBA", (CELL, CELL), (30, 32, 58, 255))
        bg.alpha_composite(Image.fromarray(a))
        return bg.convert("RGB").resize((size, size), Image.LANCZOS)

    sheet = Image.new("RGB", (len(cells) * 240, 240))
    for i, c in enumerate(cells):
        sheet.paste(on_bg(c, 240), (i * 240, 0))
    sheet.save(outdir / "face_cells.png")

    # the sequences are read from js/mascot.js so the preview is what plays
    import json
    import re
    js = (ROOT / "js/mascot.js").read_text()
    m = re.search(r"/\*SEQ-JSON\*/(.*?)/\*END-SEQ-JSON\*/", js, re.S)
    seqs = json.loads(m.group(1)) if m else {}
    for clip, spec in seqs.items():
        seq = [cell for cell, n in spec["runs"] for _ in range(n)]
        frames = [on_bg(cells[i]) for i in seq]
        frames[0].save(outdir / f"new_{clip}.gif", save_all=True, append_images=frames[1:],
                       duration=round(1000 / spec["fps"]), loop=0, disposal=1)
    for clip, (n, _) in SOURCE.items():
        frames = [on_bg(frame(clip, i)) for i in range(n)]
        frames[0].save(outdir / f"old_{clip}.gif", save_all=True, append_images=frames[1:],
                       duration=50, loop=0, disposal=1)
    print(f"previews in {outdir}")


if __name__ == "__main__":
    cells = build()
    pv = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--out-preview=")), None)
    if "--preview" in sys.argv or pv:
        preview(cells, pv or (ROOT / "tools/tools/preview"))
