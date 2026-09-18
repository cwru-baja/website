"""Everything the dash-screen easter egg needs from Blender, rendered from the
camera the cockpit still was rendered from.

The cockpit hold shows layers/cockpit-dive-0040.webp, the dive's last pose. The
camera is rebuilt from render-dive.py's own dive_pose(N_DIVE - 1) rather than
copied, so a change to that leg carries over here.

The screen is one emissive quad on the wheel mesh (material "Material", the
packed 480x272 Document.png) with nothing in front of it: a ray from the camera
through every part of it hits the quad first, so there is no glass and nothing
to reflect. What makes something drawn on it look rendered rather than pasted on
is the colour transform, the render's edge softness, and the light the dash
throws on its surroundings. Each stage covers one of those:

  lut    The scene's view transform (AgX, +0.29 exposure) applied to a 17^3 grid
         of texture colours. save_render runs the scene's colour management over
         a float image without rendering anything, so this is exact rather than
         fitted. Pure white on the dash comes out at 203/255 and livery teal
         #26B0BD at (100,172,181) - draw either straight onto a canvas and it is
         visibly too bright and too saturated for the frame around it. Also writes
         the dash texture, which export-dash-screen.mjs checks the model against.

  plate  The whole frame with the screen on and with it off. The dash lights the
         LED cover above it by up to 110/255 and the bezel and knob lenses below
         it by tens, so when the game blanks the screen that light has to go too.
         on - off is the spill; export-dash-screen.mjs turns it into the plate's
         alpha, so the plate only replaces pixels the dash was actually lighting.

  press  The button-press crops for SCREEN "on", "off" or "both": each of the
         eight domes moved down its own axis by each TRAVEL step, 108x108 around
         it. The site shows "off" while the game runs. The "on" crops nearest the
         screen carry up to 35/255 of the dash's light in their corners, which
         would paste a lit square onto the dark plate. A dome is its blue
         material's vertices within 12 mm of each other, and its axis the least-
         variance direction of those points (the domes are squat).

Checks before anything is trusted: the "on" renders are compared with the
shipped still composited over black - the still is RGBA with a transparent
background, where colour is meaningless - and the script stops if the camera
was not reproduced (WebP q80 alone accounts for ~2.4/255 full frame and ~2.7
around a button).

  STAGE    lut | plate | press | all
  SCREEN   press stage only: on | off | both
  OUTDIR   artifacts/dash-screen/ (press crops go to OUTDIR/press-<screen>/)

Run through the Blender MCP with the car .blend open, or
  blender --background <blend> --python artifacts/render-dash-screen.py
It never saves the .blend, and puts back every setting and object it touches.
export-dash-screen.mjs and export-button-press.mjs turn the output into site assets.
"""

import bpy, os, time
import numpy as np
import OpenImageIO as oiio
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(globals().get(
    "__file__", "/Users/aretelew/Developer/baja/baja-website/v2/artifacts/render-dash-screen.py")))
REPO = os.path.dirname(HERE)
STAGE = globals().get("STAGE", os.environ.get("STAGE", "all"))
SCREEN = globals().get("SCREEN", os.environ.get("SCREEN", "both"))
OUTDIR = globals().get("OUTDIR", os.path.join(HERE, "dash-screen"))
STILL = os.path.join(REPO, "public/renders-sr26/layers/cockpit-dive-0040.webp")
TRAVEL = (0.0, 0.5, 1.0, 1.5, 2.5)          # mm of dome descent
SPRITE = 108
LUT_N = 17
os.makedirs(OUTDIR, exist_ok=True)

scn = bpy.context.scene
r, cy = scn.render, scn.cycles
WHEEL = bpy.data.objects["26-FI-SUS-C1-00 Steering Wheel and Column Assem"]
SCREEN_MAT = "Material"
BUTTON_MAT = "face1750.004"

# ---------- the camera: the dive's last pose, from the script that rendered it ----------
dive = dict(STAGE="verify")
exec(open(os.path.join(HERE, "render-dive.py")).read(), dive)
CAM_M, CAM_LENS = dive["dive_pose"](dive["N_DIVE"] - 1)
E0 = dive["E0"]


def read(path):
    image = oiio.ImageInput.open(path)
    spec = image.spec()
    px = np.asarray(image.read_image(0, 0, 0, spec.nchannels, oiio.FLOAT), dtype=np.float32)
    image.close()
    return px


def over_black(px):
    return px[..., :3] * px[..., 3:4] if px.shape[-1] == 4 else px[..., :3]


def rmse_255(a, b):
    return float(np.sqrt(np.mean((a - b) ** 2)) * 255)


