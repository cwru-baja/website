"""The cockpit run: the camera leaves the overhead drivetrain pose, turns the car
upright, drops through the roll cage into the driver's seat and lands square on
the steering wheel. A third leg here lifts it back out over the left side onto
the orbit frame the front-corner suspension push starts from; the site no longer
plays that one (see below).

Three rendered legs, each one handing over to the next on an identical frame:

  cockpit-roll  frame 1  == 059-crane-up-0030   (the overhead pose the crane lands on)
                last     == overhead, nose to the top of the page
  cockpit-dive  frame 1  == cockpit-roll last
                last     == square on the wheel, 0.62 m at 43 mm
  cockpit-exit  frame 1  == cockpit-dive last
                last     == orbit frame 109 == full/0109.webp

That last equality is what let the canvas take the frame back: the site handed
over to `108-susp-corner`, whose own frame 1 is the same orbit pose.

The site does not play `cockpit-exit` any more (2026-09-17). Flying 6 m out to
that orbit pose only to push straight back in to the corner walked the viewer
away from the car and back again, so artifacts/render-cockpit-susp.py replaces
both halves with one flight from the wheel onto the corner closeup. This leg
still renders, and the model can be pointed back at it; its frames are still in
layers/. The roll and the dive are unchanged and still shipped.

Both moves are parametrised the way `render-susp-corner.py` parametrises its
push: geometrically in distance-to-subject rather than linearly in position. A
linear drop from 5.5 m to 0.62 m spends most of its frames far away and then
lets the wheel explode across the last four; a geometric one grows the subject
at a constant rate per frame. The focal ramp is geometric for the same reason,
and only exists because the wheel will not fit at 70 mm from anywhere a camera
can actually sit: past 0.64 m the bodywork behind the seat is in the way.

  STAGE    roll | dive | exit | all | verify
  QUALITY  preview (45%, 48 spp, PNG) | final (100%, 256 spp, WEBP)
  STEP     render every Nth frame - preview contact sheets
  PROFILE  landscape (default) | portrait: roll and dive only, with KOPT's K and
           lens shift from portrait-plan.json (see render_profile.py)
"""

import bpy, os, math, time
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(globals().get(
    "__file__", "/Users/aretelew/Developer/baja/baja-website/v2/artifacts/render-dive.py")))
exec(open(os.path.join(HERE, "render_profile.py")).read())

STAGE   = globals().get("STAGE", "verify")
QUALITY = globals().get("QUALITY", "preview")
I0      = globals().get("I0", 0)
I1      = globals().get("I1", None)
STEP    = globals().get("STEP", 1)
OUTDIR  = globals().get(
    "OUTDIR", "/Users/aretelew/Developer/baja/baja-website/v2/public/renders-sr26/layers/")
os.makedirs(OUTDIR, exist_ok=True)

N_ROLL = globals().get("N_ROLL", 20)
N_DIVE = globals().get("N_DIVE", 40)
N_EXIT = globals().get("N_EXIT", 40)

scn = bpy.context.scene
r, cy = scn.render, scn.cycles

TGT      = Vector((0, 0.172, 0.419))    # Empty.001, what the orbit tracks
TOP_DIST = 5.5                          # the crane's overhead framing
TOP_UP   = Vector((-1, 0, 0))           # screen-up where the crane lands: nose screen-right
NOSE_UP  = Vector((0, 1, 0))            # screen-up after the roll: nose to the top of the page
UP_Z     = Vector((0, 0, 1))

# The steering wheel's own frame, measured off the column assembly. E0 runs down
# the column from the wheel toward the rack, so -E0 is the face normal and the
# only direction a camera can be square to it from.
E0  = Vector((0.0011, 0.9729, -0.2312)).normalized()
E1  = Vector((-0.0002, 0.2312, 0.9729)).normalized()
CEN = Vector((-0.0002, 0.439, 0.4752))

