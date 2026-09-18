"""A/B the four things that soften a closeup, one at a time.

The brake closeup reads soft and featureless. Four candidate causes, and only a
render tells you which ones matter:

  a  baseline      exactly what ships today
  b  + f/16        the shipped f/5.6 leaves 6cm of depth at 1.0m; the assembly
                   is ~18cm deep along the view axis, so most of it is genuinely
                   out of focus and no sample count will sharpen it
  c  + optics      Filter Glossy 1.0 -> 0 (it deliberately roughens sharp glossy
                   reflections to cut noise) and a tighter pixel filter
  d  + machining   the bare-metal materials are a flat base colour and one
                   roughness number - no bump, no roughness break-up, nothing to
                   resolve at any sample count
  e  + 2x res      1920 wide is upscaled on any Retina display

Renders one frame per variant to OUTDIR as PNG. Set VARIANTS to a subset.
"""

import bpy, os, time
from mathutils import Vector

OUTDIR   = globals().get("OUTDIR", "/tmp/detail-probe/")
VARIANTS = globals().get("VARIANTS", ["a", "b", "c", "d", "e"])
SAMPLES  = globals().get("SAMPLES", 256)
DENOISE  = globals().get("DENOISE", True)
IDX      = globals().get("IDX", 23)
os.makedirs(OUTDIR, exist_ok=True)

BRAKE = "/Users/aretelew/Developer/baja/baja-website/v2/artifacts/render-brake-push.py"
_g = {"STAGE": "none", "QUALITY": "preview"}
exec(compile(open(BRAKE).read(), BRAKE, "exec"), _g)
pose, FRONT, fade_rig, fade_restore = _g["pose"], _g["FRONT"], _g["fade_rig"], _g["fade_restore"]
meshes, SIDE_BF = _g["meshes"], _g["SIDE_BF"]

scn = bpy.context.scene
r, cy = scn.render, scn.cycles

# The bare-metal materials: a Principled BSDF, a flat base colour, one roughness
# value, and nothing else in the node tree.
BARE_METAL = ("Aluminum", "Steel", "Brass", "Titanium", "Rim")


def add_machining(names):
    """Give a flat metal shader something to resolve.

    Two additions, both cheap: a fine bump so the surface is not optically
    perfect, and a low-frequency roughness break-up so the highlight stops being
    one uniform sheet. Object coordinates, so the feature size is consistent
    across parts rather than scaling with each part's bounding box.
    """
    undo = []
    for nm in names:
        m = bpy.data.materials.get(nm)
        if not m or not m.use_nodes:
            continue
        nt = m.node_tree
        bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf or bsdf.inputs['Roughness'].is_linked:
            continue
        rough0 = bsdf.inputs['Roughness'].default_value
        added = []

        def new(t):
            n = nt.nodes.new(t); added.append(n); return n

        coord = new('ShaderNodeTexCoord')

        micro = new('ShaderNodeTexNoise')            # tool marks / cast texture
        micro.inputs['Scale'].default_value = 900.0
        micro.inputs['Detail'].default_value = 8.0
        micro.inputs['Roughness'].default_value = 0.65
        nt.links.new(micro.inputs['Vector'], coord.outputs['Object'])

        bump = new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.35
        bump.inputs['Distance'].default_value = 0.00006   # 60 microns
        nt.links.new(bump.inputs['Height'], micro.outputs['Fac'])
        nt.links.new(bsdf.inputs['Normal'], bump.outputs['Normal'])

        patch = new('ShaderNodeTexNoise')            # finish variation
        patch.inputs['Scale'].default_value = 26.0
        patch.inputs['Detail'].default_value = 4.0
        nt.links.new(patch.inputs['Vector'], coord.outputs['Object'])

        mr = new('ShaderNodeMapRange')
        mr.inputs['From Min'].default_value = 0.35
        mr.inputs['From Max'].default_value = 0.65
        mr.inputs['To Min'].default_value = max(0.02, rough0 - 0.07)
        mr.inputs['To Max'].default_value = rough0 + 0.09
        mr.clamp = True
        nt.links.new(mr.inputs['Value'], patch.outputs['Fac'])
        nt.links.new(bsdf.inputs['Roughness'], mr.outputs['Result'])

        undo.append((nt, bsdf, rough0, added))
    return undo


