"""Repair the near-side front brake materials.

The CAD import is asymmetric. Every mirrored pair on the car should carry the
same materials, but on the +X side - the side the orbit camera looks at - the
front caliper and rotor came in with a single "Rim" slot instead of their real
ones. "Rim" is one of the materials the render scripts darken to 0.05 base
colour, so in a scene lit only by emissive planes with no ambient, the caliper
rendered as a black blob and the rotor as a flat black ring. Its -X twin has
Aluminum/Steel/Brass and Steel respectively.

This is the same class of bug as the missing yoke spiders and the disconnected
front inboard linkage: CAD parts that lost their identity on import and so fell
through a name filter or, here, a material assignment. Find them by diffing
mirrored pairs - on a symmetric car, anything present on one side and absent on
the other is a miss:

    for each pair of meshes with equal vert/poly counts whose centroids mirror
    in X, compare the material sets; a mismatch is a bug.

The rotor is a single slot, so it is a straight reassignment. The caliper is
three, and the two meshes are tessellated in a different polygon order, so the
per-face assignment has to be transferred geometrically: mirror the twin in X,
refine with ICP (they land ~1mm apart, confirming a plain mirror), then label
each near-side polygon by which material's region on the twin is closest.

Safe to re-run: it no-ops once the caliper has its three slots back.
"""

import bpy
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree

CALIPER = "26-FO-BRK-I1-00 Front Brake Caliper Assem"
ROTOR   = "26-FO-BRK-R1-01 Front Brake Rotor"
CAL_MATS = ("Aluminum", "Steel", "Brass")
# The brass bleeder fitting is clocked differently on the two calipers, so its
# region lands ~2.4mm off while the body registers to well under 1mm. Claim
# polygons within this radius for brass rather than by nearest region alone,
# which otherwise loses the fitting to the aluminium boss around it.
BRASS_RADIUS = 0.0035


def _poly_centroids(obj, mirror_x=False):
    me = obj.data
    n = len(me.polygons)
    c = np.empty(n * 3)
    me.polygons.foreach_get("center", c)
    c = c.reshape(n, 3)
    mw = np.array(obj.matrix_world.to_4x4())
    w = c @ mw[:3, :3].T + mw[:3, 3]
    if mirror_x:
        w[:, 0] *= -1.0
    return w


def _world_verts(obj, mirror_x=False):
    me = obj.data
    nv = len(me.vertices)
    co = np.empty(nv * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(nv, 3)
    mw = np.array(obj.matrix_world.to_4x4())
    w = co @ mw[:3, :3].T + mw[:3, 3]
    if mirror_x:
        w[:, 0] *= -1.0
    return w


def _icp(src, dst, iters=40, sample=3000, seed=0):
    """rigid fit of src onto dst; both are already roughly aligned by the mirror"""
    rs = np.random.RandomState(seed)
    a = src[rs.choice(len(src), min(sample, len(src)), replace=False)]
    b = dst[rs.choice(len(dst), min(sample, len(dst)), replace=False)]
    R, t, cur = np.eye(3), np.zeros(3), a.copy()
    for _ in range(iters):
        idx = np.empty(len(cur), dtype=int)
        for s in range(0, len(cur), 512):
            blk = cur[s:s + 512]
            idx[s:s + 512] = ((blk[:, None, :] - b[None, :, :]) ** 2).sum(-1).argmin(1)
        P, Q = cur, b[idx]
        pc, qc = P.mean(0), Q.mean(0)
        U, _, Vt = np.linalg.svd((P - pc).T @ (Q - qc))
        D = np.diag([1, 1, np.sign(np.linalg.det(Vt.T @ U.T))])
        Ri = Vt.T @ D @ U.T
        ti = qc - Ri @ pc
        cur = cur @ Ri.T + ti
        R, t = Ri @ R, Ri @ t + ti
    return R, t


def fix_brake_materials():
    cal = bpy.data.objects[CALIPER]
    rot = bpy.data.objects[ROTOR]
    twin_cal = bpy.data.objects[CALIPER + ".001"]

    if [m.name for m in cal.data.materials] == list(CAL_MATS):
        return {"skipped": "already repaired"}

    # rotor: one slot, nothing to transfer
    rm = rot.data
    rm.materials.clear()
    rm.materials.append(bpy.data.materials["Steel"])
    rm.polygons.foreach_set("material_index", np.zeros(len(rm.polygons), dtype=np.int32))
    rm.update()

    R, t = _icp(_world_verts(twin_cal, mirror_x=True), _world_verts(cal))
    CA = _poly_centroids(cal)
    CB = _poly_centroids(twin_cal, mirror_x=True) @ R.T + t
    mi = np.empty(len(twin_cal.data.polygons), dtype=np.int32)
    twin_cal.data.polygons.foreach_get("material_index", mi)

    dist = {}
    for m in np.unique(mi):
        pts = CB[mi == m]
        kd = KDTree(len(pts))
        for i, p in enumerate(pts):
            kd.insert(Vector(p.tolist()), i)
        kd.balance()
        dist[int(m)] = np.array([kd.find(Vector(p.tolist()))[2] for p in CA])

    label = np.stack([dist[0], dist[1]]).argmin(0).astype(np.int32)
    if 2 in dist:
        label[dist[2] < BRASS_RADIUS] = 2

    me = cal.data
    me.materials.clear()
    for nm in CAL_MATS:
        me.materials.append(bpy.data.materials[nm])
    me.polygons.foreach_set("material_index", label)
    me.update()

    u, c = np.unique(label, return_counts=True)
    return {"caliper_slots": list(CAL_MATS),
            "caliper_hist": {int(k): int(v) for k, v in zip(u, c)},
            "twin_hist": {int(k): int(v) for k, v in zip(*np.unique(mi, return_counts=True))},
            "rotor_slots": [m.name for m in rm.materials]}


RESULT = fix_brake_materials()
print("[brakemat] %s" % RESULT, flush=True)
