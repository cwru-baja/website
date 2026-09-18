"""Camera push-in for the brakes beat.

The brakes chapter used to blur the front tire away and leave the camera parked
on the orbit, 6.3m out, so the thing being talked about was a thumbnail-sized
smudge. This renders a dolly from that orbit pose into a closeup of the front
rotor/caliper, which the site scrubs while the tire blurs off - the tire leaves
and the camera arrives on the same scroll.

Two passes over the same 24 camera poses:
  031-brake-push-NNNN   the car with the front wheels taken out of camera
  031-brake-wheel-NNNN  just those wheels, alpha-cut where the car occludes them
Frame 1 of each reproduces the orbit pose exactly, so handing over from the
canvas is an invisible swap - the same trick render-crane.py relies on.

  STAGE   = base | wheel | all
  QUALITY = preview (64 spp, 50%, PNG) | final (256 spp, 100%, WEBP)
  I0/I1   = chunk bounds, to keep any one call short
"""

import bpy, os, math, time
from mathutils import Vector, Matrix
import numpy as np

STAGE   = globals().get("STAGE", "all")
QUALITY = globals().get("QUALITY", "preview")
N       = globals().get("N", 24)
PART_N  = globals().get("PART_N", 14)   # the tire has faded out well before this
I0      = globals().get("I0", 0)
I1      = globals().get("I1", None)
OUTDIR  = globals().get("OUTDIR",
    "/Users/aretelew/Developer/baja/baja-website/v2/public/renders-sr26/layers/")
os.makedirs(OUTDIR, exist_ok=True)

scn = bpy.context.scene
r, cy = scn.render, scn.cycles

SIDE_BF = 32                            # Blender frame the brakes beat sits on
TGT     = Vector((0, 0.172, 0.419))     # Empty.001, what the orbit tracks
PAD     = globals().get("PAD", 0.38)    # breathing room around the subject. 0.22
                                        # put the rotor a metre off the lens,
                                        # closer than the beat needs to be read
FSTOP_A, FSTOP_B = 2.8, 5.6             # f/2.8 is 41mm of depth at 1m - too thin
                                        # to hold a caliper that is 78mm deep
SHADOW_SPAN = 0.5                       # the tire stops blocking light over the
                                        # first half of the push
NAME_BASE = globals().get("NAME_BASE", "031-brake-push-%04d")
NAME_PART = globals().get("NAME_PART", "031-brake-wheel-%04d")

MESHY = {'MESH','CURVE','SURFACE','META','FONT','GPENCIL'}
def meshes(): return [o for o in bpy.data.objects if o.type in MESHY]

# Both front wheels: the far one is a mirror twin sitting directly behind the
# near one, so leaving it in makes a ghost tire appear as the near one dissolves.
FRONT = {"Right_side_front_wheel", "DWT_A514-429M"}

# What the closeup has to hold in frame. The caliper and rotor are the subject;
# the hub, studs and spherical joints are the context that makes them read as a
# corner of a car rather than a floating disc.
SUBJECT = ["26-FO-BRK-I1-00 Front Brake Caliper Assem",
           "26-FO-BRK-R1-01 Front Brake Rotor",
           "26-FO-DRT-R1-01 Front Hub Linked",
           "26-FO-DRT-R1-02 Front Hub Spacer Linked",
           "26-RO-DRT-X1-003 Rear Spindle Nut",
           "26-FO-SUS-E1-04 Spherical Joint Insert",
           "26-FO-SUS-E1-04 Spherical Joint Insert.001",
           "23-3071a SPHERICAL BEARING HOUSING_sldprt",
           "Dorman 610-308 M10-1.25 Serrated Wheel Stud",
           "Dorman 610-308 M10-1.25 Serrated Wheel Stud.001",
           "Dorman 610-308 M10-1.25 Serrated Wheel Stud.002",
           "Dorman 610-308 M10-1.25 Serrated Wheel Stud.003"]

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

