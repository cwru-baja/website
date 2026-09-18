"""Render profiles for the /car frames: "landscape" (desktop, 1920x1080, what has
always shipped) and "portrait" (phones, 4:5 at 1080x1350).

A render script execs this file into its own namespace (after defining HERE)
before it sets anything up, and touches a camera or the output settings only
under `if PORTRAIT:` - so the landscape path runs exactly the statements it
always ran. Nothing here reads the plan unless PORTRAIT.

The portrait frame keeps every camera POSE (position and orientation) and every
focal length the landscape path uses, and changes two things only:

  1. A lens factor K. The portrait frame's vertical sensor extent is the desktop
     frame's vertical extent divided by K, under sensor_fit VERTICAL. So it sees
     1/K of the desktop's height and 0.45/K of its width (4:5 against 16:9); at
     K = 0.8 a part is exactly as many pixels tall in a 1350-high portrait frame
     as in a 1080-high desktop one.
  2. A lens shift that centres each still's subject.

Both are looked up per STILL in artifacts/portrait-plan.json (written by
artifacts/portrait-plan.py, which also holds each still's subject and the rule
for when K may change). A leg eases shift from one still's value to the next on
its own easing, and K on whatever schedule the leg allows; both are exactly the
still's value at each end, which is what keeps a seam invisible: pose + lens +
K + shift equal on both sides.

Lens shift units, measured (a 4 mm emissive marker rendered alone in Cycles at
1080x1350, sensor_fit VERTICAL, against bpy_extras world_to_camera_view): shift
1.0 moves the frame window by one full frame HEIGHT on either axis - the fitted
dimension, which is what BKE_camera_params_compute_viewplane multiplies shift by
(`viewfac`) and what Cycles' blender_camera_viewplane does via `aspectratio`.
shift_x +0.1 moved the marker 135.0 px LEFT, shift_y +0.1 moved it 135.0 px DOWN;
world_to_camera_view agreed to 0.035 px. On the 16:9 desktop frame (AUTO fit) the
unit is the frame width instead. So a point at (u, v) of the DESKTOP frame (0-1,
v up) is centred in the portrait frame by

    shift_x = K * (u - 0.5) * 16/9        shift_y = K * (v - 0.5)

and something spanning (du, dv) of the desktop frame spans (du * K / 0.45,
dv * K) of the portrait one.

Depth of field is left alone on purpose. Cycles sizes the aperture from the focal
length and f-number only (lens / 2N), never the sensor, so the portrait frame is
the same optical image as the desktop one with more of it kept: blur relative to
the subject is identical. (Scaling N by K is the rule for keeping the same
framing on a different sensor by changing focal length - not what this does.)

  PROFILE  landscape (default) | portrait
  KOPT     portrait option in the plan: "kvar", or a constant like "k070"
  PLAN     plan file (default artifacts/portrait-plan.json)
  PREVIEW_SPP  samples for QUALITY "preview" in portrait (default 32)
"""

import bpy, os, json
import numpy as np
from mathutils import Vector

PROFILE = globals().get("PROFILE", "landscape")
if PROFILE not in ("landscape", "portrait"):
    raise ValueError("PROFILE must be landscape or portrait, not %r" % PROFILE)
PORTRAIT = PROFILE == "portrait"
KOPT = globals().get("KOPT", "k070")
PLAN = globals().get("PLAN", os.path.join(globals().get("HERE", "."), "portrait-plan.json"))
PREVIEW_SPP = int(globals().get("PREVIEW_SPP", 32))
LANDSCAPE_RES = (1920, 1080)
PORTRAIT_RES = (1080, 1350)
DESK_V_MM = 36.0 * LANDSCAPE_RES[1] / LANDSCAPE_RES[0]   # desktop vertical sensor extent

_MESHY = {'MESH', 'CURVE', 'SURFACE', 'META', 'FONT', 'GPENCIL'}


