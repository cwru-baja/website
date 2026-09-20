"""The homepage hero still: one frame, matched to the camera that shot
`src/assets/homepage-car-sr26.webp`, re-rendered with tyres that read as rubber
rather than as a hole in the page.

The pose was not recorded anywhere, so it was solved back out of the existing
PNG's alpha channel. Two independent measurements agree on it:

  * silhouette IoU - project every car vertex through a candidate camera,
    rasterise, and score against the hero's alpha. Peaks at az 130 deg,
    el ~1 deg, roll 0, with distance only weakly constrained (0.80 at G=400,
    and the residual is point-cloud sparsity inside solid panels, not outline
    error).
  * bounding-box aspect - the hero's car occupies a box of pixel aspect 1.355.
    That ratio is a pure function of (az, el, distance) and is what pins the
    distance the IoU plateau leaves open: d=3.75 predicts 1.3541, d=3.5 gives
    1.3444 and d=4.0 gives 1.3767.

So the framing is not fitted by eye - LENS is computed from FILL_W, the
fraction of frame width the car spans in the original (0.9442), and the shift
puts the car's projected centre where the original has it. Render at any
resolution and the framing follows.

The car is static: the only animated object in the scene is the orbit camera,
so no frame needs choosing.

  STAGE    preview (25%, 64 spp) | final (100%, 384 spp, RGBA PNG)
  VARIANT  current | lift | full  - see TYRE below

This writes a PNG into OUTDIR, but the shipped file is WebP - a straight PNG
copy would put 9 MB back where 1.4 MB now sits. Convert before shipping:

  node -e "require('sharp')('artifacts/hero/<name>.png')
    .webp({quality:95,alphaQuality:100,effort:6})
    .toFile('src/assets/homepage-car-sr26.webp')"

alphaQuality 100 keeps the alpha channel bit-exact, which HeroShell's
CAR_IN_SRC constants are measured from. Lossy alpha would move them.
"""

import bpy, os, math, time
import numpy as np
from mathutils import Vector, Matrix

STAGE   = globals().get("STAGE", "preview")
VARIANT = globals().get("VARIANT", "current")
OUTDIR  = globals().get("OUTDIR", "/Users/aretelew/Developer/baja/baja-website/v2/artifacts/hero/")
NAME    = globals().get("NAME", None)
os.makedirs(OUTDIR, exist_ok=True)

scn = bpy.context.scene
r, cy = scn.render, scn.cycles

# ---------- the solved pose ----------
AZ      = math.radians(globals().get("AZ_DEG", 130.0))
EL      = math.radians(globals().get("EL_DEG", 1.0))
DIST    = globals().get("DIST", 3.75)
FILL_W  = globals().get("FILL_W", 0.9442)   # car's width as a fraction of the frame
CX, CY  = 0.4842, 0.4988                    # where the car's box centres, in frame units

RES = globals().get("RES", (4200, 3000))

MESHY = {'MESH'}
def car_objects():
    return [o for o in scn.objects
            if o.type in MESHY and not o.name.startswith("Plane") and not o.hide_render]