# ---------- where the push starts and ends ----------
scn.frame_set(SIDE_BF); bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
M32 = scn.camera.evaluated_get(dg).matrix_world.copy()
P32 = M32.translation.copy()
d_side = (P32 - TGT).normalized()
R_side = (P32 - TGT).length

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
R_close = fit_radius(d_side, UP_Z, BRK, PAD)

def pose(i):
    """i-th camera matrix, plus the focus depth and f-stop that go with it.

    Distance is interpolated geometrically, not linearly: this is a 6x push, and
    a linear ramp spends most of its length barely changing the subject size and
    then lunges the last metre. A constant ratio per step reads as an even zoom.
    """
    te  = ease(i / (N - 1))
    tgt = TGT.lerp(BRK, te)
    rad = R_side * (R_close / R_side) ** te
    M   = look_at(tgt + d_side * rad, tgt, UP_Z)
    fwd = (M.to_quaternion() @ Vector((0, 0, -1))).normalized()
    # Blender measures focus to a focus_object along the view axis, so match that
    # rather than the euclidean distance - frame 1 has to equal the canvas.
    depth = lambda p: abs((p - M.translation).dot(fwd))
    focus = (1 - te) * depth(FOCUS_OBJ.matrix_world.translation) + te * depth(BRK)
    return M, focus, FSTOP_A + (FSTOP_B - FSTOP_A) * te

# ---------- the tire has to stop blocking light, without a step ----------
def fade_rig(objs):
    """Private material copies that can be dialled from solid to optically absent.

    In the base pass the tires are already hidden from camera rays, but Cycles
    still bounces and shadows off them, and a pair of big black tires shrouds the
    whole hub - the caliper renders nearly black. Simply dropping them out of the
    render fixes the light and breaks the handover instead: the first frame would
    no longer match the canvas. So mix a Transparent BSDF over each tire material
    and ramp it, which dissolves the shadow on the same scroll as the tire.
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
            q=r.image_settings.quality, fp=r.filepath, frame=scn.frame_current)

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

tmp = bpy.data.objects.new("TMP_BRAKECAM", bpy.data.cameras.new("TMP_BRAKECAM"))
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
    print("[brake] %s  %.1fs" % (name, time.time() - t0), flush=True)

def place(i):
    M, focus, fstop = pose(i)
    tmp.matrix_world = M
    tmp.data.dof.focus_object = None
    tmp.data.dof.focus_distance = focus
    tmp.data.dof.aperture_fstop = fstop
    bpy.context.view_layer.update()

lo = I0
hi = I1 if I1 is not None else max(N, PART_N)

try:
    if STAGE in ("all", "base"):
        facs, undo = fade_rig([bpy.data.objects[n] for n in FRONT])
        try:
            reset()
            for o in meshes():
                if not o.name.startswith("Plane"):
                    o.visible_camera = o.name not in FRONT
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
            if o.name.startswith("Plane") or o.name in FRONT:
                o.hide_render = False; o.is_holdout = False
            else:
                o.hide_render = False; o.is_holdout = True   # alpha-cut the tire
        for i in range(lo, min(hi, PART_N)):
            place(i)
            shoot(NAME_PART % (i + 1))
finally:
    reset()
    scn.camera = prev["cam"]; bpy.data.objects.remove(tmp, do_unlink=True)
    cy.samples = prev["samples"]; r.resolution_percentage = prev["pct"]
    r.image_settings.file_format = prev["fmt"]; r.image_settings.color_mode = prev["cm"]
    r.image_settings.quality = prev["q"]; r.filepath = prev["fp"]
    scn.frame_set(prev["frame"])

RESULT = {"stage": STAGE, "quality": QUALITY, "N": N, "part_n": PART_N,
          "range": [lo, hi], "brake_target": [round(v, 4) for v in BRK],
          "R_side": round(R_side, 4), "R_close": round(R_close, 4),
          "cam_close": [round(v, 4) for v in (BRK + d_side * R_close)],
          "outdir": OUTDIR}
