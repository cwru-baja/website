"""Masks of the parts the /car labels point at, for the hover highlight.

Hovering a label on the site dims everything in the pause's still except that
part, and lifts the part a little. The part is cut out with a matte rendered here
from the exact camera the still was rendered from, so it covers only what can be
seen of the part - wherever the car hides it, the matte is already cut away.

One render per pause gives every part: Cryptomatte, object and material layers.
A part is a set of objects - named, or every object under a CAD assembly - plus
or minus some materials where one object holds more than one part. The brake
line routing mesh also carries the master cylinders' reservoirs, and the
reservoir materials are used by no other object, so the reservoirs move over to
the master cylinders by material rather than by splitting the mesh.

Where one mesh holds two parts and no material separates them, a pause can
`split` it: the connected islands that sit entirely inside a box become their own
object and the remainder becomes another, and the parts claim those instead.
Whole islands rather than the faces inside the box, so nothing is ever cut
mid-hose. The copies stand in for the original, which is then held out of the
render, so what renders is unchanged - the alignment check below proves it.

An assembly also holds objects the pause never renders, like the bearings and
screws the drivetrain view leaves out, or the CVT's pulleys under its cover.
They have no pixels, so they add nothing; a name that is not in the .blend at
all still stops the script, and so does a part with nothing in view.

The render's own alpha is checked against the shipped still's before anything is
written. If the camera was not reproduced exactly the masks would sit beside
their parts, so it stops instead.

  PAUSE    which pause to render (brakes | drivetrain | suspension)
  SAMPLES  anti-aliasing samples; a matte needs no light, so few are plenty
  PROFILE  landscape (default) | portrait: the phone set's 4:5 still, same pose,
           with the K and lens shift artifacts/portrait-plan.json gives that
           still (KOPT picks the option, default k070). The alignment check then
           runs against the still's lossless master in artifacts/masters/portrait/.
  OUTDIR   where the 8-bit PNG mattes go (artifacts/part-mattes/<pause>/, or
           artifacts/part-mattes-portrait/<pause>/ in portrait)

Run with the car .blend:
  blender --background <blend> --python artifacts/render-part-mattes.py
It never saves the .blend. artifacts/export-part-mattes.mjs turns the mattes into
the site's masks.
"""

import bpy, os, json, struct, time
import numpy as np
import OpenImageIO as oiio

HERE = os.path.dirname(os.path.abspath(globals().get(
    "__file__", "/Users/aretelew/Developer/baja/baja-website/v2/artifacts/render-part-mattes.py")))
REPO = os.path.dirname(HERE)
PAUSE = globals().get("PAUSE", os.environ.get("PAUSE", "brakes"))
SAMPLES = int(globals().get("SAMPLES", os.environ.get("SAMPLES", 32)))
PROFILE = globals().get("PROFILE", os.environ.get("PROFILE", "landscape"))
PORTRAIT = PROFILE == "portrait"
KOPT = globals().get("KOPT", os.environ.get("KOPT", "k070"))
OUTDIR = globals().get("OUTDIR", os.path.join(
    HERE, "part-mattes-portrait" if PORTRAIT else "part-mattes", PAUSE))
# Each pause's still in the portrait plan, and where its lossless master is. The
# phone's drivetrain still is overhead with the nose up, the pose the desktop's
# roll ends on, so it takes that still's K and shift.
PORTRAIT_STILL = {"brakes": "brake-close", "drivetrain": "roll-end", "suspension": "corner"}
PORTRAIT_MASTERS = os.path.join("artifacts", "masters", "portrait", KOPT)

RESERVOIRS = ["Translucent White PLastic", "Pink Fluid (Foggy Container)", "face2160.004"]

