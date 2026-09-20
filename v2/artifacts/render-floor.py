"""The homepage hero's showroom floor: a separate RGBA layer that sits under
`src/assets/homepage-car-sr26.webp` on the page, rendered from the same camera.

What it holds, and why it is its own image rather than baked into the car:

  * the car's real reflection in a dark coated floor (underside included, each
    tyre in its own perspective), its contact shadows, and a teal pool of light
  * the car PNG stays byte-for-byte as shipped, so the hero layout, the solved
    camera framing and next year's car swap are untouched

How the floor is isolated, measured and rejected alternatives included:

  * A second view layer puts every car collection (26-*) on Indirect Only: the
    car is invisible to camera rays but still reflects and casts shadows.
  * The scene's floor plane was already a shadow catcher. That cannot work here:
    the world strength is 0, so the catcher's reference light is 0, and a catcher
    can only darken - it can never add a teal pool to a transparent PNG.
  * Every emitter that lights the car (the seven Material.002 softbox planes, the
    Area lamp, the cine-65-w1 rims) is light-linked to EXCLUDE the floor, and the
    planes are hidden from glossy rays - otherwise the floor mirrors giant white
    panels. The pool is a teal spot linked to the floor only; the car still
    blocks it, which is where the contact shadows come from.
  * The floor is a still at 2000 W. (A CSS crossfade with a 1500 W render made
    the pool "breathe"; the user dropped it. Splitting the pool into its own
    additive layer was measured and rejected earlier: AgX is not additive, so the
    split sum came out 7-17 levels too bright where pool and reflection overlap.)

The frame is the car's frame grown 30% left, 10% right and 30% down (the
reflection falls below the car PNG's bottom edge). Lens stays put and the sensor
widens with the canvas, so the car's pixels do not move: measured 0.2 px of error
at 5040x3900.

Floor look chosen by the user (lab variant blender-floor, "sharper gloss, 65%"):
base 0.02, roughness 0.35, coat weight 0.65 / roughness 0.20, specular IOR level
0.325, fading to holdout 0.8-2.8 m from the car.

  STAGE    preview (50%, 256 spp) | final (100%, 384 spp)
  POOLS    spot watts to render, default (2000,)
  OUTDIR   where the 16-bit PNGs go (artifacts/floor/final by default)

Run inside Blender with the car .blend open (the Blender MCP, or
`blender --background <blend> --python render-floor.py`). It never saves the
.blend; revert the file afterwards if run in an interactive session. The web
images are made from these renders by artifacts/export-floor.mjs.
"""

import bpy, os, math, time

STAGE  = globals().get("STAGE", "preview")
POOLS  = globals().get("POOLS", (2000.0,))
OUTDIR = globals().get("OUTDIR", "/Users/aretelew/Developer/baja/baja-website/v2/artifacts/floor/final/")
HERE   = os.path.dirname(os.path.abspath(globals().get("__file__", "/Users/aretelew/Developer/baja/baja-website/v2/artifacts/render-floor.py")))

# The camera solve, the cine-65-w1 lighting variant and the framing constants
# live in render-hero.py. Its top half is definitions only; the bottom half
# renders. Run just the definitions so there is one source of truth for the pose.
_src = open(os.path.join(HERE, "render-hero.py")).read()
_MARK = "# ---------- render ----------"
assert _MARK in _src, "render-hero.py no longer has its render marker"
HERO = {"__name__": "render_hero_defs", "STAGE": STAGE, "VARIANT": "cine-65-w1", "OUTDIR": OUTDIR}
exec(compile(_src.split(_MARK)[0], "render-hero.py (definitions)", "exec"), HERO)

scn = bpy.context.scene
r, cy = scn.render, scn.cycles

EXTEND  = dict(L=0.30, R=0.10, T=0.0, B=0.30)
FLOOR_Z = -0.312                           # tyre contact height (lowest tyre vertex)
CAR_XY  = (0.0, 0.17)                      # car bbox centre on the floor
FLOOR = dict(base=0.02, roughness=0.35, coat=0.65, coat_roughness=0.20, spec=0.325,
             fade=(0.8, 2.8))
SPOT = dict(color=HERO["CYAN"], size_deg=60.0, blend=1.0, radius=0.45, height=3.0)


