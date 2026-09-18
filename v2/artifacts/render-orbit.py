"""Orbit frames: the canvas the /car sequence scrubs, renders-sr26/full/NNNN.

The scene's own camera, "Front View", rides a path round the car with a Track To
on Empty.001; Blender frame N is full/NNNN.webp and site frame N-1. Settings are
the orbit pass's, the ones render-layers.py copies. Nothing else is set up: every
object renders, and the studio planes light the car without facing camera.

In the portrait profile the same camera is used at the same frame - its path,
constraints, depth of field and aperture blades untouched - with only its sensor
(K) and lens shift changed, and put back afterwards. Both come from
portrait-plan.json via render_profile.orbit_cam: an orbit still takes its own
values, which are also what any leg lifting off or landing on it uses, and a
painted frame between two stills eases between theirs.

  FRAMES   Blender frames to render (default [1], the head-on view the sequence
           opens on). The page paints 1-32 and 109-120.
  QUALITY  preview (64 spp, 50%, PNG) | final (256 spp, 100%, WEBP q80)
  PROFILE  landscape (default) | portrait; KOPT the plan option
  OUTDIR   default renders-sr26/full/ (portrait: renders-sr26/portrait/full/)

Run headless with the car .blend; it never saves it.
"""

import bpy, os, time

HERE = os.path.dirname(os.path.abspath(globals().get(
    "__file__", "/Users/aretelew/Developer/baja/baja-website/v2/artifacts/render-orbit.py")))
exec(open(os.path.join(HERE, "render_profile.py")).read())

FRAMES  = list(globals().get("FRAMES", [1]))
QUALITY = globals().get("QUALITY", "preview")
OUTDIR  = globals().get("OUTDIR", profile_dir(
    "/Users/aretelew/Developer/baja/baja-website/v2/public/renders-sr26/full/"))
os.makedirs(OUTDIR, exist_ok=True)

scn = bpy.context.scene
r, cy = scn.render, scn.cycles
ORBIT_CAM = scn.camera

# ---------- same dark-material pass the layer renders run ----------
DARK = {"Rubber Black":0.035,"Black Rubber":0.035,"Black 3d Print":0.035,
        "Black Aluminum":0.035,"Black Plastic":0.030,"Black Oxide":0.030,"Rim":0.050}
for mn, val in DARK.items():
    m = bpy.data.materials.get(mn)
    if not m or not m.use_nodes: continue
    for n in m.node_tree.nodes:
        if n.type=='BSDF_PRINCIPLED' and not n.inputs['Base Color'].is_linked:
            a = n.inputs['Base Color'].default_value[3]
            n.inputs['Base Color'].default_value = (val,val,val,a)

prev = dict(samples=cy.samples, pct=r.resolution_percentage, res=(r.resolution_x, r.resolution_y),
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
r.resolution_x, r.resolution_y = PORTRAIT_RES if PORTRAIT else LANDSCAPE_RES
scn.display_settings.display_device = 'sRGB'
scn.view_settings.view_transform = 'AgX'
if QUALITY == "preview":
    cy.samples = 64; r.resolution_percentage = 50
    r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'
else:
    cy.samples = 256; r.resolution_percentage = 100
    r.image_settings.file_format = 'WEBP'; r.image_settings.color_mode = 'RGBA'
    r.image_settings.quality = 80
if PORTRAIT:
    portrait_output(QUALITY)

MESHY = {'MESH','CURVE','SURFACE','META','FONT','GPENCIL'}
for o in bpy.data.objects:
    if o.type in MESHY:
        o.hide_render = False; o.is_holdout = False
        # the studio rig lights the scene but must never face camera
        o.visible_camera = not o.name.startswith("Plane")

TIMES = {}
try:
    for bf in FRAMES:
        M, cd, undo = orbit_camera(bf, ORBIT_CAM)
        try:
            r.filepath = os.path.join(OUTDIR, "%04d" % bf)
            t0 = time.time()
            bpy.ops.render.render(write_still=True)
            TIMES[bf] = round(time.time() - t0, 1)
            print("[orbit] %04d  %.1fs  key %s" % (bf, TIMES[bf], camera_key(M, cd)), flush=True)
        finally:
            undo()
finally:
    cy.samples = prev["samples"]; r.resolution_percentage = prev["pct"]
    r.resolution_x, r.resolution_y = prev["res"]
    r.image_settings.file_format = prev["fmt"]; r.image_settings.color_mode = prev["cm"]
    r.image_settings.quality = prev["q"]; r.filepath = prev["fp"]
    scn.frame_set(prev["frame"])

RESULT = {"profile": PROFILE, "KOPT": KOPT if PORTRAIT else None, "quality": QUALITY,
          "frames": FRAMES, "times": TIMES, "outdir": OUTDIR}
print("[orbit] RESULT", RESULT, flush=True)
