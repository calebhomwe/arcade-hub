# -*- coding: utf-8 -*-
r"""
build-pieces.py -- procedural Staunton chess set for the arcade-hub chess game.

Run headless (no GUI, no add-ons needed):

    "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b -P build-pieces.py

Optional flags (after the script: blender -b -P build-pieces.py -- --engine CYCLES ...):
    --engine NAME    BLENDER_EEVEE (default) or CYCLES
    --samples N      render samples (EEVEE temporal TAA / Cycles per-pixel)
    --res N          square render resolution (default 512)
    --lightscale F   multiplies every studio light
    --only a,b       render only these pieces (fast iteration; pieces.json not written)
    --no-shadow      omit the baked contact shadow

Outputs (paths derived from this file's location, so the script is relocatable):
    <root>/games/assets/pieces/{w,b}_{pawn,rook,knight,bishop,queen,king}.png
    <root>/_loop/blender/pieces.json      (cell size + opaque bbox of every PNG)

Design notes (v2)
-----------------
* ONE camera, ONE orthographic scale, ONE shared baseline for all 12 sprites.
  The frame is computed from the union of every piece, so relative sizes are real.
* Height family (world units, king = 1.00) is declared once in HEIGHT and every
  profile is written against it, so the set reads as one designed family:
    pawn 0.60 < bishop 0.74 < knight 0.80 < rook 0.86 < queen 0.93 < king 1.00
* The pawn is a proper Staunton pawn: spherical head whose diameter is ~46% of
  the base diameter, a modelled collar ring on a slender tapered stem, and a
  two-step flared base.  (v1's pawn was a squat blob: head too big, no collar,
  no taper, and only 0.50 world units tall against a 0.43-wide base.)
* Sweep resolution is 192 segments and profile splines are sampled at 6 steps per
  segment: the silhouette deviation of a 0.10-radius head is <0.00002 world units
  (<0.01 px at 512), and every face is smooth-shaded.
* Hard edges (base steps, collars, crown points) get a real 0.0024 bevel with two
  segments, so they catch a highlight and read crisp instead of aliasing.
* Contact shadow is a soft *elliptical* gradient (a 0.30 x 0.17 world ellipse
  turned to screen-horizontal), peak alpha 0.17, so it never rises above the
  base's own projected bottom -> the shared baseline is exactly the base.
* Rendering is deterministic (fixed seed, no randomness, fixed geometry).
"""

import bpy, bmesh, math, os, sys, json, time, traceback
from mathutils import Vector, Matrix

# --------------------------------------------------------------------------- #
# configuration
# --------------------------------------------------------------------------- #
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT_DIR = os.path.join(ROOT, "games", "assets", "pieces")
JSON_PATH = os.path.join(HERE, "pieces.json")

RES = 512
SAMPLES = 512
ENGINE = "BLENDER_EEVEE"
LIGHT_SCALE = 1.0
ONLY = None
NO_SHADOW = False

SEGMENTS = 192          # revolution steps for lathed parts
PROFILE_STEPS = 6       # spline samples per profile segment
AZIMUTH = 35.0          # camera azimuth  (0 = looking down -Y)
ELEVATION = 14.0        # camera elevation above the horizon
FRAME_MARGIN = 1.10     # empty border around the union of all pieces
ALPHA_THRESHOLD = 8     # "opaque" = alpha > 8/255

BASE_R = 0.214          # shared base radius -> shared contact shadow + baseline
SHADOW_A = 0.300        # contact-shadow ellipse semi-axis, screen-horizontal
SHADOW_B = 0.170        # contact-shadow ellipse semi-axis, depth (stays inside base)
SHADOW_PEAK = 0.17      # peak alpha of the contact shadow

BEVEL_WIDTH = 0.0024
BEVEL_SEGMENTS = 2
SHARP_ANGLE = 30.0      # edges sharper than this get beveled (deg)
SMOOTH_ANGLE = 38.0     # edges shallower than this are smooth-shaded (deg)

# palette (sRGB).  Neutral, no coloured tint: white ~0.93, black ~0.10.
WHITE_SRGB = (0.930, 0.930, 0.930)
BLACK_SRGB = (0.100, 0.100, 0.102)

# designed height family: king = 1.00 world unit
HEIGHT = {"pawn": 0.600, "bishop": 0.740, "knight": 0.800,
          "rook": 0.860, "queen": 0.930, "king": 1.000}

PIECE_ORDER = ["pawn", "bishop", "knight", "rook", "queen", "king"]


def log(*a):
    print("[pieces]", *a)
    sys.stdout.flush()


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def try_set(obj, name, value):
    try:
        setattr(obj, name, value)
        return True
    except Exception:
        return False


# --------------------------------------------------------------------------- #
# 2D profile helpers
# --------------------------------------------------------------------------- #
def catmull(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    out = []
    for i in (0, 1):
        out.append(0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t
                          + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2
                          + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3))
    return (out[0], out[1])


