"""Camera arc for the brakes beat.

Replaces the straight dolly of render-brake-push.py. That move kept the side-on
orbit direction and pushed 6x into a macro of the rotor, which showed the
hardware and nothing it connects to. This swings the camera to a front-three-
quarter view and lifts it, so the front corner and the pedal box are both on
screen at once, and fades the nose bodywork off with the tire: the rotor and
caliper come out from behind the wheel while the master cylinders and pedals
come out from under the nose, on the same scroll.

It opens the sequence, lifting off the head-on nose view at orbit frame 0 rather
than the side profile - the side profile is where it hands back to, and the frame
beat plays there. Starting head-on also means the two front tires are side by
side rather than one behind the other, so neither ghosts through the other as
they dissolve.

Two passes over the same N camera poses:
  031-brake-arc-NNNN    the car with front wheels and nose panels out of camera
  031-brake-cover-NNNN  just those wheels and panels, alpha-cut where the car
                        occludes them
Frame 1 of each reproduces the orbit pose at START_BF exactly, so handing over
from the canvas is an invisible swap, and the site scrubs the move back to it.

The nose is not its own object - it is four connected islands of the one panels
mesh. They are picked out by island centroid (front of NOSE_Y) into two throwaway
copies, nose and not-nose, and the original is held out of both passes. Nothing
in the file is modified: the copies and the faded material copies are removed on
the way out.

  STAGE   = base | part | all | probe   (probe renders the landing pose only)
          | verify   (portrait or landscape: checks the seams, renders nothing)
  QUALITY = preview (64 spp, 50%, PNG) | final (256 spp, 100%, WEBP)
  I0/I1   = chunk bounds, to keep any one call short
  PROFILE = landscape (default, what ships) | portrait (4:5 phone set, same poses;
            see render_profile.py); KOPT picks the K option in portrait-plan.json.

The shipped leg was rendered with N=30, PART_N=18, EL_END=32, NOSE_PICK="deck" -
not the defaults below (see render-part-mattes.py PAUSES["brakes"]).
"""

import bpy, os, math, time
from mathutils import Vector, Matrix
import numpy as np

HERE = os.path.dirname(os.path.abspath(globals().get(
    "__file__", "/Users/aretelew/Developer/baja/baja-website/v2/artifacts/render-brake-arc.py")))
exec(open(os.path.join(HERE, "render_profile.py")).read())

STAGE   = globals().get("STAGE", "all")
QUALITY = globals().get("QUALITY", "preview")
N       = globals().get("N", 24)
PART_N  = globals().get("PART_N", 14)
I0      = globals().get("I0", 0)
I1      = globals().get("I1", None)
# Its own directory, so the straight-push layers this replaces stay untouched and
# the beat can be put back by flipping the prefixes in carSequenceModel.ts. The
# portrait set mirrors it under renders-sr26/portrait/.
OUTDIR  = globals().get("OUTDIR", profile_dir(
    "/Users/aretelew/Developer/baja/baja-website/v2/public/renders-sr26/layers/brake-arc/"))
os.makedirs(OUTDIR, exist_ok=True)

scn = bpy.context.scene
r, cy = scn.render, scn.cycles

# Blender frame the move lifts off from, which is the orbit pose it has to
# reproduce exactly on its first frame. Site frame N is Blender frame N+1, so
# 1 is the head-on nose view the sequence opens on and 32 is the side profile.
START_BF = globals().get("START_BF", 1)
# Which leg this call renders. "in" lifts off the orbit at START_BF and lands on
# the closeup; "out" starts on that same closeup pose and lands on the orbit at
# END_BF, so the beat leaves for somewhere else instead of backing out the way it
# came. The two legs share the closeup pose exactly, which is the seam that lets
# the site cut between them - and "out"'s last frame is the orbit pose the canvas
# resumes on. On the way out everything runs backwards: the covers fade back in,
# so the shadow ramp and the focus pull reverse with them.
LEG     = globals().get("LEG", "in")
END_BF  = globals().get("END_BF", 32)
TGT     = Vector((0, 0.172, 0.419))     # Empty.001, what the orbit tracks
AZ_END  = globals().get("AZ_END", 45.0) # front-three-quarter: +X is the car's
EL_END  = globals().get("EL_END", 26.0) # right, +Y its nose
PAD     = globals().get("PAD", 0.26)    # breathing room around the subject
FSTOP_A, FSTOP_B = 2.8, 8.0             # the subject is 0.9m deep here, not a
                                        # single part - it needs the stop closed