# ---------- tyre treatment ----------
# The intuitive read - "the tyres are too dark, brighten them" - is wrong, and
# following it would make them look like grey plastic. 0.035 base colour is
# already generous: physicallybased.info measures tyre albedo at 0.023, so the
# scene is 50% *above* reference and at the conventional dielectric floor.
#
# What is actually broken is the specular layer. Rubber Black has Specular IOR
# Level 0.15 against a 0.5 default, and the manual defines that input as an
# adjustment where "0.5 means no adjustment, 0 removes all reflections, 1
# doubles them" - the multiplier is 2 x level. At IOR 1.45 the material's F0 is
# 0.0337, and 0.15 scales it by 0.3 to about 0.010. Roughly 70% of the tyre's
# facing reflectivity has been deleted. Roughness 0.344 against a 0.7 reference
# compounds it: a tight lobe on a dark surface puts what little specular energy
# survives into one small hot spot instead of spreading it down the sidewall.
#
# Two things then finish the job. The world Background strength is 0.0, so there
# is no environment for a sheen to reflect; and film_transparent means the tyre
# is composited onto a dark page with no background behind it to separate its
# edge. Dark + no fill + no spec + no rim is a silhouette.
#
# Measured against the shipped PNG on a sidewall patch, in sRGB 0-255: the
# original hero reads 70, the scene as saved today reads 116, and a body panel
# moves only 161 -> 170 between them. So the lighting has not drifted since the
# hero was shot - the tyre material has already been revised once, and simply
# re-rendering recovers most of the complaint on its own.
#
#   current  what the scene renders today - the control, sidewall ~116
#   spec     the actual fix, and nothing else: specular restored to the default
#            and roughness onto the reference. Base colour deliberately left at
#            0.035 - it is already 50% above measured tyre albedo, and raising
#            it is what turns a tyre into grey plastic
#   dust     spec plus a light Sheen layer, the manual's "dust on arbitrary
#            materials", warm-tinted. Weight 0.07, not the 0.2 that reads chalky
#   rim      dust plus the separation film_transparent takes away: a warm rim
#            light skimming the tyre shoulders against the dark page
#   lift     first attempt, kept as the overshoot reference - sidewall ~138
#   full     lift plus rim and environment - sidewall ~144, visibly chalky
# Integration variants. The tyre work above fixed a material; these fix a
# *compositing* problem, which is a different thing. Measured on the shipped PNG:
# the car's darkest 5% is 61 sRGB against a #0a0a0a (10 sRGB) page - only 2.4% of
# the car is darker than 40 - and its mean colour is (111,131,142), blue-biased,
# on a page whose only chroma is red. There is no value overlap and no colour
# agreement, because the scene has one white key and world strength 0.0. Nothing
# on the car has ever seen the environment it is being placed in.
#
#   plate-env   give the world the page's own red at low strength, so the car
#               picks up red ambient and red reflections in its dark side
#   plate-rim   plate-env plus a red kicker from where the page's glow sits
#   plate-deep  plate-rim with the key pulled down, so the shadow side falls
#               toward the page's black instead of floating above it
PLATE_RED = (0.055, 0.010, 0.012)      # ~#3d0a0a, the aurora's darkest red, linear

# Backlight colours sampled from the car's own livery rather than invented. A
# saturation-weighted hue histogram over the shipped render's chromatic pixels
# (34.7% of the car) comes back overwhelmingly cyan, with one magenta accent:
#     hue 190-200  36.7%  #16799f      hue 180-190  26.5%  #4099a3
#     hue 200-210  14.0%  #1e5b82      hue 320-330   3.7%  #6a1748
# Those are surface colours, so they are darkened by their own albedo; as
# *emitters* they get taken to full value at the same hue and saturation.
CYAN    = (0.10, 0.62, 0.85)           # hue 193, the livery's dominant teal
MAGENTA = (0.85, 0.13, 0.48)           # hue 325, the accent
# Not sampled from the car - this one is the page's, taken from the aurora's
# brightest red (#bc2121). It is the only outside colour in the rig, and it is
# there because the background is what motivates it.
PAGE_GLOW = (1.00, 0.20, 0.16)

# What the measurements actually say, decoded straight from the shipped PNG
# (mean RGB 51/69/81, p01 2.0, median 52.7, p99 192, 25.5% below 32, 0.00%
# above 245): the car is not uniformly too bright. Its darks already sit *below*
# the page's #0a0a0a, so a quarter of it punches holes rather than floating. The
# real tells are the cool cast on a red page (R-B = -29) and, above all, that
# nothing on the car ever reaches a highlight - a flat 192 ceiling with zero
# clipped speculars is exactly what "lit too well" describes.
#
# So this is not a job for global darkening, which would only deepen the holes.
# It is a redistribution: pull the flat frontal key down, and give the form back
# with hard themed rims that actually clip.

