"""Straight from the steering wheel into the front-corner suspension closeup.

The cockpit run used to leave the wheel, fly 6 m back out to orbit frame 108,
and hand over to `108-susp-corner`, which immediately pushed back in to the
corner. Two moves that cancel each other out: the viewer is walked away from the
car and then walked back to it. This leg replaces both halves of that with one
flight - up out of the cage, over the left side, down onto the near-side front
corner - and the suspension beat simply opens where this lands.

  cockpit-susp  frame 1  == cockpit-dive last (square on the wheel, 43 mm)
                last     == 108-susp-corner last (the corner closeup, wheels gone)

Both of those poses are taken from the scripts that own them rather than copied,
so the seams hold by construction: artifacts/render-dive.py for the wheel and
artifacts/render-susp-corner.py for the corner. STAGE "plan" prints them, the
clearance along the path and the fade schedule, and renders nothing.

Three things this move has to get right:

**It never backs away.** Distance to whatever it is looking at grows from 0.62 m
to 2.71 m and never overshoots, so no frame of it is a wide shot.

**It gets out of the cage without grazing it.** A camera 0.6 m inside a 1.5 m
wide cage cannot leave in the direction it is looking, so the path climbs the
corridor between the rails first, the way the dive came down, and only then
drifts left. The control points were swept against a BVH of every rendered mesh:
this one clears by 0.124 m, where a direct curve out clears 0.001 m and a camera
whose near plane is 0.02 m would cut a rail open.

**It does not dolly and zoom at once.** Changing focal length while travelling is
the vertigo effect, so the 43 mm the dive ends on is held through the flight and
only opens to the closeup's 70 mm over the last third, by which point the camera
has nearly stopped.

**The wheels dissolve as it arrives.** The closeup exists to show the corner, and
the tire stands in front of it. The push fades the wheels as a separate rendered
layer because the site cross-fades that layer in the browser; here the camera is
moving the whole time, so instead the wheels are mixed with a Transparent BSDF
and the mix ramped, which lands on exactly the state the push's last frame is in:
optically absent.

**The light comes back on its own ramp, not the dissolve's.** Camera rays and
shadow rays used to share one factor, and that reads wrong: a black tire on a
black page looks gone long before the factor does, while the light it is still
holding off the hub and caliper returns as about fac**2.5, so the corner appeared
to light up after the tire had left. A Light Path switch splits the two (see
light_split_rig in render-susp-corner.py). LIGHT runs the shadow inside the
dissolve's window but on a shorter span, and LIGHT_GAMMA cancels the curvature,
so the corner is fully lit with the last of the tire still fading off it.

Pacing follows van Wijk & Nuij's perceived-speed metric (ds = |dx| / distance to
the subject), generalised to 3D the way OptFlowCam does it, with the frames then
spread through that cost by smootherstep so both ends arrive at zero velocity and
zero acceleration - the last frame of the leg differs from the still it hands over
to by less than a pixel of motion.

  STAGE    plan | render
  QUALITY  preview (45%, 48 spp, PNG) | final (100%, 256 spp, WEBP)
  N        frames in the leg
  I0/I1    chunk bounds, to keep any one call short
  PROFILE  landscape (default) | portrait: KOPT's K and lens shift from
           portrait-plan.json. K may change here, and only on the focal ramp's
           own schedule - the last stretch, once the camera has nearly stopped.
"""

import bpy, os, math, json, time
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(globals().get(
    "__file__", "/Users/aretelew/Developer/baja/baja-website/v2/artifacts/render-cockpit-susp.py")))
REPO = os.path.dirname(HERE)
exec(open(os.path.join(HERE, "render_profile.py")).read())

STAGE   = globals().get("STAGE", "plan")
QUALITY = globals().get("QUALITY", "preview")
N       = globals().get("N", 40)
I0      = globals().get("I0", 0)
I1      = globals().get("I1", None)
STEP    = globals().get("STEP", 1)
OUTDIR  = globals().get("OUTDIR", os.path.join(REPO, "public/renders-sr26/layers/"))
NAME    = globals().get("NAME", "cockpit-susp-%04d")
os.makedirs(OUTDIR, exist_ok=True)

# Where the wheels dissolve, in leg progress. They are behind the camera for the
# first half and only stand in front of the corner near the end.
FADE = globals().get("FADE", (0.60, 0.95))

# Where they stop *blocking light*, as a slice of that same window. The two are
# not the same ramp and must not be - see LIGHT_GAMMA below. Starting a quarter
# of the way in keeps the corner honestly shadowed for as long as there is a
# recognisable tire in front of it; finishing at four fifths puts the light back
# while the last of the tire is still going, rather than after it has gone.
LIGHT = globals().get("LIGHT", (0.25, 0.80))