PAUSES = {
    "brakes": dict(
        # The last pose of the brake arc's "in" leg, which the timeline holds on.
        still="public/renders-sr26/layers/brake-arc/000-brake-arc-0030.webp",
        script="render-brake-arc.py",
        # What the shipped 30-frame leg was rendered with. The script's own
        # defaults differ (EL_END 26, NOSE_PICK "all"), and the still is the
        # reference, so the alignment check is what confirms these.
        settings=dict(QUALITY="final", N=30, PART_N=18, AZ_END=45.0, EL_END=32.0,
                      PAD=0.26, NOSE_PICK="deck", START_BF=1, LEG="in", STAGE="none"),
        # The fittings where the hoses land on the cylinders are modelled inside
        # the brake line routing mesh, and share their materials with the lines
        # that run to the corners. What separates them is where they sit: each
        # fitting is a small island wholly inside the box around the masters,
        # while every line reaches out past it.
        splits={
            "TMP_BRK_FITTINGS": dict(
                object="26-FI-BRK-GX-XX Brake Line Routing Linked",
                box=((-0.17, -0.02), (0.86, 1.08), (0.40, 0.50)),
                rest="TMP_BRK_LINES",
            ),
        },
        # Part ids are what the site's labels name in their `part` field.
        parts={
            "caliper": dict(objects=["26-FO-BRK-I1-00 Front Brake Caliper Assem"]),
            "rotor": dict(objects=["26-FO-BRK-R1-01 Front Brake Rotor"]),
            # The two hoses that feed the masters from the reservoirs are their
            # own objects, under CAD-generic names and a material used nowhere
            # else ("Pink Fluid"). They belong to this part, not to the brake
            # lines: they carry fluid down to the cylinders rather than pressure
            # out to the corners, and they are what reads as dark otherwise.
            "master-cylinders": dict(objects=["26-FI-BRK-H1-00 Brake Masters",
                                              "NurbsCurve", "NurbsCurve.001",
                                              "TMP_BRK_FITTINGS"],
                                     materials=RESERVOIRS),
            # Mesh_3376 is the near front hose, its own object under the routing.
            "brake-lines": dict(objects=["TMP_BRK_LINES", "Mesh_3376"],
                                minus_materials=RESERVOIRS),
        },
    ),
    "drivetrain": dict(
        # The overhead isolate the crane beat holds on: only the drivetrain.
        still="public/renders-sr26/layers/059-drivetrain-top.webp",
        script="render-crane.py",
        # "verify" only sets up the crane's poses and checks them; nothing renders.
        settings=dict(ARC="verify"),
        parts={
            "engine": dict(objects=["26-KOHLER ENGINE_step"]),
            # All that shows of the CVT from above is its shroud; the pulleys are
            # listed so the part stays right if a view ever opens it up.
            "cvt": dict(assemblies=["26-RI-DRT-C1-00 Shroud", "26-RI-DRT-A1-00 CVT Primary Assembly"],
                        objects=["26-RI-DRT-B1 CVT Secondary Assem"],
                        except_objects=["26-RI-DRT-C1-08 Gearbox Mount"]),
            "gearbox": dict(assemblies=["26-RI-DRT-D1 Gearbox", "26-RI-DRT-E1-00 Gbx Output Yokes"],
                            objects=["26-RI-DRT-C1-08 Gearbox Mount"]),
            # The CAD calls only the rear shafts half shafts (the front ones are
            # "Front Shaft"). Every SDH-5 U-joint cross and cap is on a rear shaft.
            "rear-half-shafts": dict(assemblies=["26-RO-DRT-Y1 Rear Half Shaft Assem",
                                                 "26-RO-DRT-Y1 Rear Half Shaft Assem.001"],
                                     prefixes=["SDH-5-170X_"]),
            # The carbon tubes and their shroud, standoffs and mid bearing.
            "propshaft": dict(objects=[
                "26-MI-DRT-J1-01 Mid Bearing Mount", "26-MI-DRT-L1-01 Twist Lock Cap",
                "26-MI-DRT-L1-02 Mid Bearing HROE Shroud Rear", "26-MI-DRT-L1-03 HROE Cap",
                "26-MI-DRT-L1-04 Forward Carbon Shroud Tube", "26-MI-DRT-L1-05 Rear Propshaft Carbon Tube",
                "26-MI-DRT-L1-06 Shroud Standoff 1", "26-MI-DRT-L1-07 Shroud Standoff 2",
                "26-MI-DRT-L1-08 Shroud Standoff 3", "26-MI-DRT-L1-09 Shroud Standoff 4",
                "26-MI-DRT-L1-13 Shroud hoop", "26-MI-DRT-L1-15 Mid Bearing HROE Shroud Front"]),
            # The bevel hat the dog drops onto is inside the box and stays with
            # it; the dog itself is its own label below.
            "bevel-box": dict(assemblies=["26-RI-DRT-G1-00 Rear Bevel Box Linked"],
                              objects=["26-MI-DRT-L1-10 Bevel Box Cap"]),
            # The dog that engages 4WD, in its own assembly on top of the box.
            # From overhead all that shows is the house around it, which is what
            # the label lights - the same reading as the CVT under its shroud.
            # The CAD has the assembly twice, once under a "&" name carrying a
            # second Dawg House; both are listed.
            "dog-clutch": dict(assemblies=["26-RI-DRT-F1-00 Dog and Dog House",
                                           "26-RI-DRT-F1-00 Dog & Dog House"]),
            "front-transfer-case": dict(assemblies=["26-FI-DRT-O1-00 Front Transfer Case"],
                                        objects=["26-MI-DRT-L1-11 Transfer Case HROE Rear",
                                                 "26-MI-DRT-L1-12 Transfer Case Side Cap",
                                                 "26-MI-DRT-L1-16 Transfer Case HROE Front"]),
            # One unit on the centreline, wrapped around the transfer case: a
            # cage, hub and compression plate inside housing halves the CAD calls
            # left and right. The +X side of what bolts to it - the outer yoke
            # cup, its tabs and the access plate that reads on top from overhead -
            # came in from CAD under Node_* names, the same import that dropped
            # the right front linkage (see LINK in render-crane.py), so it is
            # listed by hand. Without it only the left half of a part that is
            # symmetric on screen lights up.
            "torque-limiter": dict(assemblies=["26-FI-DRT-P1-00 Toruqe Limiter"],
                                   objects=["Node_641", "Node_647", "Node_651", "Node_657"]),
            # The wheel ends, both sides of the car. The front spindle is a yoke
            # in CAD - it is the shaft's outboard yoke, splined through the
            # upright - and both ends carry "Rear Spindle Nut" copies: the front
            # pair are the base name and .003, the rear pair .001 and .002. The
            # outboard U-joint yokes just inboard of each spindle drive it rather
            # than belong to it, so they stay dim with the shafts.
            "front-hub-and-spindle": dict(objects=[
                "26-FO-DRT-R1-01 Front Hub Linked", "26-FO-DRT-R1-01 Front Hub Linked.001",
                "26-FO-DRT-R1-02 Front Hub Spacer", "26-FO-DRT-R1-02 Front Hub Spacer Linked",
                "26-FO-DRT-S1-01 Spindle Yoke Linked", "26-FO-DRT-S1-01 Spindle Yoke Linked.001",
                "26-RO-DRT-X1-003 Rear Spindle Nut", "26-RO-DRT-X1-003 Rear Spindle Nut.003"]),
            "rear-hub-and-spindle": dict(objects=[
                "26-RO-DRT-W1-01 Rear Hub", "26-RO-DRT-W1-01 Rear Hub.001",
                "26-RO-DRT-X1-00 Rear Spindle", "26-RO-DRT-X1-00 Rear Spindle.001",
                "26-RO-DRT-X1-003 Rear Spindle Nut.001", "26-RO-DRT-X1-003 Rear Spindle Nut.002"]),
        },
    ),
    "suspension": dict(
        # The last pose of the corner push, which the landed beat opens on and
        # holds. See pauseLayerUrl in carSequenceModel.ts.
        still="public/renders-sr26/layers/108-susp-corner-0024.webp",
        script="render-susp-corner.py",
        # The push shipped on the script's own defaults, so only the stage is
        # overridden; "none" renders nothing and just leaves the pose maths behind.
        settings=dict(STAGE="none"),
        # Every part here is the near-side front corner's, and only its. The
        # closeup is deliberately one corner (see render-susp-corner.py), the
        # labels point into it, and the far side's arms - the only other
        # suspension in shot - are cut by the left edge, so lighting them pulls
        # the eye off the corner being read.
        parts={
            "shocks": dict(objects=["26-RP-SUS-K1-01 CWRU Baja Shock Upper.003",
                                    "26-RP-SUS-K1-02 CWRU Baja Shock Lower.003"]),
            # The rear arm in shot is a trailing arm, not a wishbone.
            "wishbones": dict(objects=["26-FO-SUS-F1-00 Front Upper Arm Linked",
                                       "26-FO-SUS-G1-00 Front Lower Arm Linked"]),
            "uprights": dict(objects=["26-FO-SUS-E1-00 Front Upright Linked"]),
            # The hub, the spacer behind it, the nut on its spindle and the four
            # studs pressed into its face - what reads as one machined piece. The
            # spindle yoke inside it drives the wheel and belongs to the shaft.
            # The nut is a "Rear Spindle Nut" copy sitting on the front spindle,
            # and the studs are numbered per car rather than per hub, so this
            # corner's four are .004 to .007.
            "hubs": dict(objects=["26-FO-DRT-R1-01 Front Hub Linked.001",
                                  "26-FO-DRT-R1-02 Front Hub Spacer",
                                  "26-RO-DRT-X1-003 Rear Spindle Nut.003"]
                                 + [f"Dorman 610-308 M10-1.25 Serrated Wheel Stud.00{n}"
                                    for n in range(4, 8)]),
        },
    ),
}