TYRE = {
    "current": {},
    "spec":    dict(rough=0.60, ior=1.50, spec=0.50),
    "plate-env":  dict(rough=0.60, ior=1.50, spec=0.50,
                       world=0.9, world_color=PLATE_RED),
    "plate-rim":  dict(rough=0.60, ior=1.50, spec=0.50,
                       world=0.9, world_color=PLATE_RED,
                       rim=60.0, rim_color=(1.0, 0.30, 0.26)),
    "plate-deep": dict(rough=0.60, ior=1.50, spec=0.50,
                       world=1.2, world_color=PLATE_RED,
                       rim=60.0, rim_color=(1.0, 0.30, 0.26),
                       key=0.45, exposure=-0.35),
    # The cinematic pass. Rim positions are camera-relative: with the camera at
    # (-2.41, 3.04, 0.48) looking at the car, -Y is behind it, and screen-right
    # is world (-0.77, -0.64, 0) - so the cyan sits behind and high, where the
    # page's own radial glow already is (80% 55%), and the magenta rakes the nose
    # from behind screen-left and low.
    "theme":   dict(rough=0.60, ior=1.50, spec=0.50, key=0.55,
                    rims=[dict(color=CYAN,    energy=900.0, size=1.6,
                               pos=(0.10, -2.90, 1.90)),
                          dict(color=MAGENTA, energy=420.0, size=1.2,
                               pos=(2.60, -1.20, 0.35))]),
    # Tuning pass. The first attempt raised the median instead of lowering it -
    # rims add light, so the key has to come down further than feels right - and
    # the cyan, being the livery's dominant hue, pushes the cool cast the wrong
    # way on a red page. Leaning the balance toward the livery's magenta buys
    # back warmth without going off-theme, since both colours are the car's own.
    "theme-bal":  dict(rough=0.60, ior=1.50, spec=0.50, key=0.38,
                    rims=[dict(color=CYAN,    energy=700.0, size=1.6,
                               pos=(0.10, -2.90, 1.90)),
                          dict(color=MAGENTA, energy=700.0, size=1.2,
                               pos=(2.60, -1.20, 0.35))]),
    "theme-warm": dict(rough=0.60, ior=1.50, spec=0.50, key=0.32,
                    rims=[dict(color=CYAN,    energy=520.0, size=1.6,
                               pos=(0.10, -2.90, 1.90)),
                          dict(color=MAGENTA, energy=1150.0, size=1.2,
                               pos=(2.60, -1.20, 0.35))]),
    # The cinematic pass proper, now that the real rig is known. Kill the two
    # panels lighting the car from *below* - nothing in the world lights a car
    # from underneath, and they are what erases the wheel wells and chassis - cut
    # the remaining frontal fill hard, and give the form back with the livery's
    # own colours raking in from behind, where the scene had no light at all.
    "cine":      dict(rough=0.60, ior=1.50, spec=0.50,
                    panels=dict(strength=3.0, off=["Plane.011", "Plane.012"]),
                    rims=[dict(color=CYAN,    energy=900.0, size=1.6,
                               pos=(0.10, -2.90, 1.90)),
                          dict(color=MAGENTA, energy=700.0, size=1.2,
                               pos=(2.60, -1.20, 0.35))]),
    # One side panel off as well, so the car finally has a shadow side.
    "cine-deep": dict(rough=0.60, ior=1.50, spec=0.50,
                    panels=dict(strength=1.8,
                                off=["Plane.011", "Plane.012", "Plane.010"]),
                    rims=[dict(color=CYAN,    energy=1400.0, size=1.4,
                               pos=(0.10, -2.90, 1.90)),
                          dict(color=MAGENTA, energy=1000.0, size=1.0,
                               pos=(2.60, -1.20, 0.35))]),
    # Sweep between "still a softbox" (10) and "too dark, half the car is a hole"
    # (3.0). Keeping the under-lighting off throughout, since that is the change
    # that costs nothing and buys the most.
    "cine-8":  dict(rough=0.60, ior=1.50, spec=0.50,
                    panels=dict(strength=8.0, off=["Plane.011", "Plane.012"]),
                    rims=[dict(color=CYAN, energy=900.0, size=1.6, pos=(0.10, -2.90, 1.90)),
                          dict(color=MAGENTA, energy=700.0, size=1.2, pos=(2.60, -1.20, 0.35))]),
    "cine-65": dict(rough=0.60, ior=1.50, spec=0.50,
                    panels=dict(strength=6.5, off=["Plane.011", "Plane.012"]),
                    rims=[dict(color=CYAN, energy=1000.0, size=1.6, pos=(0.10, -2.90, 1.90)),
                          dict(color=MAGENTA, energy=800.0, size=1.2, pos=(2.60, -1.20, 0.35))]),
    "cine-5":  dict(rough=0.60, ior=1.50, spec=0.50,
                    panels=dict(strength=5.0, off=["Plane.011", "Plane.012"]),
                    rims=[dict(color=CYAN, energy=1200.0, size=1.5, pos=(0.10, -2.90, 1.90)),
                          dict(color=MAGENTA, energy=900.0, size=1.1, pos=(2.60, -1.20, 0.35))]),
    # cine-65 plus a dim red bounce from behind and low, placed where the page's
    # own radial glow sits (80% 55%). The kicker rule is that a light should look
    # like it could exist in the scene - the page supplies the motivation, so the
    # car picking up red from that direction is the one warm source that is not
    # arbitrary. It buys back the warmth the livery cyan costs, without putting a
    # colour on the car that is not already either the car's or the page's.
    "cine-65-w1": dict(rough=0.60, ior=1.50, spec=0.50,
                    panels=dict(strength=6.5, off=["Plane.011", "Plane.012"]),
                    rims=[dict(color=CYAN, energy=1000.0, size=1.6, pos=(0.10, -2.90, 1.90)),
                          dict(color=MAGENTA, energy=800.0, size=1.2, pos=(2.60, -1.20, 0.35)),
                          dict(color=PAGE_GLOW, energy=350.0, size=2.4, pos=(-0.10, -2.60, -0.30))]),
    "cine-65-w2": dict(rough=0.60, ior=1.50, spec=0.50,
                    panels=dict(strength=6.5, off=["Plane.011", "Plane.012"]),
                    rims=[dict(color=CYAN, energy=1000.0, size=1.6, pos=(0.10, -2.90, 1.90)),
                          dict(color=MAGENTA, energy=800.0, size=1.2, pos=(2.60, -1.20, 0.35)),
                          dict(color=PAGE_GLOW, energy=800.0, size=2.4, pos=(-0.10, -2.60, -0.30))]),
    "theme-hot": dict(rough=0.60, ior=1.50, spec=0.50, key=0.40,
                    rims=[dict(color=CYAN,    energy=1800.0, size=1.0,
                               pos=(0.10, -2.90, 1.90)),
                          dict(color=MAGENTA, energy=900.0, size=0.8,
                               pos=(2.60, -1.20, 0.35))]),
    "dust":    dict(rough=0.60, ior=1.50, spec=0.50,
                    sheen=0.07, sheen_rough=0.90, sheen_tint=(0.79, 0.75, 0.69)),
    "rim":     dict(rough=0.60, ior=1.50, spec=0.50,
                    sheen=0.07, sheen_rough=0.90, sheen_tint=(0.79, 0.75, 0.69),
                    rim=70.0),
    "lift":    dict(base=0.040, rough=0.65, ior=1.50, spec=0.50,
                    sheen=0.20, sheen_rough=0.90, sheen_tint=(0.79, 0.75, 0.69)),
    "full":    dict(base=0.040, rough=0.65, ior=1.50, spec=0.50,
                    sheen=0.20, sheen_rough=0.90, sheen_tint=(0.79, 0.75, 0.69),
                    world=0.10, rim=90.0),
}