def setup():
    """Shipped car lighting + solved camera, then the floor layer. Returns camera info."""
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    try:
        prefs.get_devices()
    except Exception:
        pass
    for dv in prefs.devices:
        dv.use = (dv.type == 'METAL')

    HERO["apply_tyre"]("cine-65-w1")       # the shipped car's lighting
    M, T, C = HERO["camera_pose"]()
    cam = bpy.data.objects.new("TMP_FLOORCAM", bpy.data.cameras.new("TMP_FLOORCAM"))
    cam.data.sensor_width, cam.data.sensor_fit = 36.0, 'HORIZONTAL'
    cam.data.dof.use_dof, cam.data.clip_start = False, 0.05
    scn.collection.objects.link(cam)
    scn.camera = cam
    cam.matrix_world = M

    r.engine = 'CYCLES'
    cy.device = 'GPU'
    cy.use_adaptive_sampling, cy.adaptive_threshold = True, 0.01
    cy.use_denoising, cy.denoiser, cy.denoising_prefilter = True, 'OPENIMAGEDENOISE', 'ACCURATE'
    r.use_persistent_data, r.use_motion_blur = True, False
    r.use_compositing = False
    r.film_transparent = True
    r.image_settings.file_format, r.image_settings.color_mode = 'PNG', 'RGBA'
    scn.display_settings.display_device = 'sRGB'
    scn.view_settings.view_transform = 'AgX'
    for o in scn.objects:
        if o.type == 'MESH':
            o.visible_camera = not o.name.startswith("Plane")

    calib = calibrate(cam)
    build_floor_layer()
    return dict(lens=round(cam.data.lens, 3), shift=[round(cam.data.shift_x, 5), round(cam.data.shift_y, 5)], calib=calib)


def calibrate(cam):
    """Same measured framing as render-hero.py: one probe fixes the shift sign, three converge lens and shift."""
    RES = HERO["RES"]
    FILL_W, CX, CY = HERO["FILL_W"], HERO["CX"], HERO["CY"]
    r.resolution_x, r.resolution_y = RES
    probe = os.path.join(OUTDIR, "_calib.png")
    os.makedirs(OUTDIR, exist_ok=True)
    main = scn.view_layers["ViewLayer"]

    def shoot():
        r.resolution_percentage, cy.samples = 10, 16
        r.filepath = probe[:-4]
        bpy.context.view_layer.update()
        bpy.ops.render.render(write_still=True, layer=main.name)
        return HERO["measure"](probe)

    cam.data.lens, cam.data.shift_x, cam.data.shift_y = 40.0, 0.0, 0.0
    m0 = shoot()
    cam.data.shift_x = 0.05
    m1 = shoot()
    sign = 1.0 if (m1["x0"] + m1["x1"]) > (m0["x0"] + m0["x1"]) else -1.0
    cam.data.shift_x = 0.0
    aspect = RES[1] / RES[0]
    for _ in range(3):
        m = shoot()
        fw = m["x1"] - m["x0"]
        cam.data.lens *= FILL_W / fw
        cam.data.shift_x += sign * (CX - (m["x0"] + m["x1"]) / 2) * (FILL_W / fw)
        cam.data.shift_y += sign * ((m["y0"] + m["y1"]) / 2 - CY) * aspect * (FILL_W / fw)
    mf = shoot()
    if os.path.exists(probe):
        os.remove(probe)
    extend_frame(cam)
    return {k: round(v, 4) for k, v in mf.items() if k != "clipped"}


def extend_frame(cam):
    """Grow the canvas by EXTEND (fractions of the car frame) without moving the car's pixels.

    Horizontal sensor fit: widening sensor_width with resolution_x keeps pixels
    per radian constant at a fixed lens. Blender's shift is in units of the frame
    width, and a positive shift moves the window right/up, so each side's growth
    moves the window centre by half that side's pixels.
    """
    W, H = HERO["RES"]
    L, R, T, B = EXTEND["L"], EXTEND["R"], EXTEND["T"], EXTEND["B"]
    W2, H2 = round(W * (1 + L + R)), round(H * (1 + T + B))
    sx, sy = cam.data.shift_x, cam.data.shift_y
    cam.data.sensor_width = 36.0 * W2 / W
    cam.data.shift_x = (sx * W + (R - L) * W / 2) / W2
    cam.data.shift_y = (sy * W + (T - B) * H / 2) / W2
    r.resolution_x, r.resolution_y = W2, H2