SHADOW_SPAN = 0.5                       # the covers stop blocking light over the
                                        # first half of the move
NOSE_Y  = globals().get("NOSE_Y", 0.6)  # panel islands ahead of this are "nose"
# Which of the four front islands go. The mesh has eight; the four ahead of
# NOSE_Y are the top deck (high centroid), the front fascia (on centreline) and
# the two lower front side panels (offset either way).
#   deck | deck+fascia | all
NOSE_PICK = globals().get("NOSE_PICK", "all")
# probe only: (x0, x1, y0, y1) in 0-1 of frame, y from the bottom. Renders just
# that region at full resolution, so a detail can be checked at its real pixel
# size without moving the camera that is being judged.
BORDER  = globals().get("BORDER", None)
NAME_BASE = globals().get("NAME_BASE", "000-brake-arc-%04d")
NAME_PART = globals().get("NAME_PART", "000-brake-cover-%04d")

MESHY = {'MESH','CURVE','SURFACE','META','FONT','GPENCIL'}
def meshes(): return [o for o in bpy.data.objects if o.type in MESHY]

# Both front wheels: the far one is a mirror twin, and at this azimuth it sits in
# the opened-up nose, so leaving it in walls off the pedal box from behind.
FRONT = set(globals().get("FRONT", {"Right_side_front_wheel", "DWT_A514-429M"}))
PANELS = "Panels3-28-2026.001"

# What the shot has to hold. The rotor and caliper on the near front corner, and
# the pedal box the nose was hiding - the point of the move is that one frame
# contains both.
SUBJECT = ["26-FO-BRK-I1-00 Front Brake Caliper Assem",
           "26-FO-BRK-R1-01 Front Brake Rotor",
           "26-FO-DRT-R1-01 Front Hub Linked",
           "26-FI-BRK-H1-00 Brake Masters",
           "26-FI-BRK-DX-XX Brake Pedal Linked",
           "26-FI-BRK-E1-01 Throttle Pedal"]

# ---------- same dark-material pass the orbit and layer renders run ----------
DARK = {"Rubber Black":0.035,"Black Rubber":0.035,"Black 3d Print":0.035,
        "Black Aluminum":0.035,"Black Plastic":0.030,"Black Oxide":0.030,"Rim":0.050}
for mn, val in DARK.items():
    m = bpy.data.materials.get(mn)
    if not m or not m.use_nodes: continue
    for n in m.node_tree.nodes:
        if n.type=='BSDF_PRINCIPLED' and not n.inputs['Base Color'].is_linked:
            a = n.inputs['Base Color'].default_value[3]
            n.inputs['Base Color'].default_value = (val,val,val,a)

def ease(x): return x * x * (3 - 2 * x)

def look_at(pos, tgt, up):
    z = (pos - tgt).normalized()
    x = up.cross(z).normalized()
    y = z.cross(x)
    return Matrix(((x.x, y.x, z.x, pos.x),
                   (x.y, y.y, z.y, pos.y),
                   (x.z, y.z, z.z, pos.z),
                   (0, 0, 0, 1)))