def spline_run(pts, steps=PROFILE_STEPS):
    """Clamped Catmull-Rom through pts -> dense list of (r, z)."""
    pts = list(pts)
    if len(pts) == 2:
        return [(pts[0][0] + (pts[1][0] - pts[0][0]) * i / steps,
                 pts[0][1] + (pts[1][1] - pts[0][1]) * i / steps) for i in range(steps + 1)]
    P = [pts[0]] + pts + [pts[-1]]
    out = []
    for i in range(len(P) - 3):
        for s in range(steps):
            out.append(catmull(P[i], P[i + 1], P[i + 2], P[i + 3], s / steps))
    out.append(tuple(pts[-1]))
    return out


def build_profile(keys, steps=PROFILE_STEPS):
    """keys: [(r, z[, is_corner]), ...] -> dense profile; corners stay crisp."""
    keys = [(k[0], k[1], (k[2] if len(k) > 2 else False)) for k in keys]
    prof, run = [], [(keys[0][0], keys[0][1])]
    for i in range(1, len(keys)):
        r, z, corner = keys[i]
        run.append((r, z))
        if corner or i == len(keys) - 1:
            seg = spline_run(run, steps)
            if prof:
                seg = seg[1:]
            prof.extend(seg)
            run = [(r, z)]
    out = [prof[0]]
    for p in prof[1:]:
        if abs(p[0] - out[-1][0]) + abs(p[1] - out[-1][1]) > 1e-7:
            out.append(p)
    return out


def ball_arc(cx, cz, R, phi0_deg, phi1_deg, steps, skip_first=True):
    """Points on a circle in (r, z) space; phi=0 equator, +90 top pole."""
    pts = []
    for i in range(steps + 1):
        phi = math.radians(phi0_deg + (phi1_deg - phi0_deg) * i / steps)
        pts.append((cx + R * math.cos(phi), cz + R * math.sin(phi)))
    return pts[1:] if skip_first else pts


# --------------------------------------------------------------------------- #
# mesh builders
# --------------------------------------------------------------------------- #
def lathe(profile, segments=SEGMENTS):
    """Solid of revolution. profile must start and end on the axis (r == 0)."""
    verts, faces, rings, poles = [], [], [], []
    for (r, z) in profile:
        if r <= 1e-7:
            verts.append((0.0, 0.0, z))
            rings.append(None)
            poles.append(len(verts) - 1)
        else:
            ring = []
            for s in range(segments):
                a = 2.0 * math.pi * s / segments
                verts.append((r * math.cos(a), r * math.sin(a), z))
                ring.append(len(verts) - 1)
            rings.append(ring)
            poles.append(None)
    for i in range(len(profile) - 1):
        ar, ap = rings[i], poles[i]
        br, bp = rings[i + 1], poles[i + 1]
        if ar is None and br is None:
            continue
        for s in range(segments):
            s2 = (s + 1) % segments
            if ap is not None:
                faces.append((ap, br[s], br[s2]))
            elif bp is not None:
                faces.append((ar[s], ar[s2], bp))
            else:
                faces.append((ar[s], ar[s2], br[s2], br[s]))
    return verts, faces


def loft(sections, cap_start=True, cap_end=True):
    """sections: list of equal-length closed rings of 3D points -> tube mesh."""
    verts, faces = [], []
    n = len(sections[0])
    idx = []
    for sec in sections:
        row = []
        for p in sec:
            row.append(len(verts))
            verts.append(tuple(p))
        idx.append(row)
    for i in range(len(idx) - 1):
        a, b = idx[i], idx[i + 1]
        for s in range(n):
            s2 = (s + 1) % n
            faces.append((a[s], a[s2], b[s2], b[s]))
    if cap_start:
        c = len(verts)
        verts.append(tuple(sum((Vector(p) for p in sections[0]), Vector((0.0, 0.0, 0.0))) / n))
        for s in range(n):
            faces.append((c, idx[0][(s + 1) % n], idx[0][s]))
    if cap_end:
        c = len(verts)
        verts.append(tuple(sum((Vector(p) for p in sections[-1]), Vector((0.0, 0.0, 0.0))) / n))
        for s in range(n):
            faces.append((c, idx[-1][s], idx[-1][(s + 1) % n]))
    return verts, faces


def annular_sector(r_in, r_out, z0, z1, a0, a1, segs=14, taper=0.0):
    """Solid crenellation tooth: a slice of an annulus between two angles."""
    def loop(z, ro, ri):
        pts = []
        for i in range(segs + 1):
            a = a0 + (a1 - a0) * i / segs
            pts.append((ro * math.cos(a), ro * math.sin(a), z))
        for i in range(segs, -1, -1):
            a = a0 + (a1 - a0) * i / segs
            pts.append((ri * math.cos(a), ri * math.sin(a), z))
        return pts
    bot, top = loop(z0, r_out, r_in), loop(z1, r_out * (1.0 - taper), r_in)
    n = len(bot)
    verts = bot + top
    faces = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    z0v = Vector((0.0, 0.0, 0.0))
    cb = len(verts); verts.append(tuple(sum((Vector(p) for p in bot), z0v) / n))
    ct = len(verts); verts.append(tuple(sum((Vector(p) for p in top), z0v) / n))
    for i in range(n):
        faces.append((cb, (i + 1) % n, i))
        faces.append((ct, n + i, n + (i + 1) % n))
    return verts, faces


