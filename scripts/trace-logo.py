"""Trace a raster logo into an SVG in the logo's own colours, with a transparent background.

Used for the partner marks on the app Home wheel (public/brand/partners/svg/): the marks sit straight on the card,
with no white tile around them. The logo's colours are kept as they are.

  python scripts/trace-logo.py <in.png> <out.svg> [--field alpha|ink] [--colors 6] [--layer field:level:#hex] ...

How: upscale smoothly; marching squares with sub-pixel interpolation; link the segments into closed rings; simplify
(Ramer-Douglas-Peucker). Each ring takes the logo's colour under it (snapped to a palette of the logo's main colours,
so a letter and its hole share one colour); rings of one colour form one path with fill-rule evenodd.
--layer adds an extra shape of one exact colour on top (for logos in several shades of one colour).
Fields: alpha = visible pixels; ink = pixels that aren't white (logo on a white tile);
green = brightness inside a saturated mark (for shade layers). Needs only numpy + Pillow.
"""
import argparse
import numpy as np
from PIL import Image


def field_of(a: np.ndarray, kind: str) -> np.ndarray:
    alpha = a[..., 3]
    if kind == "alpha":
        return alpha
    ink = np.clip((1.0 - a[..., :3].min(axis=2)) * 1.6, 0, 1) * alpha
    if kind == "green":  # only fully saturated pixels: edges blended with white drop out
        mx = a[..., :3].max(axis=2)
        sat = (mx - a[..., :3].min(axis=2)) / np.maximum(mx, 1e-6)
        return a[..., 1] * np.clip((sat - 0.75) / 0.15, 0, 1) * alpha
    return ink


def march(f: np.ndarray, level: float):
    """Marching squares: line segments ((y,x),(y,x)) with interpolated end points."""
    tl, tr, br, bl = f[:-1, :-1], f[:-1, 1:], f[1:, 1:], f[1:, :-1]
    idx = (tl > level) * 8 + (tr > level) * 4 + (br > level) * 2 + (bl > level) * 1

    def lerp(v0, v1):
        d = v1 - v0
        return 0.5 if d == 0 else (level - v0) / d

    def pt(edge, y, x):
        if edge == "t": return (y, x + lerp(f[y, x], f[y, x + 1]))
        if edge == "r": return (y + lerp(f[y, x + 1], f[y + 1, x + 1]), x + 1)
        if edge == "b": return (y + 1, x + lerp(f[y + 1, x], f[y + 1, x + 1]))
        return (y + lerp(f[y, x], f[y + 1, x]), x)

    table = {1: [("l", "b")], 2: [("b", "r")], 3: [("l", "r")], 4: [("t", "r")], 5: [("l", "t"), ("b", "r")],
             6: [("t", "b")], 7: [("l", "t")], 8: [("l", "t")], 9: [("t", "b")], 10: [("t", "r"), ("l", "b")],
             11: [("t", "r")], 12: [("l", "r")], 13: [("b", "r")], 14: [("l", "b")]}
    segs = []
    ys, xs = np.nonzero((idx > 0) & (idx < 15))
    for y, x in zip(ys.tolist(), xs.tolist()):
        for e0, e1 in table[int(idx[y, x])]:
            segs.append((pt(e0, y, x), pt(e1, y, x)))
    return segs


def link(segs):
    key = lambda p: (round(p[0], 6), round(p[1], 6))
    adj = {}
    for i, (a, b) in enumerate(segs):
        adj.setdefault(key(a), []).append(i)
        adj.setdefault(key(b), []).append(i)
    used = [False] * len(segs)
    rings = []
    for s in range(len(segs)):
        if used[s]:
            continue
        used[s] = True
        a, b = segs[s]
        ring, cur = [a, b], b
        while True:
            nxt = next((j for j in adj.get(key(cur), []) if not used[j]), None)
            if nxt is None:
                break
            used[nxt] = True
            p, q = segs[nxt]
            cur = q if key(p) == key(cur) else p
            ring.append(cur)
        if len(ring) > 4:
            rings.append(np.asarray(ring))
    return rings


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    stack = [(0, len(pts) - 1)]
    keep = np.zeros(len(pts), bool)
    keep[0] = keep[-1] = True
    while stack:
        s, e = stack.pop()
        if e <= s + 1:
            continue
        a, b = pts[s], pts[e]
        ab = b - a
        n = np.hypot(*ab)
        seg = pts[s + 1:e]
        d = np.abs(ab[0] * (seg[:, 1] - a[1]) - ab[1] * (seg[:, 0] - a[0])) / n if n else np.hypot(*(seg - a).T)
        k = int(np.argmax(d))
        if d[k] > eps:
            keep[s + 1 + k] = True
            stack += [(s, s + 1 + k), (s + 1 + k, e)]
    return pts[keep]