# Measured at the landing pose, camera fade pinned at 1 and the light fade swept
# against the same frame with the wheels deleted outright: the corner sits at 32%
# of that with the tire solid and comes back as fac**2.5 (43% at fac 0.5, 70% at
# 0.8, 99% at 1). A shadow ray crosses two sidewalls, so the attenuation squares,
# and the rig lights the car from the camera side, which is where the tire
# stands. Raising the ramp to 1/gamma cancels the curve, so the light comes back
# evenly across its window instead of all at the end. Re-measure with a sweep
# rather than deriving it - the exponent depends on how many surfaces a shadow
# ray crosses, which is geometry, not arithmetic.
LIGHT_GAMMA = globals().get("LIGHT_GAMMA", 2.5)

scn = bpy.context.scene
r, cy = scn.render, scn.cycles

# ---------- the two poses this leg has to join, from the scripts that own them ----------
# __file__ goes along so each finds render_profile.py beside itself; neither is
# given PROFILE, so both only work out their desktop poses.
dive = dict(STAGE="verify", OUTDIR=OUTDIR, __file__=os.path.join(HERE, "render-dive.py"))
exec(open(os.path.join(HERE, "render-dive.py")).read(), dive)
corner = dict(STAGE="none", OUTDIR=OUTDIR, __file__=os.path.join(HERE, "render-susp-corner.py"))
exec(open(os.path.join(HERE, "render-susp-corner.py")).read(), corner)

look_at, slerp_dir, ease = dive["look_at"], dive["slerp_dir"], dive["ease"]
P_WHEEL, CEN, E1 = dive["P_WHEEL"], dive["CEN"], dive["E1"]
WHEEL_LENS, ORBIT_LENS = dive["WHEEL_LENS"], dive["ORBIT_LENS"]
M_END, FOCUS_END, FSTOP_END = corner["pose"](corner["N"] - 1)
P_END, T_END = M_END.translation.copy(), corner["T_end"]
WHEELS = corner["WHEELS"]
UP_Z = Vector((0, 0, 1))

# Up the corridor between the cage rails, then out left and down onto the corner.
# Swept for clearance - see the module docstring.
C1 = globals().get("C1", Vector((0.06, -0.10, 2.60)))
C2 = globals().get("C2", Vector((-1.60, 1.40, 3.10)))

# The focal ramp waits until the camera has slowed down - see the docstring.
ZOOM_FROM = globals().get("ZOOM_FROM", 0.62)

# The dive arrives with no depth of field and the corner closeup is shot at f/5.6.
# Cycles cannot ramp "use dof" on, so it is on for the whole leg and opened up
# instead: f/1000 blurs by well under a pixel, which is what keeps frame 1 equal
# to the dive's last frame. The squared ramp keeps it wide open until the end.
FSTOP_OPEN = globals().get("FSTOP_OPEN", 1000.0)


def bez(s):
    u = 1 - s
    return (P_WHEEL * (u ** 3) + C1 * (3 * u * u * s)
            + C2 * (3 * u * s * s) + P_END * (s ** 3))


def smootherstep(x):
    """Zero velocity AND zero acceleration at both ends, unlike smoothstep."""
    x = min(1.0, max(0.0, x))
    return x * x * x * (x * (x * 6 - 15) + 10)


def frame_at(s):
    """Everything the camera is doing at a point along the curve."""
    g = ease(s)
    z = smootherstep((g - ZOOM_FROM) / (1 - ZOOM_FROM))
    pos = bez(s)
    tgt = CEN.lerp(T_END, g)
    up = slerp_dir(E1, UP_Z, g)
    lens = WHEEL_LENS * (ORBIT_LENS / WHEEL_LENS) ** z
    fstop = FSTOP_OPEN * (FSTOP_END / FSTOP_OPEN) ** (g * g)
    return pos, tgt, up, lens, fstop


# ---------- pacing ----------
# Even apparent motion rather than even metres: the leg starts 0.62 m from the
# wheel and ends 2.71 m from the corner, and a curve walked at a constant speed
# would tear past the wheel and then crawl. Cost per step is how far the camera
# moved as a fraction of its distance to what it is looking at, plus how far it
# turned, plus the focal change - all three in radians-ish, so they add. The
# frames are then spread evenly through that cost, eased at both ends so the leg
# leaves one still pose and arrives at another with no kick.
_SS = np.linspace(0.0, 1.0, 2001)


def _cost():
    out = [0.0]
    prev = frame_at(0.0)
    for s in _SS[1:]:
        cur = frame_at(float(s))
        fa = (prev[1] - prev[0]).normalized()
        fb = (cur[1] - cur[0]).normalized()
        out.append(out[-1]
                   + (cur[0] - prev[0]).length / max((cur[0] - cur[1]).length, 0.05)
                   + math.acos(max(-1.0, min(1.0, fa.dot(fb))))
                   + abs(math.log(cur[3] / prev[3])))
        prev = cur
    return np.array(out)