cfg = PAUSES[PAUSE]
os.makedirs(OUTDIR, exist_ok=True)
scn = bpy.context.scene
r, cy = scn.render, scn.cycles


def brakes_camera():
    """The brake arc script's own camera and cover split, with nothing rendered.

    Run with STAGE "none" it only defines its pose maths and cleans up after
    itself; the camera for the held pose is then rebuilt from its pose(N - 1)
    the same way it builds its temporary camera. Returns what to hide and how to
    undo the throwaway objects."""
    g = dict(cfg["settings"], OUTDIR=OUTDIR)
    exec(open(os.path.join(HERE, cfg["script"])).read(), g)
    M, focus, fstop = g["pose"](g["N"] - 1)
    src = g["src_cam"]
    cam = bpy.data.objects.new("TMP_MATTECAM", bpy.data.cameras.new("TMP_MATTECAM"))
    cam.data.lens, cam.data.sensor_width, cam.data.sensor_fit = src.lens, src.sensor_width, src.sensor_fit
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance, cam.data.dof.aperture_fstop = focus, fstop
    scn.collection.objects.link(cam)
    scn.frame_set(g["START_BF"])
    cam.matrix_world = M
    scn.camera = cam
    rest, nose, _ = g["nose_split"]()
    # The base pass: front wheels and the nose deck gone, the rest of the panels
    # standing in for the original mesh, and the studio planes never in camera.
    hidden = set(g["FRONT"]) | {nose.name, g["PANELS"]}
    for o in g["meshes"]():
        o.hide_render = o.name in hidden or o.name.startswith("Plane")
        o.is_holdout = False
        o.visible_camera = True

    def cleanup():
        bpy.data.meshes.remove(rest.data)
        bpy.data.meshes.remove(nose.data)
        bpy.data.objects.remove(cam, do_unlink=True)
    return cleanup