def panel_reset():
    """Put the softbox rig back to how the file has it, so variants don't stack.

    The scene's real light source is not the "Area" lamp - that contributes almost
    nothing. It is seven emissive planes sharing Material.002 (white, Emission
    strength 10), hidden from camera by the render scripts: front-left,
    front-right, overhead, both sides high and both sides low. Every one of them
    sits at y = +2.5..+4.5 while the camera sits at y = +3.0, so the entire rig is
    on the camera's side of the car. Frontal fill from every direction at once is
    what produces a flat 192 luminance ceiling with no clipped speculars, and it
    is the actual reason the car reads as a studio cut-out.
    """
    m = bpy.data.materials.get("Material.002")
    if m and m.use_nodes:
        for n in m.node_tree.nodes:
            if n.bl_idname == 'ShaderNodeEmission':
                n.inputs['Strength'].default_value = 10.0
    for o in scn.objects:
        if o.name.startswith("Plane"):
            o.hide_render = False


def apply_tyre(variant):
    panel_reset()
    cfg = TYRE[variant]
    if not cfg:
        return {"variant": variant, "note": "control - scene as saved"}
    touched = []
    for mn in ("Rubber Black", "Black Rubber"):
        m = bpy.data.materials.get(mn)
        if not m or not m.use_nodes:
            continue
        for n in m.node_tree.nodes:
            if n.type != 'BSDF_PRINCIPLED':
                continue
            def put(sock, val):
                if sock in n.inputs and not n.inputs[sock].is_linked:
                    n.inputs[sock].default_value = val
            if "base" in cfg and not n.inputs['Base Color'].is_linked:
                a = n.inputs['Base Color'].default_value[3]
                n.inputs['Base Color'].default_value = (cfg["base"],) * 3 + (a,)
            if "rough" in cfg: put('Roughness', cfg["rough"])
            if "ior" in cfg: put('IOR', cfg["ior"])
            if "spec" in cfg: put('Specular IOR Level', cfg["spec"])
            if "sheen" in cfg: put('Sheen Weight', cfg["sheen"])
            if "sheen_rough" in cfg: put('Sheen Roughness', cfg["sheen_rough"])
            if "sheen_tint" in cfg: put('Sheen Tint', tuple(cfg["sheen_tint"]) + (1.0,))
            touched.append(mn)
    if "world" in cfg and scn.world and scn.world.use_nodes:
        for n in scn.world.node_tree.nodes:
            if n.bl_idname == 'ShaderNodeBackground':
                n.inputs['Strength'].default_value = cfg["world"]
                if "world_color" in cfg:
                    # The Color socket is wired to the scene's sunrise HDRI, which is
                    # the wrong environment entirely for this page. Cut it and drive
                    # the world with the page's own red instead.
                    for lk in list(n.inputs['Color'].links):
                        scn.world.node_tree.links.remove(lk)
                    n.inputs['Color'].default_value = tuple(cfg["world_color"]) + (1.0,)
    if "key" in cfg:
        k = bpy.data.objects.get("Area")
        if k is not None:
            k.data.energy *= cfg["key"]
    if "exposure" in cfg:
        scn.view_settings.exposure += cfg["exposure"]
    if "panels" in cfg:
        pc = cfg["panels"]
        m = bpy.data.materials.get("Material.002")
        if m and m.use_nodes and "strength" in pc:
            for n in m.node_tree.nodes:
                if n.bl_idname == 'ShaderNodeEmission':
                    n.inputs['Strength'].default_value = pc["strength"]
        for nm in pc.get("off", []):
            o = bpy.data.objects.get(nm)
            if o is not None:
                o.hide_render = True
    for j, rc in enumerate(cfg.get("rims", [])):
        ld = bpy.data.lights.new("TMP_RIM%d" % j, 'AREA')
        ld.energy, ld.size, ld.shape = rc["energy"], rc.get("size", 1.5), 'SQUARE'
        ld.color = tuple(rc["color"])
        ob = bpy.data.objects.new("TMP_RIM%d" % j, ld)
        scn.collection.objects.link(ob)
        ob.matrix_world = look_at(Vector(rc["pos"]), Vector((0.0, 0.17, 0.42)),
                                  Vector((0, 0, 1)))
    if "rim" in cfg:
        # Behind and above the car on the far side from the key, aimed at the
        # tyre shoulders. Large, because a big emitter is what draws a gradient
        # down a curved sidewall - a small one just puts a dot on it.
        ld = bpy.data.lights.new("TMP_RIM", 'AREA')
        ld.energy, ld.size, ld.shape = cfg["rim"], 3.0, 'SQUARE'
        ld.color = tuple(cfg.get("rim_color", (1.0, 0.93, 0.85)))
        ob = bpy.data.objects.new("TMP_RIM", ld)
        scn.collection.objects.link(ob)
        ob.matrix_world = look_at(Vector((-2.6, -2.9, 1.9)),
                                  Vector((0.0, 0.17, 0.30)), Vector((0, 0, 1)))
        cfg = dict(cfg); cfg["_rim_obj"] = ob.name
    return {"variant": variant, "materials": sorted(set(touched)),
            **{k: v for k, v in cfg.items() if not k.startswith("_")}}