# ---------- split the nose off the panels mesh, without touching the file ----
def nose_split():
    """Two throwaway copies of the panels mesh: everything but the nose, and the
    nose. Islands are found by union-find over the edges - the nose is four of
    the eight (deck, fascia, both front lower panels) and they are the only ones
    whose centroid sits ahead of NOSE_Y."""
    import bmesh
    src = bpy.data.objects[PANELS]
    me = src.data
    nv = len(me.vertices)
    ed = np.empty(len(me.edges)*2, dtype=np.int32)
    me.edges.foreach_get("vertices", ed); ed = ed.reshape(-1, 2)
    parent = np.arange(nv, dtype=np.int32)
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    for a, b in ed:
        ra, rb = find(a), find(b)
        if ra != rb: parent[ra] = rb
    roots = np.array([find(i) for i in range(nv)])
    co = np.empty(nv*3, dtype=np.float32); me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    mw = np.array(src.matrix_world.to_4x4())
    world = co @ mw[:3, :3].T + mw[:3, 3]
    def wanted(c):
        if c[1] <= NOSE_Y: return False          # not the nose at all
        if NOSE_PICK == "all": return True
        if c[2] > 0.35: return True              # the top deck sits well above
        return NOSE_PICK == "deck+fascia" and abs(c[0]) < 0.05   # fascia is centred
    nose_roots = {int(rt) for rt in np.unique(roots)
                  if wanted(world[roots == rt].mean(0))}

    made = []
    for tag, want_nose in (("REST", False), ("NOSE", True)):
        ob = src.copy(); ob.data = me.copy(); ob.name = "TMP_PANELS_" + tag
        ob.animation_data_clear()
        scn.collection.objects.link(ob)
        bm = bmesh.new(); bm.from_mesh(ob.data); bm.verts.ensure_lookup_table()
        kill = [f for f in bm.faces
                if (int(roots[f.verts[0].index]) in nose_roots) != want_nose]
        bmesh.ops.delete(bm, geom=kill, context='FACES')
        bm.to_mesh(ob.data); bm.free()
        made.append(ob)
    return made[0], made[1], sorted(nose_roots)

# ---------- where the move starts and ends ----------
scn.frame_set(START_BF); bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
M0 = scn.camera.evaluated_get(dg).matrix_world.copy()
P0 = M0.translation.copy()
d_start = (P0 - TGT).normalized()
R_start = (P0 - TGT).length

scn.frame_set(END_BF); bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
P1 = scn.camera.evaluated_get(dg).matrix_world.translation.copy()
d_exit = (P1 - TGT).normalized()
R_exit = (P1 - TGT).length

pts = []
for nm in SUBJECT:
    o = bpy.data.objects[nm]
    pts += [o.matrix_world @ Vector(v[:]) for v in o.bound_box]
CLOUD = np.array([[p.x, p.y, p.z] for p in pts])
BRK = Vector(CLOUD.mean(0).tolist())

src_cam = scn.camera.data
FOCUS_OBJ = src_cam.dof.focus_object
tan_h = (src_cam.sensor_width / 2) / src_cam.lens
tan_v = (src_cam.sensor_width * r.resolution_y / r.resolution_x / 2) / src_cam.lens

def fit_radius(dirv, up, tgt, pad):
    """closest the camera can sit and still hold the whole subject in frame"""
    R3 = look_at(tgt + dirv * 10.0, tgt, up).to_3x3()
    W = CLOUD - np.array([tgt.x, tgt.y, tgt.z])
    a = np.abs(W @ np.array((R3 @ Vector((1,0,0)))[:]))
    b = np.abs(W @ np.array((R3 @ Vector((0,1,0)))[:]))
    c = W @ np.array((R3 @ Vector((0,0,1)))[:])
    return float(max((c + a / (tan_h * (1 - pad))).max(),
                     (c + b / (tan_v * (1 - pad))).max()))

UP_Z = Vector((0, 0, 1))
_az, _el = math.radians(AZ_END), math.radians(EL_END)
d_end = Vector((math.cos(_az)*math.cos(_el), math.sin(_az)*math.cos(_el), math.sin(_el)))
R_close = fit_radius(d_end, UP_Z, BRK, PAD)