def drivetrain_camera():
    """The crane script's overhead isolate: straight down on the car with the nose
    to screen right (to the top of the page in portrait, where the phone's crane
    lands), and only its drivetrain set rendering. The studio planes stay on, as
    they do in that shot."""
    g = dict(cfg["settings"], OUTDIR=OUTDIR)
    exec(open(os.path.join(HERE, cfg["script"])).read(), g)
    cam = bpy.data.objects.new("TMP_MATTECAM", bpy.data.cameras.new("TMP_MATTECAM"))
    cam.data.lens = scn.camera.data.lens
    scn.collection.objects.link(cam)
    scn.frame_set(g["SIDE_BF"])
    cam.matrix_world = g["look_at"](g["TGT"] + g["d_top"] * g["TOP_DIST"], g["TGT"], g["TOP_UP"])
    if PORTRAIT:
        cam.matrix_world = g["M_TOP_NOSE_UP"]
    scn.camera = cam
    for o in g["meshes"]():
        o.hide_render = not (o.name.startswith("Plane") or o.name in g["DRIVE"])
        o.is_holdout = False

    def cleanup():
        bpy.data.objects.remove(cam, do_unlink=True)
    return cleanup


def suspension_camera():
    """The front corner closeup the corner push lands on, rebuilt from its last pose.

    Same shape as the brake arc's camera, and for the same reason: the script
    that rendered the still only defines the pose maths when nothing is staged,
    so the pose is taken from its pose(N - 1) and a throwaway camera is given
    the lens, the focus distance and the f-stop it worked out. The push stops
    down to f/5.6 by the end, so the DOF has to come along or the matte edges
    would be sharper than the still's.

    The base pass hides the wheels from camera - which is the whole point of the
    beat - so the matte pass hides them too, and its alpha is the car without
    them, exactly as shipped."""
    g = dict(cfg["settings"], OUTDIR=OUTDIR)
    exec(open(os.path.join(HERE, cfg["script"])).read(), g)
    M, focus, fstop = g["pose"](g["N"] - 1)
    src = g["src_cam"]
    cam = bpy.data.objects.new("TMP_MATTECAM", bpy.data.cameras.new("TMP_MATTECAM"))
    cam.data.lens, cam.data.sensor_width, cam.data.sensor_fit = src.lens, src.sensor_width, src.sensor_fit
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance, cam.data.dof.aperture_fstop = focus, fstop
    scn.collection.objects.link(cam)
    scn.frame_set(g["SIDE_BF"])
    cam.matrix_world = M
    scn.camera = cam
    for o in g["meshes"]():
        o.hide_render = False
        o.is_holdout = False
        o.visible_camera = not (o.name.startswith("Plane") or o.name in g["WHEELS"])

    def cleanup():
        bpy.data.objects.remove(cam, do_unlink=True)
    return cleanup