# ---------- camera ----------
def look_at(pos, tgt, up):
    z = (pos - tgt).normalized()
    x = up.cross(z).normalized()
    y = z.cross(x)
    return Matrix(((x.x, y.x, z.x, pos.x),
                   (x.y, y.y, z.y, pos.y),
                   (x.z, y.z, z.z, pos.z),
                   (0, 0, 0, 1)))


def car_cloud():
    """Every car vertex in world space - what the pose was solved against."""
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for o in car_objects():
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        n = len(me.vertices)
        if n:
            a = np.empty(n * 3, dtype=np.float32)
            me.vertices.foreach_get("co", a)
            a = a.reshape(n, 3)
            M = np.array(ev.matrix_world, dtype=np.float32)
            out.append(a @ M[:3, :3].T + M[:3, 3])
        ev.to_mesh_clear()
    return np.concatenate(out, axis=0)


def camera_pose():
    """Where the camera sits. The pose is solved; only the framing is measured."""
    P = car_cloud()
    T = Vector(((P.min(0) + P.max(0)) / 2).tolist())
    d = Vector((math.cos(EL) * math.cos(AZ), math.cos(EL) * math.sin(AZ), math.sin(EL)))
    C = T + d * DIST
    return look_at(C, T, Vector((0, 0, 1))), T, C