# (target, direction, radius) at each end of this leg, orbit-side first for "in"
# and closeup-side first for "out".
ORBIT_IN  = (TGT, d_start, R_start)
ORBIT_OUT = (TGT, d_exit,  R_exit)
CLOSEUP   = (BRK, d_end,   R_close)
A, B = (ORBIT_IN, CLOSEUP) if LEG == "in" else (CLOSEUP, ORBIT_OUT)

def pose(i, leg=None):
    """i-th camera matrix, plus the focus depth and f-stop that go with it.
    `leg` defaults to LEG; verify passes the other one to check the seam between.

    Direction is slerped rather than lerped so the swing keeps a constant angular
    rate, and distance is interpolated geometrically for the same reason the
    straight push was: a linear ramp barely changes the subject size for most of
    its length and then lunges the last metre.
    """
    leg = leg or LEG
    a, b = (ORBIT_IN, CLOSEUP) if leg == "in" else (CLOSEUP, ORBIT_OUT)
    te  = ease(i / (N - 1))
    tgt = a[0].lerp(b[0], te)
    dirv = a[1].slerp(b[1], te)
    rad = a[2] * (b[2] / a[2]) ** te
    M   = look_at(tgt + dirv * rad, tgt, UP_Z)
    fwd = (M.to_quaternion() @ Vector((0, 0, -1))).normalized()
    depth = lambda p: abs((p - M.translation).dot(fwd))
    # focus rides with the target: whichever end is the orbit focuses where the
    # orbit camera does, and the closeup end focuses on the subject
    f_orbit, f_close = depth(FOCUS_OBJ.matrix_world.translation), depth(BRK)
    if leg == "in":
        return M, (1 - te) * f_orbit + te * f_close, FSTOP_A + (FSTOP_B - FSTOP_A) * te
    return M, (1 - te) * f_close + te * f_orbit, FSTOP_B + (FSTOP_A - FSTOP_B) * te

# ---------- portrait: K and lens shift along the leg ----------
# Each end of a leg is a still whose K and shift are in portrait-plan.json: the
# orbit frames centre the whole car (or the frame tubes at the side profile, where
# the frame beat plays), the closeup centres the brake parts the labels point at.
# Both ease on the camera's own curve and are each still's exactly at the ends.
# The push dollies the whole way, so the plan gives both ends one K.
STILL_OPEN, STILL_CLOSE, STILL_LAND = "orbit-%03d" % START_BF, "brake-close", "orbit-%03d" % END_BF

def portrait_cam(i, leg=None):
    """(K, shift) at pose i of the given leg."""
    leg = leg or LEG
    a, b = (STILL_OPEN, STILL_CLOSE) if leg == "in" else (STILL_CLOSE, STILL_LAND)
    return leg_cam(a, b, ease(i / (N - 1)))

# ---------- the covers have to stop blocking light, without a step ----------
def fade_rig(objs):
    """Private material copies that can be dialled from solid to optically absent.

    In the base pass the covers are already hidden from camera rays, but Cycles
    still bounces and shadows off them: a pair of black tires shrouds the hub and
    the nose deck roofs the pedal box, so both render nearly black. Dropping them
    out of the render entirely fixes the light and breaks the handover instead -
    frame 1 would no longer match the canvas. So mix a Transparent BSDF over each
    material and ramp it, which dissolves the shadow on the same scroll.
    """
    facs, undo = [], []
    for o in objs:
        for slot in o.material_slots:
            m = slot.material
            if not m or not m.use_nodes: continue
            c = m.copy(); c.name = m.name + "__shadowfade"
            nt = c.node_tree
            out = next((n for n in nt.nodes
                        if n.type == 'OUTPUT_MATERIAL' and n.is_active_output), None)
            if not out or not out.inputs['Surface'].links:
                bpy.data.materials.remove(c); continue
            src = out.inputs['Surface'].links[0].from_socket
            mix = nt.nodes.new('ShaderNodeMixShader')
            tr  = nt.nodes.new('ShaderNodeBsdfTransparent')
            val = nt.nodes.new('ShaderNodeValue'); val.outputs[0].default_value = 0.0
            nt.links.new(mix.inputs[1], src)
            nt.links.new(mix.inputs[2], tr.outputs[0])
            nt.links.new(mix.inputs['Fac'], val.outputs[0])
            nt.links.new(out.inputs['Surface'], mix.outputs[0])
            undo.append((slot, slot.link, c))
            slot.link = 'OBJECT'; slot.material = c
            facs.append(val)
    return facs, undo

