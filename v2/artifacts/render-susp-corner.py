"""Camera push into the front-left suspension corner.

The first suspension beat looks at the car head-on from the rear, which reads
one axle at a time and from too far out to see how the corner is actually put
together. This one leaves the orbit near the front three-quarter view and
pushes in and up onto the near-side front corner alone - upper and lower
wishbones, upright, hub, brake, tie rod and the coilover above them - close
enough that the linkage geometry is legible, high enough that the two arms
separate instead of stacking on each other.

Deliberately one corner, not one side: squeezing the rear trailing arm into
the same frame costs the closeup, and the front corner is the one with
something to look at.

Same archetype as artifacts/render-brake-push.py, and the site plays it through
the same `push` machinery: two passes over one set of camera poses,

  108-susp-corner-NNNN         the car with the wheels taken out of camera
  108-susp-corner-wheels-NNNN  just those wheels, alpha-cut where the car occludes

with frame 1 sitting exactly on the orbit pose so the canvas hands over unseen.
Azimuth is pinned to the orbit's own at SIDE_BF - only elevation, distance and
framing change - so the car never appears to swing, and which way the corner is
turned is chosen entirely by which frame the move leaves from.

  STAGE   = base | wheel | all
  QUALITY = preview (64 spp, 50%, PNG) | final (256 spp, 100%, WEBP)
  I0/I1   = chunk bounds, to keep any one call short
  PROFILE = landscape (default) | portrait: KOPT's K and lens shift from
            portrait-plan.json, easing from the orbit still to the corner still
"""

import bpy, os, math, time
from mathutils import Vector, Matrix
import numpy as np

HERE = os.path.dirname(os.path.abspath(globals().get(
    "__file__", "/Users/aretelew/Developer/baja/baja-website/v2/artifacts/render-susp-corner.py")))
exec(open(os.path.join(HERE, "render_profile.py")).read())

STAGE   = globals().get("STAGE", "all")
QUALITY = globals().get("QUALITY", "preview")
N       = globals().get("N", 24)
PART_N  = globals().get("PART_N", 14)
I0      = globals().get("I0", 0)
I1      = globals().get("I1", None)
OUTDIR  = globals().get("OUTDIR",
    "/Users/aretelew/Developer/baja/baja-website/v2/public/renders-sr26/layers/")
os.makedirs(OUTDIR, exist_ok=True)

scn = bpy.context.scene
r, cy = scn.render, scn.cycles

# Orbit frame the move starts from. It also fixes the azimuth, so where the
# corner ends up turned is chosen entirely by which frame it leaves from.
# Higher frame numbers here sit further round toward the nose.
SIDE_BF = globals().get("SIDE_BF", 109)
ORB     = Vector((0, 0.172, 0.419))       # Empty.001, what the orbit tracks
EL_END  = globals().get("EL_END", 30.0)   # degrees above horizontal at the end
PAD     = globals().get("PAD", 0.12)      # breathing room left around the corner
FSTOP_A = globals().get("FSTOP_A", None)  # None -> whatever the canvas uses
FSTOP_B = globals().get("FSTOP_B", 5.6)   # stopped down for the closeup
SHADOW_SPAN = 0.5                         # the wheels stop blocking light over
                                          # the first half of the move
# A shadow ray has to cross tire and rim to reach the corner, and Cycles turns a
# ray that runs out of transparent bounces fully opaque rather than letting it
# through - a cliff, not a fade. At the scene's 8, wheels the ramp believes are
# absent still hold a third of the light off the hub and caliper; at 32 the
# corner is within 1% of the same frame with the wheels deleted outright.
TRANSPARENT_BOUNCES = globals().get("TRANSPARENT_BOUNCES", 32)
NAME_BASE = globals().get("NAME_BASE", "108-susp-corner-%04d")
NAME_PART = globals().get("NAME_PART", "108-susp-corner-wheels-%04d")

MESHY = {'MESH','CURVE','SURFACE','META','FONT','GPENCIL'}
def meshes(): return [o for o in bpy.data.objects if o.type in MESHY]

WHEELS = {"DWT_A514-429M", "Right_side_front_wheel",
          "23InchRearV2", "23InchRearV2.001", "ScanBasedRom", "ScanBasedRom.001"}

# What the end of the move has to hold in frame: the near-side front corner.
# Picked by where a part actually sits rather than by name, so a renamed or
# re-imported bracket still lands in the set.
CORNER_BOX = globals().get("CORNER_BOX",
    ((-0.80, -0.20), (0.45, 1.10), (-0.25, 0.55)))

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