COST = _cost()


def travel(i, n=None):
    n = n or N
    return float(np.interp(smootherstep(i / (n - 1)) * COST[-1], COST, _SS))


def pose(i, n=None):
    """Camera, lens, focus distance and f-stop for leg frame `i` (0-based)."""
    pos, tgt, up, lens, fstop = frame_at(travel(i, n))
    M = look_at(pos, tgt, up)
    fwd = (M.to_quaternion() @ Vector((0, 0, -1))).normalized()
    # Blender measures focus along the view axis, not as a euclidean distance.
    return M, lens, abs((tgt - pos).dot(fwd)), fstop


def portrait_cam(i, n=None):
    """Portrait (K, shift) at leg frame i: shift eases on the target's curve, K
    only on the focal ramp's - so K, like the lens, holds through the flight."""
    g = ease(travel(i, n))
    z = smootherstep((g - ZOOM_FROM) / (1 - ZOOM_FROM))
    return leg_cam("wheel", "corner", g, z)


def wheel_fade(i, n=None):
    """0 while the wheels are solid, 1 once they are optically absent to camera."""
    n = n or N
    lo, hi = FADE
    return ease(min(1.0, max(0.0, (i / (n - 1) - lo) / (hi - lo))))


def light_fade(i, n=None):
    """0 while the wheels shadow the corner, 1 once they hold no light off it.

    Runs inside the dissolve's window but on its own, shorter span, and is
    pre-compensated for LIGHT_GAMMA so that what the eye reads - the corner
    getting brighter - is the even ramp, not this factor.
    """
    n = n or N
    lo, hi = FADE
    a, b = LIGHT
    u = (i / (n - 1) - lo) / (hi - lo)
    q = ease(min(1.0, max(0.0, (u - a) / (b - a))))
    return q ** (1.0 / LIGHT_GAMMA)


if STAGE == "plan":
    dg = bpy.context.evaluated_depsgraph_get()
    trees = []
    for o in bpy.data.objects:
        if o.type != "MESH" or o.hide_render or o.name.startswith(("Plane", "BézierCircle")):
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        if len(me.polygons):
            mw = ev.matrix_world
            verts = [mw @ v.co for v in me.vertices]
            lo = Vector((min(v.x for v in verts), min(v.y for v in verts), min(v.z for v in verts)))
            hi = Vector((max(v.x for v in verts), max(v.y for v in verts), max(v.z for v in verts)))
            trees.append((o.name, lo, hi,
                          BVHTree.FromPolygons(verts, [tuple(p.vertices) for p in me.polygons])))
        ev.to_mesh_clear()

    def clearance(p):
        best, where = 1e9, None
        for name, lo, hi, tree in trees:
            dx = max(lo.x - p.x, 0, p.x - hi.x)
            dy = max(lo.y - p.y, 0, p.y - hi.y)
            dz = max(lo.z - p.z, 0, p.z - hi.z)
            if math.sqrt(dx * dx + dy * dy + dz * dz) >= best:
                continue
            hit = tree.find_nearest(p)
            if hit[0] is not None and hit[3] < best:
                best, where = hit[3], name
        return round(best, 4), where

    def key(M, lens):
        return ([round(c, 5) for c in M.translation]
                + [round(c, 5) for c in (M.to_quaternion() @ Vector((0, 0, -1)))]
                + [round(c, 5) for c in (M.to_quaternion() @ Vector((0, 1, 0)))]
                + [round(lens, 4)])

    M_dive, lens_dive = dive["dive_pose"](dive["N_DIVE"] - 1)
    seams = {
        "dive[-1] -> susp[0]": [key(M_dive, lens_dive), key(*pose(0)[:2])],
        "susp[-1] -> corner[-1]": [key(M_END, corner["src_cam"].lens), key(*pose(N - 1)[:2])],
    }
    track = []
    for i in range(N):
        M, lens, focus, fstop = pose(i)
        # The cockpit is a 2 cm hole by definition, so only the climb out counts.
        clear = clearance(M.translation) if i >= 2 else ("in the cockpit", None)
        track.append(dict(i=i, s=round(travel(i), 3),
                          pos=[round(c, 3) for c in M.translation],
                          subject=round((M.translation - CEN.lerp(T_END, ease(travel(i)))).length, 3),
                          lens=round(lens, 1), fstop=round(fstop, 1),
                          wheels=round(1 - wheel_fade(i), 2),
                          light=round(light_fade(i), 2), clear=clear))
    RESULT = {
        "seams": {k: ("MATCH" if a == b else {"a": a, "b": b}) for k, (a, b) in seams.items()},
        "min_clearance": min(t["clear"][0] for t in track if isinstance(t["clear"][0], float)),
        "subject_distance": [t["subject"] for t in track],
        "track": track,
    }
    print("[susp] " + json.dumps(RESULT), flush=True)

else:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    try: prefs.get_devices()
    except Exception: pass
    for d in prefs.devices: d.use = (d.type == 'METAL')

    prev = dict(cam=scn.camera, samples=cy.samples, pct=r.resolution_percentage,
                fmt=r.image_settings.file_format, cm=r.image_settings.color_mode,
                q=r.image_settings.quality, fp=r.filepath, frame=scn.frame_current,
                transp=r.film_transparent, tmb=cy.transparent_max_bounces)

    tmp = bpy.data.objects.new("TMP_SUSPCAM", bpy.data.cameras.new("TMP_SUSPCAM"))
    tmp.data.sensor_width = scn.camera.data.sensor_width
    tmp.data.sensor_fit = scn.camera.data.sensor_fit
    tmp.data.dof.use_dof = True
    # Pulled in from the scene camera's 0.1 for the same reason the dive pulls it
    # in: a cage rail passing the lens should sweep out of frame, not blink out.
    tmp.data.clip_start = 0.02
    scn.collection.objects.link(tmp)
    scn.camera = tmp

    r.engine = 'CYCLES'; cy.device = 'GPU'
    cy.use_adaptive_sampling = True; cy.adaptive_threshold = 0.01
    cy.use_denoising = True; cy.denoiser = 'OPENIMAGEDENOISE'
    cy.denoising_prefilter = 'ACCURATE'
    # The corner closeup's ceiling, for the same reason and so the leg lands on
    # the same light it does. See TRANSPARENT_BOUNCES in render-susp-corner.py.
    cy.transparent_max_bounces = corner["TRANSPARENT_BOUNCES"]
    r.use_persistent_data = True; r.use_motion_blur = False
    r.resolution_x, r.resolution_y = 1920, 1080
    scn.display_settings.display_device = 'sRGB'
    scn.view_settings.view_transform = 'AgX'
    if QUALITY == "preview":
        cy.samples = 48; r.resolution_percentage = 45
        r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGB'
        r.film_transparent = False
    else:
        cy.samples = 256; r.resolution_percentage = 100
        r.image_settings.file_format = 'WEBP'; r.image_settings.color_mode = 'RGBA'
        r.image_settings.quality = 80
        r.film_transparent = True
    if PORTRAIT:
        portrait_output(QUALITY)

    # The car is static; the frame only drives the orbit camera, which is unused.
    scn.frame_set(32)
    for o in [o for o in bpy.data.objects if o.type in dive["MESHY"]]:
        o.hide_render = False
        o.is_holdout = False
        o.visible_camera = not o.name.startswith("Plane")

    cam_facs, light_facs, undo = corner["light_split_rig"](
        [bpy.data.objects[n] for n in WHEELS])
    t_start = time.time()
    shot = 0
    try:
        end = N if I1 is None else min(I1, N)
        for i in range(I0, end, STEP):
            M, lens, focus, fstop = pose(i)
            tmp.matrix_world = M
            tmp.data.lens = lens
            tmp.data.dof.focus_object = None
            tmp.data.dof.focus_distance = focus
            tmp.data.dof.aperture_fstop = fstop
            if PORTRAIT:
                set_portrait_camera(tmp.data, *portrait_cam(i))
            for v in cam_facs:
                v.outputs[0].default_value = wheel_fade(i)
            for v in light_facs:
                v.outputs[0].default_value = light_fade(i)
            bpy.context.view_layer.update()
            r.filepath = os.path.join(OUTDIR, NAME % (i + 1))
            bpy.ops.render.render(write_still=True)
            shot += 1
            print("[susp] %d/%d  wheels %.2f  light %.2f  %.1fs"
                  % (i + 1, N, 1 - wheel_fade(i), light_fade(i),
                     time.time() - t_start), flush=True)
    finally:
        corner["fade_restore"](undo)
        scn.camera = prev["cam"]; bpy.data.objects.remove(tmp, do_unlink=True)
        cy.samples = prev["samples"]; r.resolution_percentage = prev["pct"]
        r.image_settings.file_format = prev["fmt"]; r.image_settings.color_mode = prev["cm"]
        r.image_settings.quality = prev["q"]; r.filepath = prev["fp"]
        cy.transparent_max_bounces = prev["tmb"]
        r.film_transparent = prev["transp"]; scn.frame_set(prev["frame"])
        if PORTRAIT:
            landscape_restore()

    RESULT = {"stage": STAGE, "quality": QUALITY, "frames": shot,
              "seconds": round(time.time() - t_start, 1), "outdir": OUTDIR}
    print("[susp] " + json.dumps(RESULT), flush=True)