def fade_restore(undo):
    for slot, link, mat in undo:
        slot.material = None
        slot.link = link
        bpy.data.materials.remove(mat)

# ---------- render ----------
prev = dict(cam=scn.camera, samples=cy.samples, pct=r.resolution_percentage,
            fmt=r.image_settings.file_format, cm=r.image_settings.color_mode,
            q=r.image_settings.quality, fp=r.filepath, frame=scn.frame_current,
            res=(r.resolution_x, r.resolution_y))

prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'
try: prefs.get_devices()
except Exception: pass
for d in prefs.devices: d.use = (d.type == 'METAL')
r.engine = 'CYCLES'; cy.device = 'GPU'
cy.use_adaptive_sampling = True; cy.adaptive_threshold = 0.01
cy.use_denoising = True; cy.denoiser = 'OPENIMAGEDENOISE'; cy.denoising_prefilter = 'ACCURATE'
r.use_persistent_data = True; r.use_motion_blur = False; r.film_transparent = True
r.resolution_x, r.resolution_y = 1920, 1080
scn.display_settings.display_device = 'sRGB'
scn.view_settings.view_transform = 'AgX'

if QUALITY == "preview":
    cy.samples = 64; r.resolution_percentage = 50
    r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'
else:
    cy.samples = 256; r.resolution_percentage = 100
    r.image_settings.file_format = 'WEBP'; r.image_settings.color_mode = 'RGBA'
    r.image_settings.quality = 80
    master_output()
if PORTRAIT:
    portrait_output(QUALITY)

tmp = bpy.data.objects.new("TMP_ARCCAM", bpy.data.cameras.new("TMP_ARCCAM"))
tmp.data.lens = src_cam.lens
tmp.data.sensor_width = src_cam.sensor_width
tmp.data.sensor_fit = src_cam.sensor_fit
if PORTRAIT:
    set_portrait_camera(tmp.data, *portrait_cam(0))
tmp.data.dof.use_dof = True
scn.collection.objects.link(tmp); scn.camera = tmp
scn.frame_set(START_BF)

REST, NOSE, nose_roots = nose_split()
orig_panels = bpy.data.objects[PANELS]
COVER = [bpy.data.objects[n] for n in FRONT] + [NOSE]
COVER_NAMES = {o.name for o in COVER}

def reset():
    for o in meshes():
        o.hide_render = (o.name == PANELS)      # the split copies stand in for it
        o.is_holdout = False
        # the studio rig lights the scene but must never face camera
        o.visible_camera = not o.name.startswith("Plane")

def shoot(name):
    r.filepath = os.path.join(OUTDIR, name)
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print("[arc] %s  %.1fs" % (name, time.time() - t0), flush=True)

def place(i, leg=None):
    M, focus, fstop = pose(i, leg)
    tmp.matrix_world = M
    tmp.data.dof.focus_object = None
    tmp.data.dof.focus_distance = focus
    tmp.data.dof.aperture_fstop = fstop
    if PORTRAIT:
        set_portrait_camera(tmp.data, *portrait_cam(i, leg))
    bpy.context.view_layer.update()

lo = I0
hi = I1 if I1 is not None else max(N, PART_N)