def cuboid(cx, cy, cz, sx, sy, sz, taper=0.85):
    """Axis-aligned box, top face scaled by taper (a chiselled bar)."""
    hx, hy, hz = sx * 0.5, sy * 0.5, sz * 0.5
    v = [
        (cx - hx, cy - hy, cz - hz), (cx + hx, cy - hy, cz - hz),
        (cx + hx, cy + hy, cz - hz), (cx - hx, cy + hy, cz - hz),
        (cx - hx * taper, cy - hy * taper, cz + hz), (cx + hx * taper, cy - hy * taper, cz + hz),
        (cx + hx * taper, cy + hy * taper, cz + hz), (cx - hx * taper, cy + hy * taper, cz + hz),
    ]
    f = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    return v, f


def polish_mesh(me, width=BEVEL_WIDTH, segments=BEVEL_SEGMENTS,
                sharp_deg=SHARP_ANGLE, smooth_deg=SMOOTH_ANGLE):
    """Weld->bevel hard edges->smooth shade. Makes edges crisp but anti-aliased."""
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    thr = math.radians(sharp_deg)
    hard = [e for e in bm.edges
            if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > thr]
    if hard and width > 0.0:
        try:
            bmesh.ops.bevel(bm, geom=hard, offset=width, offset_type='OFFSET',
                            segments=segments, profile=0.5, affect='EDGES',
                            clamp_overlap=True, loop_slide=True)
        except Exception as exc:                                    # pragma: no cover
            log("bevel fallback (%s)" % exc)
    for f in bm.faces:
        f.smooth = True
    sm = math.radians(smooth_deg)
    for e in bm.edges:
        if len(e.link_faces) == 2:
            e.smooth = bool(e.calc_face_angle(0.0) <= sm)
        else:
            e.smooth = False
    bm.to_mesh(me)
    bm.free()
    me.update()


class Builder(object):
    """Accumulates several shells into one mesh."""

    def __init__(self):
        self.verts = []
        self.faces = []

    def add(self, verts, faces, matrix=None):
        off = len(self.verts)
        if matrix is None:
            self.verts.extend([tuple(v) for v in verts])
        else:
            self.verts.extend([tuple(matrix @ Vector(v)) for v in verts])
        self.faces.extend([tuple(i + off for i in f) for f in faces])
        return self

    def object(self, name):
        return make_object(name, self.verts, self.faces)


def make_object(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [list(f) for f in faces])
    me.update()
    polish_mesh(me)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def revolve_object(name, keys, steps=PROFILE_STEPS):
    return make_object(name, *lathe(build_profile(keys, steps)))


