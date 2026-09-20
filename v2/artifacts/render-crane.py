import bpy, math, os
from mathutils import Vector, Matrix, Quaternion

# PROFILE "portrait" (with KOPT, see render_profile.py) renders the approach and
# the isolate for phones, with K and lens shift from portrait-plan.json - and a
# different approach. The desktop crane rises straight up from the side and
# lands with the nose to screen right, which is what a 16:9 frame wants and a
# 4:5 one cannot hold: the car is longer than it is wide. So the phone's crane
# is a helix instead - it keeps turning the way the orbit turns while it rises,
# from the side round to behind the car, and lands overhead with the nose to the
# top of the page. That is the pose the desktop's cockpit roll ends on
# (render-dive.py, still "roll-end" in the plan), so the dive's first frame is
# the crane's last and phones play no roll at all. See helix_poses.
HERE = os.path.dirname(os.path.abspath(globals().get(
    "__file__", "/Users/aretelew/Developer/baja/baja-website/v2/artifacts/render-crane.py")))
exec(open(os.path.join(HERE, "render_profile.py")).read())

scn = bpy.context.scene; r = scn.render; cy = scn.cycles
ARC     = globals().get("ARC", "verify")        # verify | approach | depart | isolate
QUALITY = globals().get("QUALITY", "preview")   # preview | final
N       = globals().get("N", 30)
I0      = globals().get("I0", 0)      # chunk start (0-based, inclusive)
I1      = globals().get("I1", None)   # chunk end   (0-based, exclusive)
STEP    = globals().get("STEP", 1)    # approach: every Nth frame, for preview sheets
OUTDIR  = globals().get("OUTDIR", "/private/tmp/claude-501/-Users-aretelew-Developer-baja-baja-website-v2/0e004e92-1c62-46a8-aefa-be4a4af85fea/scratchpad/crane/")
os.makedirs(OUTDIR, exist_ok=True)

TGT       = Vector((0, 0.172, 0.419))   # Empty.001, what the orbit tracks
SIDE_BF   = 32                          # Blender frame the frame-isolate beat sits on
REAR_BF   = 60                          # Blender frame the orbit resumes from -
                                        # the squarest rear pose the orbit offers
                                        # (+1.47 deg; it never hits exactly 0)
TOP_DIST  = 5.5                         # framing B
TOP_UP    = Vector((-1, 0, 0))          # screen-up at the pole -> nose stays screen-right
NOSE_UP   = Vector((0, 1, 0))           # portrait: screen-up at the pole -> nose to the top
                                        # of the page (render-dive.py's NOSE_UP)
NAME_UP   = globals().get("NAME_UP",   "crane-up-%04d")
NAME_DOWN = globals().get("NAME_DOWN", "crane-down-%04d")
NAME_ISO  = globals().get("NAME_ISO",  "top-drivetrain")

MESHY = {'MESH','CURVE','SURFACE','META','FONT','GPENCIL'}
def meshes(): return [o for o in bpy.data.objects if o.type in MESHY]
UJOINT = {o.name for o in meshes() if o.name.startswith(
          ("SDH-5-170X_CROSS","SDH-5-170X_CAP","Mock_MOOG405_Spider","Mock_MOOG405_Cap"))}
# The +X half of the front inboard linkage - yoke cup, cup tabs, inboard yoke -
# came in from CAD under generic Node_* names, while its -X mirror kept proper
# -DRT- part numbers. The name filter dropped it, so the right-hand front shaft
# rendered floating, disconnected from the torque limiter case. Listed explicitly
# rather than by a Node_* prefix: that prefix is a grab-bag in this file and also
# covers throttle and upright parts that must stay out of the drivetrain view.
LINK    = {"Node_1","Node_641","Node_643","Node_645","Node_647","Node_649",
           "Node_651","Node_653","Node_655","Node_657","Node_7325"}