VERIFY = None
try:
    if STAGE == "verify":
        # Every seam this beat has, for the profile being run: the orbit frame it
        # lifts off, the held closeup where "in" hands to "out", and the orbit
        # frame "out" lands on. Each side is the camera exactly as its render
        # sets it up - pose, focal length, sensor (K) and lens shift.
        def leg_key(i, leg):
            place(i, leg)
            return camera_key(tmp.matrix_world, tmp.data)
        def orbit_key(bf):
            M, cd, undo = orbit_camera(bf, prev["cam"])
            try:
                return camera_key(M, cd)
            finally:
                undo()
        VERIFY = {
            "profile": PROFILE,
            "seams": {
                "orbit f%d -> in[0]" % START_BF: seam(orbit_key(START_BF), leg_key(0, "in")),
                "in[%d] -> out[0] (the still)" % (N - 1): seam(leg_key(N - 1, "in"), leg_key(0, "out")),
                "out[%d] -> orbit f%d" % (N - 1, END_BF): seam(leg_key(N - 1, "out"), orbit_key(END_BF)),
            },
        }
        if PORTRAIT:
            VERIFY.update(KOPT=KOPT, stills={k: still(k) for k in (STILL_OPEN, STILL_CLOSE, STILL_LAND)})
        print("[arc] VERIFY", VERIFY, flush=True)

    if STAGE in ("all", "base", "probe"):
        facs, undo = fade_rig(COVER)
        try:
            reset()
            for o in meshes():
                if not o.name.startswith("Plane"):
                    o.visible_camera = o.name not in COVER_NAMES
            if BORDER:
                r.use_border, r.use_crop_to_border = True, True
                r.border_min_x, r.border_max_x = BORDER[0], BORDER[1]
                r.border_min_y, r.border_max_y = BORDER[2], BORDER[3]
            idx = [N - 1] if STAGE == "probe" else range(lo, min(hi, N))
            for i in idx:
                t = i / (N - 1)
                s = (ease(min(1.0, t / SHADOW_SPAN)) if LEG == "in"
                     else 1.0 - ease(min(1.0, t / SHADOW_SPAN)))
                for v in facs: v.outputs[0].default_value = s
                place(i)
                shoot(NAME_BASE % (i + 1))
        finally:
            fade_restore(undo)

    if STAGE in ("all", "part"):
        reset()
        for o in meshes():
            if o.name.startswith("Plane") or o.name in COVER_NAMES:
                o.is_holdout = False
            elif o.name != PANELS:
                o.is_holdout = True          # alpha-cut the covers
        for i in range(lo, min(hi, PART_N)):
            place(i)
            shoot(NAME_PART % (i + 1))
finally:
    r.use_border = r.use_crop_to_border = False
    for ob in (REST, NOSE):
        bpy.data.meshes.remove(ob.data)      # takes the object with it
    reset()
    orig_panels.hide_render = False
    scn.camera = prev["cam"]; bpy.data.objects.remove(tmp, do_unlink=True)
    cy.samples = prev["samples"]; r.resolution_percentage = prev["pct"]
    r.image_settings.file_format = prev["fmt"]; r.image_settings.color_mode = prev["cm"]
    r.image_settings.quality = prev["q"]; r.filepath = prev["fp"]
    r.resolution_x, r.resolution_y = prev["res"]
    scn.frame_set(prev["frame"])

RESULT = {"stage": STAGE, "quality": QUALITY, "N": N, "part_n": PART_N,
          "range": [lo, hi], "az_end": AZ_END, "el_end": EL_END, "pad": PAD,
          "subject": [round(v, 4) for v in BRK], "nose_islands": len(nose_roots),
          "leg": LEG, "start_bf": START_BF, "end_bf": END_BF,
          "R_start": round(R_start, 4), "R_close": round(R_close, 4),
          "cam_close": [round(v, 4) for v in (BRK + d_end * R_close)],
          "outdir": OUTDIR}
if PORTRAIT:
    RESULT.update(profile=PROFILE, KOPT=KOPT, verify=VERIFY)
elif VERIFY:
    RESULT.update(verify=VERIFY)