# 0.62 m is as far back as the wheel's axis stays clear: at 0.67 m the panel
# behind the seat closes over it. 43 mm then reproduces the framing the flown-out
# wheel had - 57% of frame width - which is what this beat replaces.
WHEEL_DIST = globals().get("WHEEL_DIST", 0.62)
WHEEL_LENS = globals().get("WHEEL_LENS", 43.0)
ORBIT_LENS = 70.0
LAND_BF    = 109                        # orbit frame the exit hands back on (web index 108)
# Swinging the camera's direction from the wheel's axis toward the landing pose
# walks it out through the left cage rail at seat height, 20 cm from a roll bar -
# a frame of blue tube and sponsor decal that reads as a glitch, not a move.
# Growing the radius along the wheel axis is what does it: that axis points 13
# degrees up and backwards, so the camera rises into the rear hoop. The car is
# 1.5 m across and the camera sits 0.6 m from its middle, so no direction gets it
# out cleanly - the only clear way out is back up the corridor the dive came
# down, between the two cage rails at x = +-0.28. So the exit is a positional
# curve rather than a swing: up that corridor first, then left and around.
EXIT_C1 = globals().get("EXIT_C1", Vector((0.0, -0.10, 1.75)))   # straight up, still inside
EXIT_C2 = globals().get("EXIT_C2", Vector((-2.6, 0.60, 2.40)))   # out left, above the cage

NAME_ROLL = globals().get("NAME_ROLL", "cockpit-roll-%04d")
NAME_DIVE = globals().get("NAME_DIVE", "cockpit-dive-%04d")
NAME_EXIT = globals().get("NAME_EXIT", "cockpit-exit-%04d")

MESHY = {'MESH', 'CURVE', 'SURFACE', 'META', 'FONT', 'GPENCIL'}
def meshes(): return [o for o in bpy.data.objects if o.type in MESHY]

# ---------- same dark-material pass the orbit and layer renders run ----------
DARK = {"Rubber Black":0.035, "Black Rubber":0.035, "Black 3d Print":0.035,
        "Black Aluminum":0.035, "Black Plastic":0.030, "Black Oxide":0.030, "Rim":0.050}
for mn, val in DARK.items():
    m = bpy.data.materials.get(mn)
    if not m or not m.use_nodes: continue
    for n in m.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED' and not n.inputs['Base Color'].is_linked:
            a = n.inputs['Base Color'].default_value[3]
            n.inputs['Base Color'].default_value = (val, val, val, a)


def look_at(pos, tgt, up):
    z = (pos - tgt).normalized()
    x = up.cross(z).normalized()
    y = z.cross(x)
    return Matrix(((x.x, y.x, z.x, pos.x),
                   (x.y, y.y, z.y, pos.y),
                   (x.z, y.z, z.z, pos.z),
                   (0, 0, 0, 1)))

def slerp_dir(a, b, t):
    dot = max(-1.0, min(1.0, a.dot(b)))
    om = math.acos(dot)
    if om < 1e-6: return a.copy()
    return (a * (math.sin((1 - t) * om) / math.sin(om))
            + b * (math.sin(t * om) / math.sin(om))).normalized()

def ease(x): return x * x * (3 - 2 * x)

def cam_pose_at(bf):
    scn.frame_set(bf); bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    return scn.camera.evaluated_get(dg).matrix_world.copy()


# ---------- the three legs ----------
P_TOP   = TGT + Vector((0, 0, 1)) * TOP_DIST
P_WHEEL = CEN - E0 * WHEEL_DIST
D_TOP   = (P_TOP - CEN).length          # how far the overhead pose is from the wheel

M_LAND = cam_pose_at(LAND_BF)
P_LAND = M_LAND.translation.copy()
D_LAND = (P_LAND - TGT).normalized()
R_LAND = (P_LAND - TGT).length


def roll_pose(i, n=None):
    n = n or N_ROLL
    te = ease(i / (n - 1))
    return look_at(P_TOP, TGT, slerp_dir(TOP_UP, NOSE_UP, te)), ORBIT_LENS


def _dive_s(te):
    """Position along the straight drop that sits at the geometric distance.

    The path is a plumb line between the two rails of the cage, which is the
    whole point of the beat - so it is the parameter that gets reshaped, not the
    path. Monotonic in s, so bisection is safe.
    """
    want = D_TOP * (WHEEL_DIST / D_TOP) ** te
    lo, hi = 0.0, 1.0
    for _ in range(48):
        mid = (lo + hi) / 2
        if (P_TOP.lerp(P_WHEEL, mid) - CEN).length > want: lo = mid
        else: hi = mid
    return (lo + hi) / 2