def profile_dir(landscape_dir):
    """The portrait set mirrors the landscape one under renders-sr26/portrait/,
    file for file, so the site switches sets by swapping one path prefix."""
    if not PORTRAIT:
        return landscape_dir
    assert "/renders-sr26/" in landscape_dir, landscape_dir
    return landscape_dir.replace("/renders-sr26/", "/renders-sr26/portrait/", 1)


# ---------- the plan: K and shift per still ----------
_plan_cache = {}


def plan():
    if "p" not in _plan_cache:
        with open(PLAN) as f:
            p = json.load(f)
        if KOPT not in p["options"]:
            raise KeyError("KOPT %r not in %s (has %s)" % (KOPT, PLAN, sorted(p["options"])))
        _plan_cache["p"] = p
    return _plan_cache["p"]


def still(sid):
    """(K, (shift_x, shift_y)) of still `sid` under KOPT."""
    s = plan()["options"][KOPT][sid]
    return s["K"], (s["shift"][0], s["shift"][1])


def leg_cam(a, b, t, tk=None):
    """K and shift part way along a leg from still a to still b. `t` is the leg's
    own easing (shift follows it), `tk` the schedule K may change on (defaults to
    t). Written (1-t)a + tb so both ends are each still's value bit for bit."""
    ka, sa = still(a)
    kb, sb = still(b)
    tk = t if tk is None else tk
    return ((1 - tk) * ka + tk * kb,
            ((1 - t) * sa[0] + t * sb[0], (1 - t) * sa[1] + t * sb[1]))


# Orbit frames the page paints, as the stills they sit between: a painted frame
# eases linearly (the orbit turns at a constant rate) from one still to the next
# instead of re-centring itself.
ORBIT_SEGMENTS = [(1, "orbit-001", 32, "orbit-032"), (109, "orbit-109", 120, "orbit-120")]


def orbit_cam(bf):
    """(K, shift) of orbit Blender frame bf."""
    for a, sa, b, sb in ORBIT_SEGMENTS:
        if a <= bf <= b:
            return leg_cam(sa, sb, (bf - a) / (b - a))
    raise ValueError("orbit frame %d is never painted" % bf)


def sensor_height(K):
    return DESK_V_MM / K


def set_portrait_camera(cd, K, shift):
    """Portrait version of whatever desktop camera `cd` holds: same focal length
    (the caller sets it), vertical fit at the desktop height / K, and the shift."""
    cd.sensor_fit = 'VERTICAL'
    cd.sensor_height = sensor_height(K)
    cd.shift_x, cd.shift_y = float(shift[0]), float(shift[1])


def portrait_output(quality):
    """The portrait set's output: 1080x1350 (540x675 for preview), RGBA WebP on a
    transparent film, the same for every leg - the landscape scripts' own preview
    presets differ from one another."""
    s = bpy.context.scene
    r, cy = s.render, s.cycles
    r.resolution_x, r.resolution_y = PORTRAIT_RES
    r.film_transparent = True
    r.image_settings.file_format = 'WEBP'
    r.image_settings.color_mode = 'RGBA'
    r.image_settings.quality = 80
    if quality == "preview":
        r.resolution_percentage = 50
        cy.samples = PREVIEW_SPP
    else:
        r.resolution_percentage = 100
        cy.samples = 256


def landscape_restore():
    """Put the scene back on the desktop resolution: later pose fitting reads it."""
    r = bpy.context.scene.render
    r.resolution_x, r.resolution_y = LANDSCAPE_RES


def orbit_matrix(bf, cam=None):
    """The orbit camera's world matrix at Blender frame bf (it rides a path with
    a Track To, so it has to be evaluated). `cam` defaults to the scene camera;
    pass it explicitly once a script has swapped in a camera of its own."""
    scn = bpy.context.scene
    cam = cam or scn.camera
    scn.frame_set(bf)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    return cam.evaluated_get(dg).matrix_world.copy()