def slerp_dir(a, b, t):
    dot = max(-1.0, min(1.0, a.dot(b)))
    om = math.acos(dot)
    if om < 1e-6: return a.copy()
    return (a * (math.sin((1 - t) * om) / math.sin(om))
            + b * (math.sin(t * om) / math.sin(om))).normalized()

UP_Z = Vector((0, 0, 1))

# ---------- the cloud the end pose is fitted to ----------
scn.frame_set(SIDE_BF); bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()

def in_box(c):
    (x0,x1),(y0,y1),(z0,z1) = CORNER_BOX
    return x0 <= c[0] <= x1 and y0 <= c[1] <= y1 and z0 <= c[2] <= z1

def corner_cloud():
    chunks, names = [], []
    for o in bpy.data.objects:
        if o.type not in MESHY or o.name.startswith(("Plane", "BézierCircle")) or o.hide_render:
            continue
        if o.name in WHEELS: continue
        ev = o.evaluated_get(dg)
        if ev.type != 'MESH': continue
        me = ev.data; nv = len(me.vertices)
        if nv == 0: continue
        co = np.empty(nv * 3); me.vertices.foreach_get("co", co); co = co.reshape(nv, 3)
        mw = np.array(ev.matrix_world.to_4x4())
        w = co @ mw[:3, :3].T + mw[:3, 3]
        if not in_box((w.min(0) + w.max(0)) / 2): continue
        chunks.append(w[::max(1, nv // 400)]); names.append(o.name)
    return np.vstack(chunks), names

CLOUD, CORNER_NAMES = corner_cloud()

src_cam = scn.camera.data
FOCUS_OBJ = src_cam.dof.focus_object
if FSTOP_A is None: FSTOP_A = src_cam.dof.aperture_fstop
TH = (src_cam.sensor_width / 2) / src_cam.lens
TV = (src_cam.sensor_width * r.resolution_y / r.resolution_x / 2) / src_cam.lens

M0 = scn.camera.evaluated_get(dg).matrix_world.copy()
P0 = M0.translation.copy()
d_orbit = (P0 - ORB).normalized()
R_orbit = (P0 - ORB).length
AZ = math.degrees(math.atan2(d_orbit.y, d_orbit.x))

def axes(d):
    R3 = look_at(d * 10.0, Vector((0, 0, 0)), UP_Z).to_3x3()
    return (np.array((R3 @ Vector((1, 0, 0)))[:]),
            np.array((R3 @ Vector((0, 1, 0)))[:]),
            np.array((R3 @ Vector((0, 0, 1)))[:]))

def solve_end(d, cloud, iters=6):
    """distance AND target that centre `cloud` in frame and just contain it.

    Fitting to a target picked by hand leaves the subject adrift - the fit only
    guarantees it is inside, not that it is centred. Iterate instead: fit,
    measure where the projected bounds actually sit, slide the target by that
    offset, repeat. Converges in a few passes.
    """
    xc, yc, zc = axes(d)
    T = cloud.mean(0)
    for _ in range(iters):
        W = cloud - T
        a = W @ xc; b = W @ yc; c = W @ zc
        R = float(max((c + np.abs(a) / (TH * (1 - PAD))).max(),
                      (c + np.abs(b) / (TV * (1 - PAD))).max()))
        dep = np.maximum(R - c, 1e-6)
        sx = a / dep; sy = b / dep
        T = T + xc * ((sx.min() + sx.max()) / 2 * R) + yc * ((sy.min() + sy.max()) / 2 * R)
    W = cloud - T; a = W @ xc; b = W @ yc; c = W @ zc
    R = float(max((c + np.abs(a) / (TH * (1 - PAD))).max(),
                  (c + np.abs(b) / (TV * (1 - PAD))).max()))
    return Vector(T.tolist()), R

d_end = Vector((math.cos(math.radians(AZ)) * math.cos(math.radians(EL_END)),
                math.sin(math.radians(AZ)) * math.cos(math.radians(EL_END)),
                math.sin(math.radians(EL_END))))
T_end, R_end = solve_end(d_end, CLOUD)

def pose(i):
    te  = ease(i / (N - 1))
    tgt = ORB.lerp(T_end, te)
    d   = slerp_dir(d_orbit, d_end, te)
    rad = R_orbit * (R_end / R_orbit) ** te      # geometric, not linear: a push
    M = look_at(tgt + d * rad, tgt, UP_Z)        # that halves the distance each
    fwd = (M.to_quaternion() @ Vector((0, 0, -1))).normalized()
    # Blender measures focus to a focus_object along the view axis, so match
    # that rather than the euclidean distance - frame 1 has to equal the canvas.
    depth = lambda p: abs((p - M.translation).dot(fwd))
    focus = ((1 - te) * depth(FOCUS_OBJ.matrix_world.translation)
             + te * depth(T_end))
    return M, focus, FSTOP_A + (FSTOP_B - FSTOP_A) * te

# ---------- the wheels have to stop blocking light, without a step ----------
def fade_rig(objs):
    """Private material copies that can be dialled from solid to optically absent.

    In the base pass the wheels are already hidden from camera rays, but Cycles
    still bounces and shadows off them, and they shroud exactly the hub and arm
    ends this beat exists to show. Dropping them from the render fixes the light
    and breaks the handover instead - frame 1 would no longer match the canvas.
    Mix a Transparent BSDF over each wheel material and ramp it, and the shadow
    dissolves on the same scroll as the tire.

    One factor is enough here because this pass has already taken the wheels out
    of camera: the ramp is a pure light ramp. A leg that has to dissolve them on
    screen at the same time wants light_split_rig instead.
    """
    facs, undo = [], []
    for o in objs:
        for slot in o.material_slots:
            m = slot.material
            if not m or not m.use_nodes: continue
            c = m.copy(); c.name = m.name + "__shadowfade"
            # Rubber Black ships with transparent shadows off, which makes a
            # shadow ray treat it as solid however far the mix is ramped. The
            # copy is private to this pass, so turning it on here fades the
            # shadow without touching how the tire renders anywhere else.
            c.use_transparent_shadow = True
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


def light_split_rig(objs):
    """The same fade, but with what the camera sees and what blocks light split apart.

    A single factor ties the two together, and they are not perceived on the same
    curve. The tire is black on a black page, so it reads as gone well before the
    factor gets there, while the light it is still holding off the corner comes
    back roughly as fac**2.5 - a shadow ray crosses two sidewalls, so the
    attenuation is squared, and the corner is lit almost entirely from the camera
    side, which is exactly where the tire stands. Measured against the same frame
    with the wheels deleted, the hub and caliper sit at 32% with the tire solid
    and do not pass 55% until the fade is two thirds done: the corner appears to
    light up after the tire has left.

    So drive the mix with a Light Path switch. Camera rays read one value, every
    other ray - shadow, diffuse, glossy, transmission - reads another, which lets
    the light come back on its own schedule while the dissolve keeps its. A
    camera ray stays a camera ray across a transparent bounce, so looking through
    the tire still uses the camera value.

    Returns (camera_values, light_values, undo).
    """
    cams, lits, undo = [], [], []
    for o in objs:
        for slot in o.material_slots:
            m = slot.material
            if not m or not m.use_nodes: continue
            c = m.copy(); c.name = m.name + "__splitfade"
            c.use_transparent_shadow = True    # see fade_rig
            nt = c.node_tree
            out = next((n for n in nt.nodes
                        if n.type == 'OUTPUT_MATERIAL' and n.is_active_output), None)
            if not out or not out.inputs['Surface'].links:
                bpy.data.materials.remove(c); continue
            src = out.inputs['Surface'].links[0].from_socket
            mix = nt.nodes.new('ShaderNodeMixShader')
            tr  = nt.nodes.new('ShaderNodeBsdfTransparent')
            vc  = nt.nodes.new('ShaderNodeValue'); vc.outputs[0].default_value = 0.0
            vl  = nt.nodes.new('ShaderNodeValue'); vl.outputs[0].default_value = 0.0
            lp  = nt.nodes.new('ShaderNodeLightPath')
            sel = nt.nodes.new('ShaderNodeMix'); sel.data_type = 'FLOAT'
            nt.links.new(sel.inputs['Factor'], lp.outputs['Is Camera Ray'])
            nt.links.new(sel.inputs[2], vl.outputs[0])   # factor 0 -> every other ray
            nt.links.new(sel.inputs[3], vc.outputs[0])   # factor 1 -> camera rays
            nt.links.new(mix.inputs[1], src)
            nt.links.new(mix.inputs[2], tr.outputs[0])
            nt.links.new(mix.inputs['Fac'], sel.outputs[0])
            nt.links.new(out.inputs['Surface'], mix.outputs[0])
            undo.append((slot, slot.link, c))
            slot.link = 'OBJECT'; slot.material = c
            cams.append(vc); lits.append(vl)
    return cams, lits, undo

def fade_restore(undo):
    for slot, link, mat in undo:
        slot.material = None
        slot.link = link
        bpy.data.materials.remove(mat)

# ---------- render ----------
prev = dict(cam=scn.camera, samples=cy.samples, pct=r.resolution_percentage,
            fmt=r.image_settings.file_format, cm=r.image_settings.color_mode,
            q=r.image_settings.quality, fp=r.filepath, frame=scn.frame_current,
            tmb=cy.transparent_max_bounces)

prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'
try: prefs.get_devices()
except Exception: pass
for d in prefs.devices: d.use = (d.type == 'METAL')
r.engine = 'CYCLES'; cy.device = 'GPU'
cy.use_adaptive_sampling = True; cy.adaptive_threshold = 0.01
cy.use_denoising = True; cy.denoiser = 'OPENIMAGEDENOISE'; cy.denoising_prefilter = 'ACCURATE'
cy.transparent_max_bounces = TRANSPARENT_BOUNCES
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

tmp = bpy.data.objects.new("TMP_CORNERCAM", bpy.data.cameras.new("TMP_CORNERCAM"))
tmp.data.lens = src_cam.lens
tmp.data.sensor_width = src_cam.sensor_width
tmp.data.sensor_fit = src_cam.sensor_fit
tmp.data.dof.use_dof = True
scn.collection.objects.link(tmp); scn.camera = tmp
scn.frame_set(SIDE_BF)

def reset():
    for o in meshes():
        o.hide_render = False; o.is_holdout = False
        # the studio rig lights the scene but must never face camera
        o.visible_camera = not o.name.startswith("Plane")

def shoot(name):
    r.filepath = os.path.join(OUTDIR, name)
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print("[corner] %s  %.1fs" % (name, time.time() - t0), flush=True)

def place(i):
    M, focus, fstop = pose(i)
    tmp.matrix_world = M
    tmp.data.dof.focus_object = None
    tmp.data.dof.focus_distance = focus
    tmp.data.dof.aperture_fstop = fstop
    if PORTRAIT:
        # from the orbit still at frame 1 to the corner still at frame N; a push
        # the whole way, so the plan gives both ends one K
        set_portrait_camera(tmp.data, *leg_cam("orbit-%03d" % SIDE_BF, "corner", ease(i / (N - 1))))
    bpy.context.view_layer.update()

lo = I0
hi = I1 if I1 is not None else max(N, PART_N)

try:
    if STAGE in ("all", "base"):
        facs, undo = fade_rig([bpy.data.objects[n] for n in WHEELS])
        try:
            reset()
            for o in meshes():
                if not o.name.startswith("Plane"):
                    o.visible_camera = o.name not in WHEELS
            for i in range(lo, min(hi, N)):
                s = ease(min(1.0, (i / (N - 1)) / SHADOW_SPAN))
                for v in facs: v.outputs[0].default_value = s
                place(i)
                shoot(NAME_BASE % (i + 1))
        finally:
            fade_restore(undo)

    if STAGE in ("all", "wheel"):
        reset()
        for o in meshes():
            if o.name.startswith("Plane") or o.name in WHEELS:
                o.hide_render = False; o.is_holdout = False
            else:
                o.hide_render = False; o.is_holdout = True   # alpha-cut the wheels
        for i in range(lo, min(hi, PART_N)):
            place(i)
            shoot(NAME_PART % (i + 1))
finally:
    reset()
    scn.camera = prev["cam"]; bpy.data.objects.remove(tmp, do_unlink=True)
    cy.transparent_max_bounces = prev["tmb"]
    cy.samples = prev["samples"]; r.resolution_percentage = prev["pct"]
    r.image_settings.file_format = prev["fmt"]; r.image_settings.color_mode = prev["cm"]
    r.image_settings.quality = prev["q"]; r.filepath = prev["fp"]
    scn.frame_set(prev["frame"])
    if PORTRAIT:
        landscape_restore()

RESULT = {"stage": STAGE, "quality": QUALITY, "N": N, "part_n": PART_N,
          "range": [lo, hi], "side_bf": SIDE_BF,
          "azimuth_deg": round(AZ, 3), "el_end_deg": EL_END, "pad": PAD,
          "fstop": [FSTOP_A, FSTOP_B],
          "R_orbit": round(R_orbit, 4), "R_end": round(R_end, 4),
          "target_end": [round(v, 4) for v in T_end],
          "corner_parts": len(CORNER_NAMES),
          "outdir": OUTDIR}