# The framing is calibrated against real renders rather than predicted. An
# earlier version derived lens and shift analytically from the projected point
# cloud and got the scale right but clipped the car off the left edge - Blender's
# shift sign convention is the opposite of the one that derivation assumed.
# Measuring is both shorter and immune to being wrong about the convention:
# projected size is exactly linear in lens and image position is exactly linear
# in shift, so one probe render fixes the sign and two more converge the framing.
def measure(path):
    """Alpha bounding box of a render, in fractions of frame width/height."""
    im = bpy.data.images.load(path)
    w, h = im.size
    a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1, :, 3] > 0.5
    bpy.data.images.remove(im)
    ys, xs = np.nonzero(a)
    if not len(xs):
        return None
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    return dict(x0=x0 / w, x1=(x1 + 1) / w, y0=y0 / h, y1=(y1 + 1) / h,
                clipped=(x0 == 0 or y0 == 0 or x1 == w - 1 or y1 == h - 1))


# ---------- render ----------
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'
try: prefs.get_devices()
except Exception: pass
for dv in prefs.devices:
    dv.use = (dv.type == 'METAL')

info = apply_tyre(VARIANT)
M, T, C = camera_pose()

prev = dict(cam=scn.camera, samples=cy.samples, pct=r.resolution_percentage,
            fmt=r.image_settings.file_format, cm=r.image_settings.color_mode,
            fp=r.filepath, transp=r.film_transparent,
            rx=r.resolution_x, ry=r.resolution_y)

tmp = bpy.data.objects.new("TMP_HEROCAM", bpy.data.cameras.new("TMP_HEROCAM"))
tmp.data.sensor_width = 36.0
tmp.data.sensor_fit = 'HORIZONTAL'
tmp.data.dof.use_dof = False
tmp.data.clip_start = 0.05
scn.collection.objects.link(tmp)
scn.camera = tmp
tmp.matrix_world = M

r.engine = 'CYCLES'
cy.device = 'GPU'
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.01
cy.use_denoising = True
cy.denoiser = 'OPENIMAGEDENOISE'
cy.denoising_prefilter = 'ACCURATE'
r.use_persistent_data = True
r.use_motion_blur = False
r.resolution_x, r.resolution_y = RES
r.film_transparent = True
r.image_settings.file_format = 'PNG'
r.image_settings.color_mode = 'RGBA'
scn.display_settings.display_device = 'sRGB'
scn.view_settings.view_transform = 'AgX'