def dive_pose(i, n=None):
    n = n or N_DIVE
    te = ease(i / (n - 1))
    pos = P_TOP.lerp(P_WHEEL, _dive_s(te))
    tgt = TGT.lerp(CEN, te)
    up = slerp_dir(NOSE_UP, E1, te)
    lens = ORBIT_LENS * (WHEEL_LENS / ORBIT_LENS) ** te
    return look_at(pos, tgt, up), lens


def _bez3(t):
    u = 1 - t
    return (P_WHEEL * (u ** 3) + EXIT_C1 * (3 * u * u * t)
            + EXIT_C2 * (3 * u * t * t) + P_LAND * (t ** 3))

R_EXIT_0 = (P_WHEEL - CEN).length       # == WHEEL_DIST
R_EXIT_1 = (P_LAND - CEN).length

def _exit_s(te):
    """Where along the curve the camera is the geometric distance from the wheel.

    Same trick as the dive: the curve is fixed by what it has to clear, so it is
    the parameter that gets reshaped. Distance from CEN is monotonic along it.
    """
    want = R_EXIT_0 * (R_EXIT_1 / R_EXIT_0) ** te
    lo, hi = 0.0, 1.0
    for _ in range(48):
        mid = (lo + hi) / 2
        if (_bez3(mid) - CEN).length < want: lo = mid
        else: hi = mid
    return (lo + hi) / 2


def exit_pose(i, n=None):
    n = n or N_EXIT
    te = ease(i / (n - 1))
    pos = _bez3(_exit_s(te))
    tgt = CEN.lerp(TGT, te)
    up = slerp_dir(E1, UP_Z, te)
    lens = WHEEL_LENS * (ORBIT_LENS / WHEEL_LENS) ** te
    return look_at(pos, tgt, up), lens


LEGS = {
    "roll": (roll_pose, N_ROLL, NAME_ROLL),
    "dive": (dive_pose, N_DIVE, NAME_DIVE),
    "exit": (exit_pose, N_EXIT, NAME_EXIT),
}

# Portrait: the stills each leg runs between. The roll turns the camera in place,
# so K may change across it; the dive travels the whole way, so the plan gives
# both its ends one K. Shift eases on the leg's own curve either way.
PORTRAIT_LEGS = {"roll": ("crane-top", "roll-end"), "dive": ("roll-end", "wheel")}

def portrait_cam(leg, i, n):
    a, b = PORTRAIT_LEGS[leg]
    return leg_cam(a, b, ease(i / (n - 1)))