DRIVE  = ({o.name for o in meshes() if "-DRT-" in o.name or "_DRT_" in o.name}
          | UJOINT | LINK | {"26-KOHLER ENGINE_step", "Outboard Yoke Spacer"})

def look_at(pos, tgt, up):
    z = (pos - tgt).normalized()
    x = up.cross(z).normalized()
    y = z.cross(x)
    return Matrix(((x.x, y.x, z.x, pos.x),
                   (x.y, y.y, z.y, pos.y),
                   (x.z, y.z, z.z, pos.z),
                   (0, 0, 0, 1)))

def cam_pose_at(bf):
    scn.frame_set(bf); bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    return scn.camera.evaluated_get(dg).matrix_world.copy()

M_side, M_rear = cam_pose_at(SIDE_BF), cam_pose_at(REAR_BF)
P_side, P_rear = M_side.translation.copy(), M_rear.translation.copy()
d_side = (P_side - TGT).normalized(); R_side = (P_side - TGT).length
d_rear = (P_rear - TGT).normalized(); R_rear = (P_rear - TGT).length
d_top  = Vector((0, 0, 1))

def slerp_dir(a, b, t):
    dot = max(-1.0, min(1.0, a.dot(b)))
    om = math.acos(dot)
    if om < 1e-6: return a.copy()
    return (a * (math.sin((1 - t) * om) / math.sin(om)) + b * (math.sin(t * om) / math.sin(om))).normalized()

def ease(x): return x * x * (3 - 2 * x)