def orbit_camera(bf, cam=None):
    """The orbit camera as the orbit render uses it at Blender frame bf: its
    evaluated matrix and its camera data, put into the portrait profile when
    PORTRAIT. The scene camera itself is used, not a copy, so its constraints,
    depth of field and aperture blades are the landscape orbit's exactly.
    Returns (matrix, data, undo) - call undo() before the .blend is left."""
    cam = cam or bpy.context.scene.camera
    cd = cam.data
    saved = (cd.sensor_fit, cd.sensor_height, cd.shift_x, cd.shift_y)
    if PORTRAIT:
        K, s = orbit_cam(bf)
        set_portrait_camera(cd, K, s)
    M = orbit_matrix(bf, cam)

    def undo():
        cd.sensor_fit, cd.sensor_height, cd.shift_x, cd.shift_y = saved
    return M, cd, undo


# ---------- measuring subjects (used by portrait-plan.py) ----------
def car_names():
    """Everything the orbit shows: every renderable object but the studio rig
    and throwaway copies. Objects with no faces (the orbit path) drop out in
    world_verts."""
    return [o.name for o in bpy.data.objects if o.type in _MESHY
            and not o.name.startswith(("Plane", "TMP_")) and not o.hide_render]


def world_verts(names):
    """World-space vertices of the evaluated objects, as one (n, 3) array.
    Vertices rather than bounding boxes: a box around the whole frame or the one
    panels mesh reaches corners the car never occupies, and at a head-on view the
    car's depth alone inflates it by ~12% of the frame height."""
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for nm in names:
        ob = bpy.data.objects[nm].evaluated_get(dg)
        try:
            me = ob.to_mesh()
        except RuntimeError:
            continue
        if me is not None and len(me.polygons):
            co = np.empty(len(me.vertices) * 3, dtype=np.float64)
            me.vertices.foreach_get("co", co)
            mw = np.array(ob.matrix_world)
            out.append(co.reshape(-1, 3) @ mw[:3, :3].T + mw[:3, 3])
        ob.to_mesh_clear()
    return np.concatenate(out)


def desk_uv(M, lens, pts):
    """Project world points through the DESKTOP camera at pose M (16:9, 36 mm
    horizontal fit, no shift): (u, v) in 0-1 of the desktop frame, v up."""
    Mi = np.array(M.inverted())
    c = pts @ Mi[:3, :3].T + Mi[:3, 3]
    z = -c[:, 2]
    assert (z > 0).all(), "subject behind the camera"
    return 0.5 + (c[:, 0] / z) * lens / 36.0, 0.5 + (c[:, 1] / z) * lens / DESK_V_MM


def portrait_fit(extent, K):
    """Shift that centres a desktop-frame extent (u0, u1, v0, v1) at K, and the
    fraction of the portrait frame it then spans (w, h)."""
    u0, u1, v0, v1 = extent
    shift = (K * ((u0 + u1) / 2 - 0.5) * 16 / 9, K * ((v0 + v1) / 2 - 0.5))
    return shift, ((u1 - u0) * K / 0.45, (v1 - v0) * K)


def camera_key(M, cd):
    """What has to match across a seam: pose, focal length, sensor (K) and shift."""
    q = M.to_quaternion()
    return ([round(c, 5) for c in M.translation] +
            [round(c, 5) for c in (q @ Vector((0, 0, -1)))] +
            [round(c, 5) for c in (q @ Vector((0, 1, 0)))] +
            [round(cd.lens, 4), cd.sensor_fit,
             round(cd.sensor_height if cd.sensor_fit == 'VERTICAL' else cd.sensor_width, 5),
             round(cd.shift_x, 5), round(cd.shift_y, 5)])


def seam(a, b):
    """Compare two camera_key()s: MATCH, or what differs and by how much."""
    pa, pb = np.array(a[:9], float), np.array(b[:9], float)
    pos = float(np.abs(pa[:3] - pb[:3]).max())
    ang = float(np.abs(pa[3:9] - pb[3:9]).max())
    rest_ok = a[9:] == b[9:]
    if pos <= 2e-5 and ang <= 2e-5 and rest_ok:
        return "MATCH"
    return {"pos_err": pos, "dir_err": ang, "a": a, "b": b}