def palette(a: np.ndarray, k: int) -> np.ndarray:
    """The logo's k main colours (k-means on opaque pixels)."""
    px = a[a[..., 3] > 0.9][:, :3]
    if len(px) > 40000:
        px = px[np.random.default_rng(0).choice(len(px), 40000, replace=False)]
    q = (px * 15).round()  # start from the most common coarse colours
    uniq, counts = np.unique(q, axis=0, return_counts=True)
    c = uniq[np.argsort(-counts)[:k]] / 15
    for _ in range(20):
        lab = np.argmin(((px[:, None] - c[None]) ** 2).sum(-1), axis=1)
        c = np.array([px[lab == i].mean(0) if (lab == i).any() else c[i] for i in range(len(c))])
    return c


def hexc(c):
    return "#%02x%02x%02x" % tuple(int(round(v * 255)) for v in c)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("out")
    ap.add_argument("--field", default="alpha", choices=["alpha", "ink", "green"])
    ap.add_argument("--level", type=float, default=0.5)
    ap.add_argument("--colors", type=int, default=4, help="how many main colours the logo has")
    ap.add_argument("--palette", default="", help="the logo's exact colours, comma separated (#rrggbb or #rrggbbaa); default: found by k-means")
    ap.add_argument("--fill", default="", help="one exact colour for the base shape instead of sampling")
    ap.add_argument("--layer", action="append", default=[], help="extra shape on top: field:level:#hex")
    ap.add_argument("--scale", type=float, default=6)
    ap.add_argument("--max", type=int, default=1600, help="longest side after upscaling")
    args = ap.parse_args()

    img = Image.open(args.src).convert("RGBA")
    s = min(args.scale, args.max / max(img.size))
    big = img.resize((max(2, round(img.width * s)), max(2, round(img.height * s))), Image.LANCZOS)
    a = np.pad(np.asarray(big, dtype=np.float64) / 255.0, ((1, 1), (1, 1), (0, 0)))  # closed outlines at the edges
    names = [c.strip() for c in args.palette.split(",") if c.strip()]
    pal = np.array([[int(c[i:i + 2], 16) / 255 for i in (1, 3, 5)] for c in names]) if names else (palette(a, args.colors) if not args.fill else None)
    if not names and pal is not None:
        names = [hexc(c) for c in pal]

    f = field_of(a, args.field)

    def colour_of(ring):
        """Palette colour of most logo pixels inside the ring's box."""
        y0, x0 = np.floor(ring.min(0)).astype(int); y1, x1 = np.ceil(ring.max(0)).astype(int) + 1
        box = a[y0:y1, x0:x1]
        inside = (f[y0:y1, x0:x1] > args.level) & (box[..., 3] > 0.1)
        px = box[inside][:, :3] if inside.any() else box.reshape(-1, 4)[:, :3]
        lab = np.argmin(((px[:, None] - pal[None]) ** 2).sum(-1), axis=1)
        return names[np.bincount(lab, minlength=len(pal)).argmax()]

    base = link(march(f, args.level))
    y0, x0 = np.concatenate(base).min(0); y1, x1 = np.concatenate(base).max(0)

    def ring_d(r):
        p = rdp(r, 0.35)
        if len(p) < 3:
            return ""
        ys, xs = p[:, 0], p[:, 1]
        if 0.5 * abs(np.dot(xs, np.roll(ys, 1)) - np.dot(ys, np.roll(xs, 1))) < 6:  # specks
            return ""
        return "M" + "L".join(f"{x - x0:.1f} {y - y0:.1f}" for y, x in p) + "Z"

    groups = {}  # colour -> path data, in first-seen order
    for r in base:
        d = ring_d(r)
        if d:
            groups.setdefault(args.fill or colour_of(r), []).append(d)
    paths = [f'<path fill="{c}" fill-rule="evenodd" d="{"".join(ds)}"/>' for c, ds in groups.items()]
    for spec in args.layer:
        fk, lv, col = spec.split(":")
        ds = [ring_d(r) for r in link(march(field_of(a, fk), float(lv)))]
        paths.append(f'<path fill="{col}" fill-rule="evenodd" d="{"".join(d for d in ds if d)}"/>')

    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {x1 - x0:.1f} {y1 - y0:.1f}">' + "".join(paths) + "</svg>\n")
    open(args.out, "w", encoding="utf-8").write(svg)
    print(f"{args.out}: colours {', '.join(list(groups) + [l.split(':')[2] for l in args.layer])}, {len(svg) // 1024} KB")


if __name__ == "__main__":
    main()