def remove_machining(undo):
    for nt, bsdf, rough0, added in undo:
        for n in added:
            nt.nodes.remove(n)
        bsdf.inputs['Roughness'].default_value = rough0


VARIANT = {
    "a": dict(fstop=5.6,  glossy=1.0, filt=1.5, machined=False, scale=100),
    "b": dict(fstop=16.0, glossy=1.0, filt=1.5, machined=False, scale=100),
    "c": dict(fstop=16.0, glossy=0.0, filt=1.2, machined=False, scale=100),
    "d": dict(fstop=16.0, glossy=0.0, filt=1.2, machined=True,  scale=100),
    "e": dict(fstop=16.0, glossy=0.0, filt=1.2, machined=True,  scale=200),
}

prev = dict(cam=scn.camera, samples=cy.samples, pct=r.resolution_percentage,
            fmt=r.image_settings.file_format, cm=r.image_settings.color_mode,
            fp=r.filepath, frame=scn.frame_current, glossy=cy.blur_glossy,
            filt=r.filter_size)

prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'
for d in prefs.devices:
    d.use = (d.type == 'METAL')
r.engine = 'CYCLES'; cy.device = 'GPU'
cy.use_adaptive_sampling = True; cy.adaptive_threshold = 0.01
cy.use_denoising = DENOISE; cy.denoiser = 'OPENIMAGEDENOISE'
cy.denoising_prefilter = 'ACCURATE'; cy.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
r.use_persistent_data = True; r.use_motion_blur = False; r.film_transparent = True
r.resolution_x, r.resolution_y = 1920, 1080
r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'
cy.samples = SAMPLES

src_cam = scn.camera.data
tmp = bpy.data.objects.new("TMP_PROBECAM", bpy.data.cameras.new("TMP_PROBECAM"))
tmp.data.lens = src_cam.lens
tmp.data.sensor_width = src_cam.sensor_width
tmp.data.sensor_fit = src_cam.sensor_fit
tmp.data.dof.use_dof = True
scn.collection.objects.link(tmp); scn.camera = tmp
scn.frame_set(SIDE_BF)

RESULT = {}
try:
    for key in VARIANTS:
        v = VARIANT[key]
        undo = add_machining(BARE_METAL) if v["machined"] else []
        facs, fundo = fade_rig([bpy.data.objects[n] for n in FRONT])
        try:
            for o in meshes():
                o.hide_render = False; o.is_holdout = False
                o.visible_camera = (not o.name.startswith("Plane")) and o.name not in FRONT
            for f in facs:
                f.outputs[0].default_value = 1.0      # tire gone, as at the end
            M, focus, _ = pose(IDX)
            tmp.matrix_world = M
            tmp.data.dof.focus_object = None
            tmp.data.dof.focus_distance = focus
            tmp.data.dof.aperture_fstop = v["fstop"]
            cy.blur_glossy = v["glossy"]
            r.filter_size = v["filt"]
            r.resolution_percentage = v["scale"]
            bpy.context.view_layer.update()
            r.filepath = os.path.join(OUTDIR, "%s" % key)
            t0 = time.time()
            bpy.ops.render.render(write_still=True)
            RESULT[key] = {"secs": round(time.time() - t0, 1), **v}
            print("[probe] %s  %.1fs" % (key, time.time() - t0), flush=True)
        finally:
            fade_restore(fundo)
            remove_machining(undo)
finally:
    for o in meshes():
        o.hide_render = False; o.is_holdout = False
        o.visible_camera = not o.name.startswith("Plane")
    scn.camera = prev["cam"]; bpy.data.objects.remove(tmp, do_unlink=True)
    cy.samples = prev["samples"]; r.resolution_percentage = prev["pct"]
    r.image_settings.file_format = prev["fmt"]; r.image_settings.color_mode = prev["cm"]
    r.filepath = prev["fp"]; cy.blur_glossy = prev["glossy"]; r.filter_size = prev["filt"]
    scn.frame_set(prev["frame"])