if STAGE == "verify":
    # Does a plain look_at reproduce the constrained orbit camera at the frame the
    # exit hands back on? If not, the canvas would step when it takes over.
    Mr = look_at(P_LAND, TGT, UP_Z)
    dq = M_LAND.to_quaternion().rotation_difference(Mr.to_quaternion())
    out = {"land_frame": LAND_BF,
           "land_angle_err_deg": round(math.degrees(dq.angle), 4),
           "land_pos_err": round((M_LAND.translation - Mr.translation).length, 6),
           "land_radius": round(R_LAND, 4)}
    # Seams: every leg's first pose must equal the previous leg's last.
    def key(M, lens):
        return [round(c, 5) for c in M.translation] + \
               [round(c, 5) for c in (M.to_quaternion() @ Vector((0, 0, -1)))] + \
               [round(c, 5) for c in (M.to_quaternion() @ Vector((0, 1, 0)))] + [round(lens, 4)]
    crane_end = (look_at(P_TOP, TGT, TOP_UP), ORBIT_LENS)
    seams = {
        "crane_end -> roll[0]":  [key(*crane_end),               key(*roll_pose(0))],
        "roll[-1] -> dive[0]":   [key(*roll_pose(N_ROLL - 1)),   key(*dive_pose(0))],
        "dive[-1] -> exit[0]":   [key(*dive_pose(N_DIVE - 1)),   key(*exit_pose(0))],
        "exit[-1] -> orbit109":  [key(*exit_pose(N_EXIT - 1)),   key(M_LAND, ORBIT_LENS)],
    }
    out["seams"] = {k: ("MATCH" if a == b else {"a": a, "b": b}) for k, (a, b) in seams.items()}
    # Where the dive crosses the cage rails, and how wide the swing gets.
    out["dive_track"] = [{"i": i, "pos": [round(c, 3) for c in dive_pose(i)[0].translation],
                          "lens": round(dive_pose(i)[1], 1)}
                         for i in range(0, N_DIVE, max(1, N_DIVE // 8))]
    out["exit_track"] = [{"i": i, "pos": [round(c, 3) for c in exit_pose(i)[0].translation],
                          "lens": round(exit_pose(i)[1], 1)}
                         for i in range(0, N_EXIT, max(1, N_EXIT // 8))]
    scn.frame_set(1)
    RESULT = out

else:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    try: prefs.get_devices()
    except Exception: pass
    for d in prefs.devices: d.use = (d.type == 'METAL')

    prev = dict(cam=scn.camera, samples=cy.samples, pct=r.resolution_percentage,
                fmt=r.image_settings.file_format, cm=r.image_settings.color_mode,
                q=r.image_settings.quality, fp=r.filepath, frame=scn.frame_current,
                transp=r.film_transparent)

    tmp = bpy.data.objects.new("TMP_DIVECAM", bpy.data.cameras.new("TMP_DIVECAM"))
    # DOF off for the same reason the crane leaves it off: these legs travel from
    # 5.5 m to 0.6 m, and any fixed focus is wrong for most of that. Clip start is
    # pulled in from the scene camera's 0.1 so a cage rail passing the lens sweeps
    # out of frame instead of blinking out of existence.
    tmp.data.dof.use_dof = False
    tmp.data.clip_start = 0.02
    tmp.data.sensor_width = scn.camera.data.sensor_width
    scn.collection.objects.link(tmp); scn.camera = tmp

    r.engine = 'CYCLES'; cy.device = 'GPU'
    cy.use_adaptive_sampling = True; cy.adaptive_threshold = 0.01
    cy.use_denoising = True; cy.denoiser = 'OPENIMAGEDENOISE'
    cy.denoising_prefilter = 'ACCURATE'
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
        if STAGE not in PORTRAIT_LEGS:
            raise ValueError("portrait renders STAGE roll or dive; the page plays no other leg here")
        portrait_output(QUALITY)

    # The car is static; the frame only drives the orbit camera, which is unused here.
    scn.frame_set(32)
    for o in meshes():
        o.hide_render = False; o.is_holdout = False
        o.visible_camera = not o.name.startswith("Plane")

    t_start = time.time()
    shot = 0
    for leg in (["roll", "dive", "exit"] if STAGE == "all" else [STAGE]):
        pose_fn, n, name_fmt = LEGS[leg]
        end = n if I1 is None else min(I1, n)
        for i in range(I0, end, STEP):
            M, lens = pose_fn(i, n)
            tmp.data.lens = lens
            tmp.matrix_world = M
            if PORTRAIT:
                set_portrait_camera(tmp.data, *portrait_cam(leg, i, n))
            bpy.context.view_layer.update()
            r.filepath = os.path.join(OUTDIR, name_fmt % (i + 1))
            bpy.ops.render.render(write_still=True)
            shot += 1
            print("[dive] %s %d/%d  %.1fs" % (leg, i + 1, n, time.time() - t_start), flush=True)

    scn.camera = prev["cam"]; bpy.data.objects.remove(tmp, do_unlink=True)
    cy.samples = prev["samples"]; r.resolution_percentage = prev["pct"]
    r.image_settings.file_format = prev["fmt"]; r.image_settings.color_mode = prev["cm"]
    r.image_settings.quality = prev["q"]; r.filepath = prev["fp"]
    r.film_transparent = prev["transp"]; scn.frame_set(prev["frame"])
    if PORTRAIT:
        landscape_restore()
    RESULT = {"stage": STAGE, "quality": QUALITY, "frames": shot,
              "seconds": round(time.time() - t_start, 1)}