def build_floor_layer():
    floor = bpy.data.objects["Plane.008"]

    vl = scn.view_layers.get("TMP_FLOOR") or scn.view_layers.new("TMP_FLOOR")
    for lc in vl.layer_collection.children:
        lc.indirect_only = lc.name.startswith("26-")

    mat = bpy.data.materials.new("TMP_FLOOR")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (FLOOR["base"],) * 3 + (1.0,)
    bsdf.inputs["Roughness"].default_value = FLOOR["roughness"]
    bsdf.inputs["IOR"].default_value = 1.5
    bsdf.inputs["Specular IOR Level"].default_value = FLOOR["spec"]
    bsdf.inputs["Coat Weight"].default_value = FLOOR["coat"]
    bsdf.inputs["Coat Roughness"].default_value = FLOOR["coat_roughness"]
    bsdf.inputs["Coat IOR"].default_value = 1.5
    # fade to holdout (transparent) with distance from the car, so the plane has no edge
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    dist = nt.nodes.new("ShaderNodeVectorMath"); dist.operation = 'DISTANCE'
    dist.inputs[1].default_value = (CAR_XY[0], CAR_XY[1], FLOOR_Z)
    fade = nt.nodes.new("ShaderNodeMapRange"); fade.interpolation_type = 'SMOOTHSTEP'
    fade.inputs["From Min"].default_value, fade.inputs["From Max"].default_value = FLOOR["fade"]
    hold = nt.nodes.new("ShaderNodeHoldout")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(geo.outputs["Position"], dist.inputs[0])
    nt.links.new(dist.outputs["Value"], fade.inputs["Value"])
    nt.links.new(fade.outputs["Result"], mix.inputs["Fac"])
    nt.links.new(bsdf.outputs["BSDF"], mix.inputs[1])
    nt.links.new(hold.outputs["Holdout"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    floor.material_slots[0].link = 'OBJECT'
    floor.material_slots[0].material = mat
    floor.visible_camera = True
    floor.is_shadow_catcher = False

    # collections used as light-linking receiver sets (members are matched by index)
    only_floor = bpy.data.collections.new("TMP_ONLY_FLOOR"); only_floor.objects.link(floor)
    not_floor = bpy.data.collections.new("TMP_NOT_FLOOR"); not_floor.objects.link(floor)
    not_floor.collection_objects[0].light_linking.link_state = 'EXCLUDE'

    for o in scn.objects:
        is_panel = o.name.startswith("Plane.") and o.name != "Plane.008"
        if o.type == 'LIGHT' or is_panel:
            o.light_linking.receiver_collection = not_floor
        if is_panel:
            o.visible_glossy = False

    sd = bpy.data.lights.new("TMP_POOL_SPOT", 'SPOT')
    sd.color = SPOT["color"]
    sd.spot_size, sd.spot_blend, sd.shadow_soft_size = math.radians(SPOT["size_deg"]), SPOT["blend"], SPOT["radius"]
    spot = bpy.data.objects.new("TMP_POOL_SPOT", sd)
    scn.collection.objects.link(spot)
    spot.location = (CAR_XY[0], CAR_XY[1], SPOT["height"])   # spots point down -Z
    spot.light_linking.receiver_collection = only_floor


def render_pool(watts, stage=None, name=None):
    stage = stage or STAGE
    spot = bpy.data.objects["TMP_POOL_SPOT"]
    spot.data.energy = watts
    scn.view_layers["ViewLayer"].use = False
    scn.view_layers["TMP_FLOOR"].use = True
    r.image_settings.color_depth = '16'
    r.resolution_percentage, cy.samples = (50, 256) if stage == "preview" else (100, 384)
    name = name or "floor-sr26-%s-p%d" % (stage, watts)
    r.filepath = os.path.join(OUTDIR, name)
    t0 = time.time()
    bpy.ops.render.render(write_still=True, layer="TMP_FLOOR")
    scn.view_layers["ViewLayer"].use = True
    return {"file": r.filepath + ".png", "seconds": round(time.time() - t0, 1),
            "px": [r.resolution_x * r.resolution_percentage // 100, r.resolution_y * r.resolution_percentage // 100]}


if globals().get("RUN", True):
    os.makedirs(OUTDIR, exist_ok=True)
    RESULT = {"camera": setup(), "renders": [render_pool(w) for w in POOLS]}