def apply_splits():
    """Cut a mesh into the pieces the parts claim, and stand them in for it.

    A piece is every connected island that lies entirely inside a box, which is
    what separates the fittings on the master cylinders from the lines that run
    out to the corners: they share materials, and only where they sit differs.
    Islands rather than the faces inside the box, so a hose crossing the boundary
    is never cut in half - it simply stays with the remainder."""
    made = []
    for name, spec in cfg.get("splits", {}).items():
        src = bpy.data.objects[spec["object"]]
        me = src.data
        count = len(me.vertices)
        parent = np.arange(count)

        def root(a):
            while parent[a] != a:
                parent[a] = parent[parent[a]]
                a = parent[a]
            return a

        edges = np.empty(len(me.edges) * 2, dtype=np.int64)
        me.edges.foreach_get("vertices", edges)
        for a, b in edges.reshape(-1, 2):
            ra, rb = root(int(a)), root(int(b))
            if ra != rb:
                parent[ra] = rb
        roots = np.array([root(i) for i in range(count)])
        co = np.empty(count * 3)
        me.vertices.foreach_get("co", co)
        world = co.reshape(count, 3) @ np.array(src.matrix_world.to_4x4())[:3, :3].T \
            + np.array(src.matrix_world.to_4x4())[:3, 3]
        (x0, x1), (y0, y1), (z0, z1) = spec["box"]
        inside = ((world[:, 0] >= x0) & (world[:, 0] <= x1)
                  & (world[:, 1] >= y0) & (world[:, 1] <= y1)
                  & (world[:, 2] >= z0) & (world[:, 2] <= z1))
        whole = {int(r) for r in np.unique(roots) if inside[roots == r].all()}
        keep = [i for i in range(count) if int(roots[i]) in whole]
        if not keep:
            raise SystemExit(f"[mattes] split {name} caught no island of {spec['object']!r}")

        for copy_name, invert in ((name, False), (spec["rest"], True)):
            copy = src.copy()
            copy.data = src.data.copy()
            copy.name = copy_name
            for collection in src.users_collection:
                collection.objects.link(copy)
            copy.matrix_world = src.matrix_world.copy()
            group = copy.vertex_groups.new(name="SPLIT")
            group.add(keep, 1.0, "REPLACE")
            mask = copy.modifiers.new("Split", "MASK")
            mask.vertex_group = "SPLIT"
            mask.invert_vertex_group = invert
            copy.hide_render = False
            copy.is_holdout = False
            copy.visible_camera = True
            made.append(copy)
        src.hide_render = True
        print(f"[mattes] split {spec['object']!r}: {len(keep)} of {count} verts -> {name}", flush=True)

    def undo():
        for copy in made:
            bpy.data.meshes.remove(copy.data)
        for spec in cfg.get("splits", {}).values():
            bpy.data.objects[spec["object"]].hide_render = False
    return undo