# Each stage runs between setup() and teardown(); teardown() puts back exactly
# what setup() found, including when a render raises.
def setup():
    saved = dict(camera=scn.camera, frame=scn.frame_current, samples=cy.samples,
                 adaptive=cy.use_adaptive_sampling, threshold=cy.adaptive_threshold,
                 denoise=cy.use_denoising, fmt=r.image_settings.file_format,
                 mode=r.image_settings.color_mode, quality=r.image_settings.quality,
                 path=r.filepath, transparent=r.film_transparent, border=r.use_border,
                 crop=r.use_crop_to_border, box=(r.border_min_x, r.border_max_x, r.border_min_y, r.border_max_y),
                 res=(r.resolution_x, r.resolution_y, r.resolution_percentage),
                 visibility={o.name: (o.hide_render, o.is_holdout, o.visible_camera) for o in dive["meshes"]()})
    cam = bpy.data.objects.new("TMP_DASH_CAM", bpy.data.cameras.new("TMP_DASH_CAM"))
    cam.data.dof.use_dof = False            # as render-dive.py: the dive renders without DOF
    cam.data.clip_start = 0.02
    cam.data.sensor_width = saved["camera"].data.sensor_width
    cam.data.lens = CAM_LENS
    scn.collection.objects.link(cam)
    cam.matrix_world = CAM_M
    scn.camera = cam
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    try: prefs.get_devices()
    except Exception: pass
    for d in prefs.devices: d.use = (d.type == 'METAL')
    r.engine = 'CYCLES'; cy.device = 'GPU'
    cy.samples = 256; cy.use_adaptive_sampling = True; cy.adaptive_threshold = 0.01
    cy.use_denoising = True; cy.denoiser = 'OPENIMAGEDENOISE'; cy.denoising_prefilter = 'ACCURATE'
    r.use_persistent_data = True; r.use_motion_blur = False; r.film_transparent = True
    r.resolution_x, r.resolution_y, r.resolution_percentage = 1920, 1080, 100
    r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'; r.image_settings.color_depth = '16'
    scn.frame_set(32)                         # the car is static; render-dive.py renders at 32 too
    for o in dive["meshes"]():
        o.hide_render = False; o.is_holdout = False
        o.visible_camera = not o.name.startswith("Plane")
    return saved, cam


def teardown(saved, cam):
    scn.camera = saved["camera"]
    cy.samples = saved["samples"]; cy.use_adaptive_sampling = saved["adaptive"]
    cy.adaptive_threshold = saved["threshold"]; cy.use_denoising = saved["denoise"]
    r.image_settings.file_format = 'PNG'; r.image_settings.color_depth = '8'
    r.image_settings.file_format = saved["fmt"]; r.image_settings.color_mode = saved["mode"]
    r.image_settings.quality = saved["quality"]; r.filepath = saved["path"]
    r.film_transparent = saved["transparent"]; r.use_border = saved["border"]; r.use_crop_to_border = saved["crop"]
    r.border_min_x, r.border_max_x, r.border_min_y, r.border_max_y = saved["box"]
    r.resolution_x, r.resolution_y, r.resolution_percentage = saved["res"]
    for name, (hide, holdout, vis) in saved["visibility"].items():
        o = bpy.data.objects.get(name)
        if o: o.hide_render, o.is_holdout, o.visible_camera = hide, holdout, vis
    scn.frame_set(saved["frame"])
    data = cam.data
    bpy.data.objects.remove(cam, do_unlink=True)
    bpy.data.cameras.remove(data)


def emission():
    return next(n for n in bpy.data.materials[SCREEN_MAT].node_tree.nodes if n.type == "EMISSION").inputs["Strength"]


def render(path, box=None):
    if box:
        x0, y0, x1, y1 = box
        r.use_border = True; r.use_crop_to_border = True
        r.border_min_x, r.border_max_x = x0 / 1920, x1 / 1920
        r.border_min_y, r.border_max_y = (1080 - y1) / 1080, (1080 - y0) / 1080
    else:
        r.use_border = False; r.use_crop_to_border = False
    r.filepath = path
    bpy.ops.render.render(write_still=True)
    return path + ".png"