def _point_cloud():
    """world-space sample of everything that actually renders"""
    import numpy as np
    dg = bpy.context.evaluated_depsgraph_get()
    chunks = []
    for o in bpy.data.objects:
        if o.type not in MESHY or o.name.startswith(("Plane", "B\u00e9zierCircle")) or o.hide_render:
            continue
        ev = o.evaluated_get(dg)
        if ev.type != 'MESH':
            ws = [ev.matrix_world @ Vector(c) for c in ev.bound_box]
            chunks.append(np.array([[v.x, v.y, v.z] for v in ws])); continue
        me = ev.data; nv = len(me.vertices)
        if nv == 0: continue
        co = np.empty(nv * 3); me.vertices.foreach_get("co", co); co = co.reshape(nv, 3)
        co = co[::max(1, nv // 500)]
        mw = np.array(ev.matrix_world.to_4x4())
        chunks.append(co @ mw[:3, :3].T + mw[:3, 3])
    return np.vstack(chunks)

def _fit_radius(P, dirv, up, pad=0.05):
    """smallest camera distance along dirv that keeps every sampled point in frame"""
    import numpy as np
    cam = scn.camera.data
    tan_h = (cam.sensor_width / 2) / cam.lens
    tan_v = (cam.sensor_width * r.resolution_y / r.resolution_x / 2) / cam.lens
    M = look_at(TGT + dirv * 10.0, TGT, up); R3 = M.to_3x3()
    W = P - np.array([TGT.x, TGT.y, TGT.z])
    xc = np.array((R3 @ Vector((1, 0, 0)))[:]); yc = np.array((R3 @ Vector((0, 1, 0)))[:])
    zc = np.array((R3 @ Vector((0, 0, 1)))[:])
    a = np.abs(W @ xc); b = np.abs(W @ yc); c = W @ zc
    return float(max((c + a / (tan_h * (1 - pad))).max(), (c + b / (tan_v * (1 - pad))).max()))

def radius_profile(P, n, d_a, R_a, u_a, d_b, R_b, u_b, safety=1.02):
    """lerped distance, widened where the car would otherwise leave the frame.
    The deficit is zero at both ends, so the orbit poses are preserved exactly."""
    import numpy as np
    ts   = [i / (n - 1) for i in range(n)]
    lerp = np.array([R_a + (R_b - R_a) * ease(t) for t in ts])
    req  = np.array([_fit_radius(P, slerp_dir(d_a, d_b, ease(t)),
                                 slerp_dir(u_a, u_b, ease(t))) for t in ts])
    raw = np.maximum(0.0, req * safety - lerp)
    w = 5
    dil = np.array([raw[max(0, i - w // 2):i + w // 2 + 1].max() for i in range(n)])  # keep the peak
    for _ in range(3):                                                                # then smooth it
        dil = np.array([dil[max(0, i - w // 2):i + w // 2 + 1].mean() for i in range(n)])
        dil = np.maximum(dil, 0.0)
    # Ease the widening away across the stretch that never needed it, instead of
    # clamping the end samples. Hard-pinning them leaves a step in the camera's
    # speed, which shows up as a lurch in the last frame or two of the arc - the
    # car visibly surges as it settles. smoothstep has zero slope at both ends,
    # so the arc arrives at the orbit distance already at rest.
    nz = np.nonzero(raw > 0.0)[0]
    if len(nz) == 0:
        dil[:] = 0.0
    else:
        lo, hi = int(nz[0]), int(nz[-1])
        for i in range(n):
            if lo > 0 and i < lo:
                dil[i] *= ease(i / lo)
            elif hi < n - 1 and i > hi:
                dil[i] *= ease((n - 1 - i) / (n - 1 - hi))
    dil[0] = dil[-1] = 0.0
    rad = lerp + dil
    return rad, req, lerp

# ---------- portrait: the helix ----------
# Where the phone's crane lands: straight overhead, 5.5 m up, nose to the top.
M_TOP_NOSE_UP = look_at(TGT + d_top * TOP_DIST, TGT, NOSE_UP)
AZ_SIDE = math.atan2(d_side.x, d_side.y)    # 95.3 deg: 0 is the nose, the orbit
EL_SIDE = math.asin(d_side.z)               # turns toward +90 (the car's right)
AZ_REAR = math.pi                           # straight behind the car
# Metres the helix backs off at its widest. 1.85 keeps the whole car in the 4:5
# frame through the middle of the move (it touches an edge, never crosses it),
# as the straight crane this replaces did - it widened to 7.66 m for the desktop
# frame, which fitted the portrait one too. Measured against 0.65 (never worse
# than the side view: wheels cut 8% a side all the way up) and 1.2 (4%).
HELIX_PULL = globals().get("HELIX_PULL", 1.85)
HELIX_LENS = scn.camera.data.lens           # the orbit's 70 mm, held throughout

def helix_radius(te):
    """Distance from TGT: the desktop crane's lerp from the orbit radius down to
    TOP_DIST, plus one smooth pull-back of HELIX_PULL metres at te = 0.4.

    Swinging behind the car turns it corner-on to a frame that is narrow to begin
    with, and on the lerp alone the car would overflow the 4:5 frame by 15% a
    side in the middle of the move, against 9% on the side view it leaves. The
    bump's shape - te (1 - te)^1.5 - is zero at both ends, so the seams keep
    their poses, and peaks where that overflow does."""
    lerp = R_side + (TOP_DIST - R_side) * te
    return lerp + HELIX_PULL * te * (1 - te) ** 1.5 / (0.4 * 0.6 ** 1.5)

def helix_pose(te):
    """The phone crane at eased progress te: azimuth and elevation both run on te,
    from the orbit's side pose to straight overhead from behind, so the camera
    keeps turning the way the orbit does while it climbs. Low down that reads as
    the orbit carrying on; near the top, where turning about the vertical is a
    turn about the view axis, it is what stands the car upright - so the frame
    never rolls against the horizon, and never needs a roll of its own.

    Screen-up is the elevation tangent, which is exactly look_at's world-up
    everywhere below the pole and is still defined at it: there it points from
    behind the car to its nose. Both ends are built the way the neighbouring
    renders build them, so each seam is the same matrix, not a close one."""
    if te <= 0.0:
        return look_at(TGT + d_side * R_side, TGT, Vector((0, 0, 1)))
    if te >= 1.0:
        return M_TOP_NOSE_UP.copy()
    az = AZ_SIDE + (AZ_REAR - AZ_SIDE) * te
    el = EL_SIDE + (math.pi / 2 - EL_SIDE) * te
    d = Vector((math.cos(el) * math.sin(az), math.cos(el) * math.cos(az), math.sin(el)))
    up = Vector((-math.sin(el) * math.sin(az), -math.sin(el) * math.cos(az), math.cos(el)))
    return look_at(TGT + d * helix_radius(te), TGT, up)

def helix_screen(te, pts):
    """Where the sampled car points land in the portrait frame at progress te, in
    pixels - the pose and the eased lens shift together, as the frame is rendered."""
    import numpy as np
    K, (sx, sy) = leg_cam("orbit-%03d" % SIDE_BF, "roll-end", te)
    u, v = desk_uv(helix_pose(te), HELIX_LENS, pts)
    return np.stack([(0.5 + (u - 0.5) * K / 0.45 - sx * 1.25) * PORTRAIT_RES[0],
                     (0.5 + (v - 0.5) * K - sy) * PORTRAIT_RES[1]], 1)

def helix_progress(n, samples=400):
    """te for each of n frames. Even steps in te would be slow to leave the side
    view and fast over the top - the turn about the view axis moves the car most
    on screen, and it all happens late (5 px a frame early on, 24 px at frame 24
    of 40). So the frames are spaced by how far the car actually moves across
    the frame - the mean pixel travel of points sampled over it - and that
    travel is spread with smootherstep, which starts and stops with zero speed
    and zero acceleration where the leg meets a still."""
    import numpy as np
    pts = world_verts(car_names())[::40]
    ts = np.linspace(0.0, 1.0, samples + 1)
    prev, cost = helix_screen(0.0, pts), [0.0]
    for t in ts[1:]:
        cur = helix_screen(float(t), pts)
        cost.append(cost[-1] + float(np.linalg.norm(cur - prev, axis=1).mean()))
        prev = cur
    cost = np.array(cost)
    x = np.linspace(0.0, 1.0, n)
    want = cost[-1] * (x * x * x * (x * (6 * x - 15) + 10))
    te = np.interp(want, cost, ts)
    te[0], te[-1] = 0.0, 1.0
    return [float(t) for t in te]

def helix_poses(n, progress=None):
    return [helix_pose(te) for te in (progress or helix_progress(n))]

if ARC == "verify":
    # does a plain look_at reproduce the constrained orbit camera? if so the
    # crane can hand back to the canvas with no visible jump.
    def cmp(M, up, label):
        Mr = look_at(M.translation, TGT, up)
        dq = M.to_quaternion().rotation_difference(Mr.to_quaternion())
        return {label: {"angle_deg": round(math.degrees(dq.angle), 4),
                        "pos_err": round((M.translation - Mr.translation).length, 6)}}
    out = {}
    out.update(cmp(M_side, Vector((0,0,1)), "side_frame32"))
    out.update(cmp(M_rear, Vector((0,0,1)), "rear_frame62"))
    out["radii"] = {"side": round(R_side,4), "rear": round(R_rear,4), "top": TOP_DIST}
    out["screen_right_side"] = [round(c,4) for c in (M_side.to_3x3() @ Vector((1,0,0)))]
    out["screen_right_top"]  = [round(c,4) for c in (look_at(TGT + d_top*TOP_DIST, TGT, TOP_UP).to_3x3() @ Vector((1,0,0)))]
    scn.frame_set(1)
    RESULT = out
else:
    prev = dict(cam=scn.camera, samples=cy.samples, pct=r.resolution_percentage,
                fmt=r.image_settings.file_format, cm=r.image_settings.color_mode,
                q=r.image_settings.quality, fp=r.filepath, frame=scn.frame_current)
    tmp = bpy.data.objects.new("TMP_CRANECAM", bpy.data.cameras.new("TMP_CRANECAM"))
    tmp.data.lens = scn.camera.data.lens
    scn.collection.objects.link(tmp); scn.camera = tmp
    if QUALITY == "preview":
        cy.samples = 64; r.resolution_percentage = 50
        r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'
    else:
        cy.samples = 256; r.resolution_percentage = 100
        r.image_settings.file_format = 'WEBP'; r.image_settings.color_mode = 'RGBA'
        r.image_settings.quality = 80
        master_output()
    scn.frame_set(SIDE_BF)   # car is static; frame only drives the (now unused) orbit cam

    def setvis(names):
        for o in meshes():
            if o.name.startswith("Plane"): o.hide_render = False
            else: o.hide_render = names is not None and o.name not in names
            o.is_holdout = False

    def shoot(name):
        r.filepath = os.path.join(OUTDIR, name)
        bpy.ops.render.render(write_still=True)
        print("[crane] %s" % name, flush=True)

    CLOUD = _point_cloud()

    def arc_poses(n, d_a, R_a, up_a, d_b, R_b, up_b):
        rad, req, lerp = radius_profile(CLOUD, n, d_a, R_a, up_a, d_b, R_b, up_b)
        bad = [i for i in range(n) if rad[i] < req[i] - 1e-6]
        print("[fit] widened peak %+.2fm | still clipping at %d/%d frames"
              % (float((rad - lerp).max()), len(bad), n), flush=True)
        out = []
        for i in range(n):
            te = ease(i / (n - 1))
            out.append(look_at(TGT + slerp_dir(d_a, d_b, te) * float(rad[i]),
                               TGT, slerp_dir(up_a, up_b, te)))
        return out

    UP_Z = Vector((0, 0, 1))
    if PORTRAIT and ARC not in ("approach", "isolate"):
        raise ValueError("portrait renders only the approach and the isolate; the page plays nothing else")
    if ARC == "approach":      # side view -> straight overhead
        setvis(None)
        if PORTRAIT:           # side view -> overhead from behind, nose up (helix_pose)
            progress = helix_progress(N)
            poses = helix_poses(N, progress)
            portrait_output(QUALITY)
        else:
            poses = arc_poses(N, d_side, R_side, UP_Z, d_top, TOP_DIST, TOP_UP)
        for i in range(I0, I1 if I1 is not None else N, STEP):
            tmp.matrix_world = poses[i]
            if PORTRAIT:
                set_portrait_camera(tmp.data, *leg_cam("orbit-%03d" % SIDE_BF, "roll-end",
                                                       progress[i]))
            bpy.context.view_layer.update(); shoot(NAME_UP % (i + 1))
    elif ARC == "depart":      # straight overhead -> rear view
        setvis(None)
        poses = arc_poses(N, d_top, TOP_DIST, TOP_UP, d_rear, R_rear, UP_Z)
        for i in range(I0, I1 if I1 is not None else N):
            tmp.matrix_world = poses[i]
            bpy.context.view_layer.update(); shoot(NAME_DOWN % (i + 1))
    elif ARC == "isolate":     # drivetrain, seen from directly overhead
        setvis(DRIVE)
        tmp.matrix_world = look_at(TGT + d_top * TOP_DIST, TGT, TOP_UP)
        if PORTRAIT:           # where the helix lands: nose to the top of the page
            tmp.matrix_world = M_TOP_NOSE_UP
            portrait_output(QUALITY)
            set_portrait_camera(tmp.data, *still("roll-end"))
        bpy.context.view_layer.update(); shoot(NAME_ISO)

    setvis(None)
    if PORTRAIT:
        landscape_restore()
    scn.camera = prev["cam"]; bpy.data.objects.remove(tmp, do_unlink=True)
    cy.samples = prev["samples"]; r.resolution_percentage = prev["pct"]
    r.image_settings.file_format = prev["fmt"]; r.image_settings.color_mode = prev["cm"]
    r.image_settings.quality = prev["q"]; r.filepath = prev["fp"]; scn.frame_set(prev["frame"])
    RESULT = {"arc": ARC, "quality": QUALITY, "frames": N}