for o in scn.objects:
    if o.type == 'MESH':
        o.visible_camera = not o.name.startswith("Plane")

ASPECT = RES[1] / RES[0]
probe_path = os.path.join(OUTDIR, "_calib.png")

def shoot(path, pct, samples):
    r.resolution_percentage, cy.samples = pct, samples
    r.filepath = path[:-4] if path.endswith(".png") else path
    bpy.context.view_layer.update()
    bpy.ops.render.render(write_still=True)
    return measure(path)

# 1. deliberately loose, so nothing touches an edge and the box is real
tmp.data.lens, tmp.data.shift_x, tmp.data.shift_y = 40.0, 0.0, 0.0
m0 = shoot(probe_path, 10, 16)
# 2. one probe with a known shift, to read off the sign Blender actually uses
tmp.data.shift_x, tmp.data.shift_y = 0.05, 0.0
m1 = shoot(probe_path, 10, 16)
sign = 1.0 if ((m1["x0"] + m1["x1"]) > (m0["x0"] + m0["x1"])) else -1.0
tmp.data.shift_x = 0.0

calib = {"probe_fill_w": round(m0["x1"] - m0["x0"], 4), "shift_sign": sign, "iters": []}
for _ in range(3):
    m = shoot(probe_path, 10, 16)
    fw = m["x1"] - m["x0"]
    tmp.data.lens *= FILL_W / fw
    cx_m, cy_m = (m["x0"] + m["x1"]) / 2, (m["y0"] + m["y1"]) / 2
    # centre error, carried in frame-width units, then applied with the measured sign
    ex = (CX - cx_m) * (FILL_W / fw)
    ey = (cy_m - CY) * ASPECT * (FILL_W / fw)
    tmp.data.shift_x += sign * ex
    tmp.data.shift_y += sign * ey
    calib["iters"].append(dict(fill_w=round(fw, 4), fill_h=round(m["y1"] - m["y0"], 4),
                               lens=round(tmp.data.lens, 3),
                               shift=[round(tmp.data.shift_x, 5), round(tmp.data.shift_y, 5)],
                               clipped=m["clipped"]))
mf = shoot(probe_path, 10, 16)
calib["final"] = dict(fill_w=round(mf["x1"] - mf["x0"], 4),
                      fill_h=round(mf["y1"] - mf["y0"], 4),
                      centre=[round((mf["x0"] + mf["x1"]) / 2, 4),
                              round((mf["y0"] + mf["y1"]) / 2, 4)],
                      clipped=mf["clipped"])
if os.path.exists(probe_path):
    os.remove(probe_path)

cam_info = dict(target=[round(c, 4) for c in T], pos=[round(c, 4) for c in C],
                lens=round(tmp.data.lens, 3),
                shift=[round(tmp.data.shift_x, 5), round(tmp.data.shift_y, 5)],
                calib=calib)

name = NAME or ("hero-%s-%s" % (VARIANT, STAGE))
t0 = time.time()
shoot(os.path.join(OUTDIR, name + ".png"),
      25 if STAGE == "preview" else 100,
      64 if STAGE == "preview" else 384)
secs = round(time.time() - t0, 1)

scn.camera = prev["cam"]
bpy.data.objects.remove(tmp, do_unlink=True)
for _n in ["TMP_RIM"] + ["TMP_RIM%d" % j for j in range(6)]:
    _o = bpy.data.objects.get(_n)
    if _o is not None:
        bpy.data.objects.remove(_o, do_unlink=True)
cy.samples = prev["samples"]; r.resolution_percentage = prev["pct"]
r.image_settings.file_format = prev["fmt"]; r.image_settings.color_mode = prev["cm"]
r.filepath = prev["fp"]; r.film_transparent = prev["transp"]
r.resolution_x, r.resolution_y = prev["rx"], prev["ry"]

RESULT = {"stage": STAGE, "seconds": secs, "out": r.filepath if False else
          os.path.join(OUTDIR, name + ".png"), "tyre": info, "camera": cam_info}