# ---------- lut ----------
def stage_lut():
    def s2l(s): return s / 12.92 if s <= 0.04045 else ((s + 0.055) / 1.055) ** 2.4
    n = LUT_N
    grid = bpy.data.images.new("TMP_DASH_LUT", n * n, n, alpha=False, float_buffer=True)
    grid.colorspace_settings.name = "Linear Rec.709"
    px = np.zeros((n, n * n, 4), dtype=np.float32)
    level = np.array([s2l(i / (n - 1)) for i in range(n)], dtype=np.float32)
    # Row = green (Blender rows run bottom-up), column = red + n * blue.
    px[..., 0] = level[np.arange(n * n) % n][None, :]
    px[..., 1] = level[:, None]
    px[..., 2] = level[np.arange(n * n) // n][None, :]
    px[..., 3] = 1.0
    grid.pixels.foreach_set(px.ravel())
    fmt = (r.image_settings.file_format, r.image_settings.color_mode)
    r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGB'; r.image_settings.color_depth = '16'
    try:
        grid.save_render(os.path.join(OUTDIR, "agx-lut17.png"), scene=scn)
    finally:
        r.image_settings.color_depth = '8'
        r.image_settings.file_format, r.image_settings.color_mode = fmt
        bpy.data.images.remove(grid)
    doc = next(n.image for n in bpy.data.materials[SCREEN_MAT].node_tree.nodes if n.type == "TEX_IMAGE")
    was = doc.filepath_raw
    doc.filepath_raw = os.path.join(OUTDIR, "dash-texture.png"); doc.file_format = 'PNG'
    try: doc.save()
    finally: doc.filepath_raw = was
    return {"lut": f"{n}^3", "view": scn.view_settings.view_transform, "exposure": round(scn.view_settings.exposure, 4),
            "geometry": geometry(doc)}


def geometry(doc):
    """The screen quad's corners in frame px, with their UVs, to geometry.json.

    Frame px are continuous (0 = the frame's left edge), so a pixel's centre is
    at i + 0.5. The UVs overshoot the texture slightly (u 0.003..0.996, v past 0
    and 1), so the site maps texture space through them rather than assuming the
    quad is exactly the image."""
    import json
    me, mw = WHEEL.data, WHEEL.matrix_world
    slot = next(i for i, s in enumerate(WHEEL.material_slots) if s.material and s.material.name == SCREEN_MAT)
    uv = me.uv_layers.active.data
    corners = {}
    for p in me.polygons:
        if p.material_index != slot: continue
        for li in p.loop_indices:
            v = me.loops[li].vertex_index
            if v in corners: continue
            w = mw @ me.vertices[v].co
            cam_space = CAM_M.inverted() @ w
            k = CAM_LENS * (1920 / bpy.context.scene.camera.data.sensor_width)
            corners[v] = {"frame": [1920 / 2 + (cam_space.x / -cam_space.z) * k, 1080 / 2 - (cam_space.y / -cam_space.z) * k],
                          "uv": list(uv[li].uv)}
    if len(corners) != 4:
        raise RuntimeError(f"screen material covers {len(corners)} vertices, expected a single quad")
    pts = list(corners.values())
    mx = sum(p["frame"][0] for p in pts) / 4; my = sum(p["frame"][1] for p in pts) / 4
    def corner(left, top):
        return next(p for p in pts if (p["frame"][0] < mx) == left and (p["frame"][1] < my) == top)
    quad = {"tl": corner(True, True), "tr": corner(False, True), "br": corner(False, False), "bl": corner(True, False)}
    out = {"frame": [1920, 1080], "texture": list(doc.size), "quad": {k: {"frame": [round(c, 3) for c in v["frame"]],
           "uv": [round(c, 5) for c in v["uv"]]} for k, v in quad.items()}}
    with open(os.path.join(OUTDIR, "geometry.json"), "w") as f:
        json.dump(out, f, indent=2)
    return out


# ---------- plate ----------
def stage_plate():
    strength = emission(); was = strength.default_value
    out = {}
    try:
        for name, value in (("full-on", was), ("full-off", 0.0)):
            strength.default_value = value
            t = time.time()
            render(os.path.join(OUTDIR, name))
            out[name] = round(time.time() - t, 1)
    finally:
        strength.default_value = was
    err = rmse_255(over_black(read(os.path.join(OUTDIR, "full-on.png"))), over_black(read(STILL)))
    out["on_vs_still"] = round(err, 2)
    if err > 3.5:
        raise RuntimeError(f"full-frame render is {err:.2f}/255 from the shipped still - camera or settings not reproduced")
    return out


# ---------- press ----------
def buttons(cam):
    """The eight domes: projected centre, crop origin, push axis, and vertex indices."""
    me, mw = WHEEL.data, WHEEL.matrix_world
    slot = next(i for i, s in enumerate(WHEEL.material_slots) if s.material and s.material.name == BUTTON_MAT)
    verts = {}
    for p in me.polygons:
        if p.material_index == slot:
            for v in p.vertices: verts[v] = mw @ me.vertices[v].co
    clusters = []
    for v, w in verts.items():
        for c in clusters:
            if (w - c["seed"]).length < 0.012:
                c["idx"].append(v); c["pts"].append(w); break
        else:
            clusters.append({"seed": w, "idx": [v], "pts": [w]})
    if len(clusters) != 8:
        raise RuntimeError(f"expected 8 domes, found {len(clusters)}")
    out = []
    for c in clusters:
        ctr = sum(c["pts"], Vector()) / len(c["pts"])
        A = np.array([[p.x - ctr.x, p.y - ctr.y, p.z - ctr.z] for p in c["pts"]])
        axis = Vector(np.linalg.svd(A, full_matrices=False)[2][2]).normalized()
        if axis.dot(E0) < 0: axis = -axis        # +axis runs into the wheel, away from the camera
        ndc = world_to_camera_view(scn, cam, ctr)
        cx, cy_ = ndc.x * 1920, (1 - ndc.y) * 1080
        out.append({"idx": sorted(set(c["idx"])), "axis": axis, "cx": cx, "cy": cy_,
                    "x0": int(round(cx)) - SPRITE // 2, "y0": int(round(cy_)) - SPRITE // 2})
    out.sort(key=lambda b: (round(b["cy"] / 40), b["cx"]))
    return out


def stage_press(cam):
    screens = ("on", "off") if SCREEN == "both" else (SCREEN,)
    btns = buttons(cam)
    strength = emission(); was = strength.default_value
    # Two stand-ins for the wheel: everything but one dome, and that dome alone.
    # Swapping the vertex group per button re-picks the dome without copying the
    # 500k-face mesh again.
    def standin(name, invert):
        o = WHEEL.copy(); o.data = WHEEL.data.copy(); o.name = name
        for col in WHEEL.users_collection: col.objects.link(o)
        o.matrix_world = WHEEL.matrix_world.copy()
        o.vertex_groups.new(name="DOME")
        m = o.modifiers.new("PickDome", 'MASK'); m.vertex_group = "DOME"; m.invert_vertex_group = invert
        return o
    rest, dome = standin("TMP_DASH_WHEEL", True), standin("TMP_DASH_DOME", False)
    was_hidden = WHEEL.hide_render
    WHEEL.hide_render = True
    base = WHEEL.matrix_world.copy()
    report, t0 = {}, time.time()
    try:
        for screen in screens:
            strength.default_value = was if screen == "on" else 0.0
            folder = os.path.join(OUTDIR, f"press-{screen}")
            os.makedirs(folder, exist_ok=True)
            for i, b in enumerate(btns):
                for o in (rest, dome):
                    o.vertex_groups.remove(o.vertex_groups["DOME"])
                    o.vertex_groups.new(name="DOME").add(b["idx"], 1.0, 'REPLACE')
                    o.modifiers["PickDome"].vertex_group = "DOME"
                box = (b["x0"], b["y0"], b["x0"] + SPRITE, b["y0"] + SPRITE)
                for mm in TRAVEL:
                    m = base.copy(); m.translation = base.translation + b["axis"] * (mm / 1000)
                    dome.matrix_world = m
                    bpy.context.view_layer.update()
                    render(os.path.join(folder, "b%d-t%03d" % (i, round(mm * 10))), box)
            # The rest crop must be the still (for "on") or the plate (for "off").
            ref = over_black(read(STILL)) if screen == "on" else (
                over_black(read(os.path.join(OUTDIR, "full-off.png"))) if os.path.exists(os.path.join(OUTDIR, "full-off.png")) else None)
            if ref is not None:
                worst = 0.0
                for i, b in enumerate(btns):
                    crop = over_black(read(os.path.join(folder, "b%d-t000.png" % i)))
                    worst = max(worst, rmse_255(crop, ref[b["y0"]:b["y0"] + SPRITE, b["x0"]:b["x0"] + SPRITE]))
                report[screen] = {"rest_vs_" + ("still" if screen == "on" else "plate"): round(worst, 2)}
                if worst > (4.0 if screen == "on" else 1.5):
                    raise RuntimeError(f"press-{screen} rest crops are {worst:.2f}/255 off their reference")
    finally:
        strength.default_value = was
        WHEEL.hide_render = was_hidden
        for o in (rest, dome):
            data = o.data
            bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.meshes.remove(data)
    report["buttons"] = [{"i": i, "x0": b["x0"], "y0": b["y0"], "cx": round(b["cx"], 1), "cy": round(b["cy"], 1)} for i, b in enumerate(btns)]
    report["seconds"] = round(time.time() - t0, 1)
    return report


RESULT = {}
if STAGE in ("lut", "all"):
    RESULT["lut"] = stage_lut()
if STAGE in ("plate", "press", "all"):
    saved, cam = setup()
    try:
        if STAGE in ("plate", "all"):
            RESULT["plate"] = stage_plate()
        if STAGE in ("press", "all"):
            RESULT["press"] = stage_press(cam)
    finally:
        teardown(saved, cam)
print("[dash-screen]", RESULT, flush=True)