def xform_matrix(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    return (Matrix.Translation(Vector(loc))
            @ Matrix.Rotation(rot[2], 4, 'Z')
            @ Matrix.Rotation(rot[1], 4, 'Y')
            @ Matrix.Rotation(rot[0], 4, 'X')
            @ Matrix.Diagonal(Vector(scale).to_4d()))


# --------------------------------------------------------------------------- #
# piece profiles  (world units; king is 1.00 tall, all bases r = 0.214)
# --------------------------------------------------------------------------- #
def base_keys():
    """Shared stepped base: a bottom drum, a stepped-in waist, a second tier,
    then a concave cove lifting into the stem.  Two steps are clearly visible."""
    return [
        (0.000, 0.000, True),
        (0.148, 0.000, True),
        (0.196, 0.005, False),
        (0.212, 0.016, True),      # step 1: outer bottom corner
        (0.214, 0.030, True),
        (0.206, 0.040, True),      # step 1 top, chamfer inward
        (0.201, 0.046, True),
        (0.201, 0.058, True),      # inset waist
        (0.211, 0.068, True),      # step 2: second tier flares out
        (0.209, 0.082, True),
        (0.195, 0.094, False),     # chamfer into the cove
        (0.170, 0.108, False),
        (0.142, 0.126, False),
        (0.118, 0.146, False),     # cove
        (0.100, 0.166, False),     # common base top / stem foot
    ]


def pawn_profile():
    """Staunton pawn.  Head diameter = 0.200 = 46.5% of the 0.430 base diameter;
    slender stem tapering to a waist then flaring into the base; modelled collar
    ring and neck under the head."""
    R = 0.100
    H = HEIGHT["pawn"]
    cz = H - R                                   # 0.500
    rj = 0.062                                   # neck radius where it meets the ball
    phi0 = -math.degrees(math.acos(rj / R))      # -51.7 deg
    zj = cz + R * math.sin(math.radians(phi0))
    keys = base_keys() + [
        (0.098, 0.182, False),
        (0.084, 0.208, False),
        (0.078, 0.234, False),     # waist: narrowest point of the stem
        (0.082, 0.258, False),
        (0.094, 0.276, True),      # collar foot
        (0.114, 0.292, False),     # collar flares out
        (0.119, 0.308, True),      # collar outer lip (the ring reads at 45 px)
        (0.110, 0.322, True),      # collar top
        (0.090, 0.336, False),     # neck
        (0.083, 0.358, False),
        (rj, zj, False),
    ]
    keys += [(r, z, False) for (r, z) in ball_arc(0.0, cz, R, phi0, 90.0, 30)]
    return keys


def rook_profile():
    """Squat crenellated tower: 8 teeth rising from a hollow cup."""
    return base_keys() + [
        (0.100, 0.182, False),
        (0.104, 0.210, False),
        (0.101, 0.300, False),     # shaft
        (0.099, 0.400, False),
        (0.101, 0.480, False),
        (0.106, 0.540, False),
        (0.118, 0.580, False),
        (0.140, 0.612, False),
        (0.162, 0.640, False),
        (0.172, 0.664, False),
        (0.176, 0.690, True),      # rim outer corner
        (0.176, 0.788, True),      # rim top
        (0.168, 0.800, True),      # chamfer
        (0.150, 0.796, False),     # hollow: inner wall drops away
        (0.130, 0.774, False),
        (0.124, 0.742, False),     # hollow floor
        (0.070, 0.732, False),
        (0.000, 0.730, False),
    ]


def bishop_profile():
    """Slender mitre on a collar, with a diagonal slit and a ball finial."""
    return base_keys() + [
        (0.098, 0.182, False),
        (0.092, 0.240, False),
        (0.094, 0.290, False),
        (0.104, 0.330, True),      # collar foot
        (0.126, 0.352, False),     # collar flare
        (0.132, 0.372, True),      # collar lip
        (0.120, 0.388, True),      # collar top
        (0.100, 0.404, False),     # neck
        (0.096, 0.424, False),
        (0.104, 0.452, False),     # mitre bulge
        (0.112, 0.494, False),
        (0.114, 0.536, False),
        (0.106, 0.578, False),
        (0.090, 0.612, False),
        (0.062, 0.638, False),
        (0.034, 0.660, False),
        (0.000, 0.676, False),     # mitre apex (finial overlaps upward)
    ]


def queen_profile():
    """Flared coronet cup on a tall collar, dished top, centre finial above."""
    return base_keys() + [
        (0.100, 0.182, False),
        (0.103, 0.230, False),
        (0.106, 0.320, False),
        (0.112, 0.420, False),
        (0.120, 0.510, False),
        (0.128, 0.580, False),
        (0.140, 0.630, True),      # collar foot
        (0.160, 0.652, False),     # collar flare
        (0.168, 0.672, True),      # collar lip
        (0.150, 0.690, True),      # collar top
        (0.116, 0.706, False),     # neck
        (0.108, 0.734, True),
        (0.132, 0.762, False),     # coronet flare
        (0.140, 0.782, True),      # coronet rim
        (0.140, 0.812, True),
        (0.128, 0.826, True),      # chamfer
        (0.100, 0.818, False),     # dished top
        (0.055, 0.812, False),
        (0.000, 0.810, False),
    ]


def king_profile():
    """Tallest piece: collar, crown band, dished top; cross added on top."""
    return base_keys() + [
        (0.100, 0.182, False),
        (0.102, 0.230, False),
        (0.104, 0.330, False),
        (0.110, 0.440, False),
        (0.114, 0.540, False),
        (0.120, 0.620, False),
        (0.128, 0.680, False),
        (0.140, 0.720, False),
        (0.156, 0.748, True),      # collar foot
        (0.170, 0.768, False),     # collar flare
        (0.176, 0.788, True),      # collar lip
        (0.156, 0.806, True),      # collar top
        (0.122, 0.822, False),     # neck
        (0.114, 0.842, True),
        (0.140, 0.866, False),     # crown flare
        (0.152, 0.886, True),      # crown band
        (0.152, 0.930, True),
        (0.140, 0.944, True),      # chamfer
        (0.116, 0.938, False),     # dished crown top
        (0.070, 0.930, False),
        (0.035, 0.926, False),
        (0.000, 0.924, False),
    ]


def knight_base_profile():
    """Squat base with its own collar, flat top for the lofted neck."""
    return base_keys() + [
        (0.104, 0.182, False),
        (0.112, 0.196, True),
        (0.130, 0.212, False),     # collar flare
        (0.138, 0.228, True),      # collar lip
        (0.130, 0.242, True),      # collar top
        (0.104, 0.250, False),     # flat top the neck sits on
        (0.060, 0.248, False),
        (0.000, 0.246, False),
    ]


# ---- knight: lofted neck + head ------------------------------------------- #
# The neck is deliberately slimmer than the head mass: that contrast is what
# reads as "horse" at 45 px.  Top silhouette = z + hh, bottom = z - hh.
KNIGHT_SPINE = [
    # x,      z,     half-width(Y), half-height(in-plane)
    (0.000, 0.165, 0.088, 0.104),   # neck root, buried in the base collar
    (0.006, 0.250, 0.084, 0.097),
    (0.016, 0.335, 0.080, 0.091),
    (0.030, 0.415, 0.077, 0.085),   # slender neck
    (0.050, 0.485, 0.075, 0.081),
    (0.078, 0.545, 0.076, 0.082),   # throat
    (0.112, 0.592, 0.080, 0.089),   # jowl begins
    (0.152, 0.620, 0.085, 0.096),   # cheek: widest part of the head
    (0.196, 0.633, 0.084, 0.092),   # brow / skull top
    (0.242, 0.627, 0.076, 0.078),   # stop (dip between forehead and nose)
    (0.288, 0.611, 0.064, 0.066),   # muzzle
    (0.334, 0.592, 0.052, 0.056),   # nose
    (0.374, 0.572, 0.041, 0.046),   # nose bridge
    (0.404, 0.554, 0.030, 0.034),   # muzzle tip
    (0.420, 0.540, 0.016, 0.017),
]

# mane crest strength / pinch per spine index (0 = plain round section).
KNIGHT_MANE = [0.30, 0.44, 0.54, 0.56, 0.50, 0.38, 0.20, 0.05, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
KNIGHT_NARROW = [0.30, 0.40, 0.48, 0.50, 0.44, 0.34, 0.18, 0.04, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]


def frame_at(spine, i):
    """Return (point, tangent, e1(Y), e2(back/up)) at spine index i."""
    n = len(spine)
    a = spine[max(0, i - 1)]
    b = spine[min(n - 1, i + 1)]
    t = Vector((b[0] - a[0], 0.0, b[1] - a[1]))
    if t.length < 1e-9:
        t = Vector((0.0, 0.0, 1.0))
    t.normalize()
    e1 = Vector((0.0, 1.0, 0.0))
    e2 = t.cross(e1)
    e2.normalize()
    return Vector((spine[i][0], 0.0, spine[i][1])), t, e1, e2


def ellipse_ring(center, e1, e2, hw, hh, n=48, mane=0.0, narrow=0.0):
    """Elliptical section. mane/narrow stretch and pinch the +e2 side, which is
    how the knight grows a carved mane crest instead of a separate fin."""
    pts = []
    for k in range(n):
        a = 2.0 * math.pi * k / n
        s, c = math.sin(a), math.cos(a)
        back = max(0.0, s)
        w = hw * (1.0 - narrow * back ** 1.1)
        d = hh * (1.0 + mane * back ** 1.3)
        pts.append(tuple(center + e1 * (w * c) + e2 * (d * s)))
    return pts


def knight_neck_head(bld, ring_n=64):
    sections = []
    for i, (x, z, hw, hh) in enumerate(KNIGHT_SPINE):
        c, t, e1, e2 = frame_at(KNIGHT_SPINE, i)
        wave = 1.0 + 0.12 * math.sin(i * 2.35) * min(1.0, KNIGHT_MANE[i] * 3.0)
        sections.append(ellipse_ring(c, e1, e2, hw, hh, ring_n,
                                     mane=KNIGHT_MANE[i] * wave,
                                     narrow=KNIGHT_NARROW[i]))
    bld.add(*loft(sections, cap_start=True, cap_end=True))

    # ---- ears: swept-back cones on top of the skull ----
    for side in (-1.0, 1.0):
        v, f = lathe(build_profile([(0.000, 0.000, False), (0.028, 0.007, False),
                                    (0.030, 0.024, False), (0.017, 0.060, False),
                                    (0.000, 0.092, False)], 4), 40)
        m = xform_matrix(loc=(0.192, side * 0.049, 0.700),
                         rot=(math.radians(-side * 12.0), math.radians(-24.0), 0.0))
        bld.add(v, f, m)

    # ---- eyes: a shallow dome set into each cheek ----
    for side in (-1.0, 1.0):
        v, f = lathe(build_profile([(0.000, -0.016, False), (0.013, -0.014, False),
                                    (0.017, -0.003, False), (0.015, 0.008, False),
                                    (0.000, 0.014, False)], 4), 32)
        m = xform_matrix(loc=(0.222, side * 0.070, 0.612),
                         rot=(math.radians(side * 76.0), 0.0, 0.0))
        bld.add(v, f, m)


def build_pieces():
    objs = {}
    objs["pawn"] = revolve_object("pawn", pawn_profile())

    rook = Builder()
    rook.add(*lathe(build_profile(rook_profile())))
    for k in range(6):
        a0 = math.radians(k * 60.0 + 13.0)
        a1 = math.radians(k * 60.0 + 47.0)
        rook.add(*annular_sector(0.124, 0.178, 0.772, 0.860, a0, a1, 18, taper=0.0))
    objs["rook"] = rook.object("rook")

    bishop = Builder()
    bv, bf = lathe(build_profile(bishop_profile()))
    # mitre slit: a diagonal saw cut across the front of the mitre, cut by
    # pulling vertices within a thin slab toward the axis (no booleans needed).
    tilt = math.radians(21.0)
    n = Vector((math.sin(tilt) * math.cos(math.radians(AZIMUTH)),
                math.sin(tilt) * math.sin(math.radians(AZIMUTH)),
                math.cos(tilt)))
    n.normalize()
    front = Vector((math.sin(math.radians(AZIMUTH)), -math.cos(math.radians(AZIMUTH)), 0.0))
    plane_p = Vector((0.0, 0.0, 0.560))
    width, depth = 0.017, 0.020
    out_v = []
    for v in bv:
        p = Vector(v)
        d = abs((p - plane_p).dot(n))
        side = front.dot(Vector((p.x, p.y, 0.0)).normalized()) if p.xy.length > 1e-6 else -1.0
        if d < width and side > -0.15 and p.z > 0.40:
            k = (1.0 - (d / width) ** 2) ** 2
            k *= max(0.0, min(1.0, (side + 0.15) / 0.55))
            rad = Vector((p.x, p.y, 0.0))
            if rad.length > 1e-6:
                rad.normalize()
                p = p - rad * (depth * k)
        out_v.append(tuple(p))
    bishop.add(out_v, bf)
    # ball finial on a short stem
    bishop.add(*lathe(build_profile([(0.000, 0.640, False), (0.024, 0.654, False),
                                     (0.026, 0.672, False)], 5), 32))
    bishop.add(*lathe(build_profile([(0.000, 0.660, False)] +
                                    ball_arc(0.0, 0.700, 0.040, -90.0, 90.0, 20, False), 4), 48))
    objs["bishop"] = bishop.object("bishop")

    queen = Builder()
    queen.add(*lathe(build_profile(queen_profile())))
    for k in range(8):
        a = math.radians(k * 45.0)
        v, f = lathe(build_profile([(0.000, 0.000, False), (0.024, 0.006, False),
                                    (0.025, 0.022, False), (0.010, 0.058, False),
                                    (0.000, 0.074, False)], 4), 36)
        m = xform_matrix(loc=(0.112 * math.cos(a), 0.112 * math.sin(a), 0.806),
                         rot=(math.radians(-10.0 * math.sin(a)), math.radians(10.0 * math.cos(a)), 0.0))
        queen.add(v, f, m)
    queen.add(*lathe(build_profile([(0.000, 0.812, False), (0.028, 0.828, False),
                                    (0.029, 0.860, False)], 5), 32))
    queen.add(*lathe(build_profile([(0.000, 0.852, False)] +
                                   ball_arc(0.0, 0.884, 0.048, -90.0, 90.0, 20, False), 4), 48))
    objs["queen"] = queen.object("queen")

    king = Builder()
    king.add(*lathe(build_profile(king_profile())))
    az = math.radians(AZIMUTH)
    # cross: vertical bar + arms, arms turned to face the camera so the
    # silhouette reads at full width in the sprite.
    v, f = cuboid(0.0, 0.0, 0.948, 0.048, 0.048, 0.108, taper=0.98)
    king.add(v, f)
    v, f = cuboid(0.0, 0.0, 0.958, 0.176, 0.042, 0.046, taper=0.98)
    m = Matrix.Rotation(az, 4, 'Z')
    king.add(v, f, m)
    objs["king"] = king.object("king")

    knight = Builder()
    knight.add(*lathe(build_profile(knight_base_profile())))
    knight_neck_head(knight)
    kobj = knight.object("knight")
    kobj.rotation_euler = (0.0, 0.0, math.radians(AZIMUTH))   # head faces camera-right
    objs["knight"] = kobj
    return objs


# --------------------------------------------------------------------------- #
# scene
# --------------------------------------------------------------------------- #
def wipe():
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.materials,
                 bpy.data.lights, bpy.data.cameras, bpy.data.node_groups):
        for item in list(coll):
            try:
                coll.remove(item)
            except Exception:
                pass


def set_in(node, name, value):
    if name in node.inputs:
        node.inputs[name].default_value = value
        return True
    return False


def make_piece_material(name, srgb):
    mat = bpy.data.materials.new(name)
    if mat.node_tree is None:
        mat.use_nodes = True
    nt = mat.node_tree
    bsdf = None
    for nd in nt.nodes:
        if nd.type == 'BSDF_PRINCIPLED':
            bsdf = nd
    if bsdf is None:
        for nd in list(nt.nodes):
            nt.nodes.remove(nd)
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
        nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    lin = tuple(srgb_to_linear(c) for c in srgb)
    set_in(bsdf, 'Base Color', (lin[0], lin[1], lin[2], 1.0))
    set_in(bsdf, 'Metallic', 0.0)
    set_in(bsdf, 'Roughness', 0.28)          # same finish for both colours
    set_in(bsdf, 'IOR', 1.5)
    set_in(bsdf, 'Specular IOR Level', 0.5)
    set_in(bsdf, 'Coat Weight', 0.10)        # thin polished coat -> soft sheen
    set_in(bsdf, 'Coat Roughness', 0.12)
    return mat


def make_shadow_material():
    """Unlit black whose alpha falls off smoothly with *normalised* radius:
    a soft elliptical contact shadow (object local space is a unit circle that
    the object transform squashes into an ellipse)."""
    mat = bpy.data.materials.new("contact_shadow")
    if mat.node_tree is None:
        mat.use_nodes = True
    nt = mat.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    mix = nt.nodes.new('ShaderNodeMixShader')
    trans = nt.nodes.new('ShaderNodeBsdfTransparent')
    emis = nt.nodes.new('ShaderNodeEmission')
    emis.inputs['Color'].default_value = (0.0, 0.0, 0.0, 1.0)
    emis.inputs['Strength'].default_value = 1.0
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'EASE'
    e0 = ramp.color_ramp.elements[0]
    e1 = ramp.color_ramp.elements[1]
    e0.position = 0.0
    e0.color = (SHADOW_PEAK, SHADOW_PEAK, SHADOW_PEAK, 1.0)
    e1.position = 1.0
    e1.color = (0.0, 0.0, 0.0, 1.0)
    for pos, val in ((0.35, SHADOW_PEAK * 0.72), (0.62, SHADOW_PEAK * 0.34),
                     (0.84, SHADOW_PEAK * 0.09)):
        el = ramp.color_ramp.elements.new(pos)
        el.color = (val, val, val, 1.0)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    vlen = nt.nodes.new('ShaderNodeVectorMath')
    vlen.operation = 'LENGTH'
    nt.links.new(tc.outputs['Object'], sep.inputs['Vector'])
    nt.links.new(sep.outputs['X'], comb.inputs['X'])
    nt.links.new(sep.outputs['Y'], comb.inputs['Y'])
    comb.inputs['Z'].default_value = 0.0
    nt.links.new(comb.outputs['Vector'], vlen.inputs[0])
    nt.links.new(vlen.outputs['Value'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], mix.inputs['Fac'])
    nt.links.new(trans.outputs['BSDF'], mix.inputs[1])
    nt.links.new(emis.outputs['Emission'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    return mat


def make_shadow():
    verts = [(0.0, 0.0, 0.0)]
    faces = []
    n = 160
    for i in range(n):
        a = 2.0 * math.pi * i / n
        verts.append((math.cos(a), math.sin(a), 0.0))
    for i in range(n):
        faces.append((0, 1 + i, 1 + (i + 1) % n))
    ob = make_object("contact_shadow", verts, faces)
    ob.scale = (SHADOW_A, SHADOW_B, 1.0)
    ob.rotation_euler = (0.0, 0.0, math.radians(AZIMUTH))
    ob.location = (0.0, 0.0, 0.0009)
    ob.data.materials.append(make_shadow_material())
    return ob


def look_at(loc, target):
    loc = Vector(loc)
    d = (loc - Vector(target))
    back = d.normalized()
    right = Vector((0.0, 0.0, 1.0)).cross(back)
    if right.length < 1e-6:
        right = Vector((1.0, 0.0, 0.0))
    right.normalize()
    up = back.cross(right).normalized()
    return Matrix(((right.x, up.x, back.x, loc.x),
                   (right.y, up.y, back.y, loc.y),
                   (right.z, up.z, back.z, loc.z),
                   (0.0, 0.0, 0.0, 1.0)))


def add_area_light(name, az_deg, el_deg, dist, size, power, target=(0, 0, 0.45)):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.shape = 'SQUARE'
    ld.size = size
    ld.energy = power
    ld.color = (1.0, 1.0, 1.0)      # colourless studio light, no gels
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    a, e = math.radians(az_deg), math.radians(el_deg)
    loc = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    loc += Vector(target)
    ob.matrix_world = look_at(loc, target)
    return ob


def setup_scene(objs):
    sc = bpy.context.scene
    sc.render.engine = ENGINE
    sc.render.resolution_x = RES
    sc.render.resolution_y = RES
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.color_depth = '8'
    sc.render.image_settings.compression = 40
    sc.render.use_persistent_data = True
    sc.render.filter_size = 1.5
    try:
        sc.view_settings.view_transform = 'Standard'
    except Exception:
        pass
    sc.view_settings.look = 'None'
    sc.view_settings.exposure = 0.0
    sc.view_settings.gamma = 1.0
    if ENGINE == 'CYCLES':
        sc.cycles.device = 'CPU'
        sc.cycles.samples = SAMPLES
        sc.cycles.use_adaptive_sampling = True
        sc.cycles.adaptive_threshold = 0.005
        sc.cycles.use_denoising = True
        try_set(sc.cycles, 'denoiser', 'OPENIMAGEDENOISE')
        try_set(sc.cycles, 'use_denoising_passes', True)
        sc.cycles.max_bounces = 6
        sc.cycles.diffuse_bounces = 3
        sc.cycles.glossy_bounces = 3
        sc.cycles.transmission_bounces = 3
        sc.cycles.transparent_max_bounces = 16
        sc.cycles.seed = 0
        sc.cycles.use_animated_seed = False
        sc.cycles.blur_glossy = 1.0
        sc.cycles.caustics_reflective = False
        sc.cycles.caustics_refractive = False
    else:
        try_set(sc.eevee, 'taa_render_samples', SAMPLES)
        try_set(sc.eevee, 'use_raytracing', False)      # no ray noise; direct light only
        try_set(sc.eevee, 'use_shadows', True)
        try_set(sc.eevee, 'use_shadow_jitter_viewport', False)
        try_set(sc.eevee, 'use_volumetric_shadows', False)
        try_set(sc.eevee, 'shadow_ray_count', 2)
        try_set(sc.eevee, 'shadow_step_count', 8)

    # near-black world: a touch of ambient so the shadow side is not crushed
    world = bpy.data.worlds.new("piece_world")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs[0].default_value = (0.055, 0.055, 0.058, 1.0)
        bg.inputs[1].default_value = 1.0

    # --- camera: single shared orthographic 3/4 view -----------------------
    az, el = math.radians(AZIMUTH), math.radians(ELEVATION)
    back = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    right = Vector((math.cos(az), math.sin(az), 0.0))
    up = back.cross(right).normalized()

    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for ob in list(objs.values()) + [bpy.data.objects["contact_shadow"]]:
        ev = ob.evaluated_get(dg)
        mw = ev.matrix_world
        for v in ev.data.vertices:
            pts.append(mw @ v.co)
    us = [p.dot(right) for p in pts]
    vs = [p.dot(up) for p in pts]
    uc = 0.5 * (min(us) + max(us))
    vc = 0.5 * (min(vs) + max(vs))
    span_u = max(us) - min(us)
    span_v = max(vs) - min(vs)
    scale = max(span_u, span_v) * FRAME_MARGIN

    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = scale
    cam_data.clip_start = 0.1
    cam_data.clip_end = 100.0
    cam = bpy.data.objects.new("cam", cam_data)
    sc.collection.objects.link(cam)
    sc.camera = cam
    anchor = right * uc + up * vc
    cam.matrix_world = look_at(anchor + back * 8.0, anchor)

    log("camera frame: ortho_scale=%.4f  content %.3f x %.3f world units"
        % (scale, span_u, span_v))
    log("frame spans %.1f px per world unit" % (RES / scale))

    # --- lights ------------------------------------------------------------
    add_area_light("key", AZIMUTH - 38.0, 40.0, 4.2, 2.6, 145.0 * LIGHT_SCALE)
    add_area_light("fill", AZIMUTH + 62.0, 16.0, 4.6, 4.4, 98.0 * LIGHT_SCALE)
    add_area_light("rim", AZIMUTH + 158.0, 46.0, 4.4, 2.2, 112.0 * LIGHT_SCALE)
    return cam


# --------------------------------------------------------------------------- #
# render + bbox
# --------------------------------------------------------------------------- #
def image_bbox(path, threshold=ALPHA_THRESHOLD):
    import numpy as np
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    buf = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    alpha = buf[3::4].reshape(h, w)
    mask = alpha > (threshold / 255.0 + 1e-6)
    ys, xs = np.nonzero(mask)
    bpy.data.images.remove(img)
    if len(xs) == 0:
        return None, 0.0
    x0, x1 = int(xs.min()), int(xs.max())
    y0b, y1b = int(ys.min()), int(ys.max())
    # Blender pixel rows run bottom-up; PNG rows run top-down
    return [x0, h - 1 - y1b, x1 - x0 + 1, y1b - y0b + 1], float(mask.mean())


def main():
    t_start = time.time()
    wipe()
    objs = build_pieces()

    for name, ob in objs.items():
        ob.data.calc_loop_triangles()
        log("built %-7s verts=%6d tris=%6d" % (name, len(ob.data.vertices), len(ob.data.loop_triangles)))

    shadow = make_shadow()
    if NO_SHADOW:
        shadow.hide_render = True
    cam = setup_scene(objs)

    mat_w = make_piece_material("piece_white", WHITE_SRGB)
    mat_b = make_piece_material("piece_black", BLACK_SRGB)

    os.makedirs(OUT_DIR, exist_ok=True)
    sc = bpy.context.scene
    records = []
    for colour, mat in (("w", mat_w), ("b", mat_b)):
        for name in PIECE_ORDER:
            for other in objs.values():
                other.hide_render = (other is not objs[name])
            ob = objs[name]
            ob.data.materials.clear()
            ob.data.materials.append(mat)
            pid = "%s_%s" % (colour, name)
            if ONLY and pid not in ONLY and name not in ONLY:
                continue
            path = os.path.join(OUT_DIR, pid + ".png")
            sc.render.filepath = path
            t0 = time.time()
            bpy.ops.render.render(write_still=True)
            dt = time.time() - t0
            size = os.path.getsize(path) if os.path.exists(path) else -1
            bb, coverage = image_bbox(path)
            records.append({"id": pid, "file": pid + ".png", "bbox": bb})
            log("rendered %-9s %6.2fs  %8d bytes  coverage=%5.1f%%  bbox=%s"
                % (pid, dt, size, coverage * 100.0, bb))
            sys.stdout.flush()

    if len(records) == 12:
        records.sort(key=lambda r: (r["id"][0], PIECE_ORDER.index(r["id"][2:])))
        data = {"cell": RES, "pieces": records}
        with open(JSON_PATH, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2)
            fh.write("\n")
        log("wrote %s" % JSON_PATH)
    else:
        log("partial render (%d/12) -> pieces.json not rewritten" % len(records))
    log("total %.1fs  ->  %s" % (time.time() - t_start, OUT_DIR))


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if "--samples" in argv:
        SAMPLES = int(argv[argv.index("--samples") + 1])
    if "--engine" in argv:
        ENGINE = argv[argv.index("--engine") + 1]
    if "--res" in argv:
        RES = int(argv[argv.index("--res") + 1])
    if "--lightscale" in argv:
        LIGHT_SCALE = float(argv[argv.index("--lightscale") + 1])
    if "--only" in argv:
        ONLY = argv[argv.index("--only") + 1].split(",")
    if "--no-shadow" in argv:
        NO_SHADOW = True
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(1)