def members(spec):
    """Every object name a part covers."""
    names = set(spec.get("objects", []))
    for assembly in spec.get("assemblies", []):
        names |= {o.name for o in bpy.data.objects[assembly].children_recursive}
    for prefix in spec.get("prefixes", []):
        names |= {o.name for o in bpy.data.objects if o.name.startswith(prefix)}
    names -= set(spec.get("except_objects", []))
    return names


def check_parts():
    """A typo fails in seconds, and no object may light up under two labels.

    Runs once the splits exist, because parts name the pieces they produced."""
    owner = {}
    for part, spec in cfg["parts"].items():
        for name in (set(spec.get("objects", [])) | set(spec.get("assemblies", []))
                     | set(spec.get("except_objects", []))):
            if name not in bpy.data.objects:
                raise SystemExit(f"[mattes] {part}: no object named {name!r} in the .blend")
        for name in members(spec):
            if name in owner:
                raise SystemExit(f"[mattes] {name!r} is in both {owner[name]} and {part}")
            owner[name] = part


def read(path, sub=0):
    image = oiio.ImageInput.open(path)
    if not image.seek_subimage(sub, 0):
        raise RuntimeError(f"{path} has no subimage {sub}")
    spec = image.spec()
    pixels = image.read_image(sub, 0, 0, spec.nchannels, oiio.FLOAT)
    image.close()
    return np.asarray(pixels, dtype=np.float32), spec


def subimages(path):
    image = oiio.ImageInput.open(path)
    names, index = {}, 0
    while image.seek_subimage(index, 0):
        names[image.spec().getattribute("name")] = index
        index += 1
    attrs = {a.name: a.value for a in image.spec().extra_attribs} if image.seek_subimage(0, 0) else {}
    image.close()
    return names, attrs


def write_matte(path, alpha):
    h, w = alpha.shape
    rgba = np.dstack([np.ones_like(alpha)] * 3 + [alpha])
    out = oiio.ImageOutput.create(path)
    out.open(path, oiio.ImageSpec(w, h, 4, oiio.UINT8))
    out.write_image((np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8))
    out.close()


cleanup = {"brakes": brakes_camera, "drivetrain": drivetrain_camera,
           "suspension": suspension_camera}[PAUSE]()
if PORTRAIT:
    # Same pose and focal length as the landscape still; only the sensor and the
    # shift change, exactly as the portrait frames were rendered.
    profile = dict(PROFILE="portrait", KOPT=KOPT, HERE=HERE)
    exec(open(os.path.join(HERE, "render_profile.py")).read(), profile)
    profile["set_portrait_camera"](scn.camera.data, *profile["still"](PORTRAIT_STILL[PAUSE]))
RES = (1080, 1350) if PORTRAIT else (1920, 1080)
undo_splits = apply_splits()
check_parts()
exr = os.path.join(OUTDIR, "cryptomatte.exr")
try:
    r.engine = "CYCLES"
    cy.device = "GPU"
    r.use_motion_blur = False
    r.film_transparent = True
    r.resolution_x, r.resolution_y, r.resolution_percentage = RES[0], RES[1], 100
    cy.samples = SAMPLES
    cy.use_adaptive_sampling = False
    cy.use_denoising = False
    cy.diffuse_bounces = cy.glossy_bounces = cy.transmission_bounces = cy.volume_bounces = 0
    layer = bpy.context.view_layer
    layer.use_pass_cryptomatte_object = True
    layer.use_pass_cryptomatte_material = True
    layer.pass_cryptomatte_depth = 6
    r.image_settings.media_type = "MULTI_LAYER_IMAGE"
    r.image_settings.file_format = "OPEN_EXR_MULTILAYER"
    r.image_settings.color_depth = "32"
    r.filepath = exr
    started = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"[mattes] rendered {PAUSE} in {time.time() - started:.1f}s", flush=True)
finally:
    undo_splits()
    cleanup()
    print(f"[mattes] blend dirty: {bpy.data.is_dirty}", flush=True)

# ---------- extract ----------
names, attrs = subimages(exr)
view = layer.name

still_path = cfg["still"]
if PORTRAIT:
    still_path = os.path.join(PORTRAIT_MASTERS, os.path.splitext(
        cfg["still"].replace("public/renders-sr26/", "", 1))[0] + ".png")
still, _ = read(os.path.join(REPO, still_path))
still_alpha = still[..., 3]
render_alpha = read(exr, names[f"{view}.Combined"])[0][..., 3]
inside, reference = render_alpha > 0.5, still_alpha > 0.5
iou = float((inside & reference).sum() / (inside | reference).sum())
mean_error = float(np.abs(render_alpha - still_alpha).mean())
print(f"[mattes] silhouette vs shipped still: IoU {iou:.5f}, mean abs {mean_error:.5f}", flush=True)
if iou < 0.999 or mean_error > 0.002:
    raise SystemExit("[mattes] the camera does not reproduce the still; not writing mattes")


def manifest(kind):
    key = next(k for k, v in attrs.items() if k.endswith("/name") and v == f"{view}.Crypto{kind}")
    return json.loads(attrs[key.rsplit("/", 1)[0] + "/manifest"]), [
        read(exr, names[f"{view}.Crypto{kind}{rank:02d}"])[0] for rank in range(3)]


def coverage(kind, wanted, in_view_only=False):
    ids, ranks = manifest(kind)
    total = np.zeros(still_alpha.shape, np.float32)
    for name in wanted:
        if name not in ids:
            # Objects were checked against the .blend up front; one missing here
            # just does not render in this pause.
            if in_view_only:
                continue
            raise SystemExit(f"[mattes] no {kind.lower()} named {name!r} in view")
        target = struct.unpack(">f", bytes.fromhex(ids[name]))[0]
        for rank in ranks:
            for id_channel, weight_channel in ((0, 1), (2, 3)):
                total += np.where(rank[..., id_channel] == target, rank[..., weight_channel], 0)
    return total


report = {"iou": round(iou, 5), "mean_abs": round(mean_error, 5), "parts": {}}
check = still[..., :3] * still_alpha[..., None] * 0.35
for part, spec in cfg["parts"].items():
    alpha = coverage("Object", sorted(members(spec)), in_view_only=True)
    if alpha.sum() < 1:
        raise SystemExit(f"[mattes] {part} has nothing in view")
    if spec.get("materials"):
        alpha += coverage("Material", spec["materials"])
    if spec.get("minus_materials"):
        alpha -= coverage("Material", spec["minus_materials"])
    alpha = np.clip(alpha, 0, 1)
    write_matte(os.path.join(OUTDIR, f"{part}.png"), alpha)
    check = check + still[..., :3] * alpha[..., None] * 0.65
    report["parts"][part] = round(float(alpha.sum()), 1)
    print(f"[mattes] {part}: {alpha.sum():.0f} px covered", flush=True)

# Every part lit and the rest dimmed, to eyeball against the still.
check_out = oiio.ImageOutput.create(os.path.join(OUTDIR, "check.png"))
check_out.open(os.path.join(OUTDIR, "check.png"), oiio.ImageSpec(RES[0], RES[1], 3, oiio.UINT8))
check_out.write_image((np.clip(check, 0, 1) * 255 + 0.5).astype(np.uint8))
check_out.close()
os.remove(exr)
json.dump(report, open(os.path.join(OUTDIR, "report.json"), "w"), indent=1)
print("[mattes] " + json.dumps(report), flush=True)
