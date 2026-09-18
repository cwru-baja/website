"""The portrait (phone) framing plan for the /car sequence, and the harness that
renders and verifies it.

Every leg the page plays runs between two STILLS - a pause, an orbit frame the
canvas stops on, or a seam two legs share. The portrait set keeps every desktop
pose and focal length and only picks, per still, a lens factor K and a lens
shift (see render_profile.py). This script works those out and writes them to
portrait-plan.json, which every render script reads in PROFILE "portrait".

Stills and their subjects - what has to fit, centred, in the 4:5 frame:

  orbit-001    full/0001, head-on          the whole car
  brake-close  000-brake-arc-0030          caliper, rotor, master cylinders
  orbit-032    full/0032 + 031-frame       the frame tubes (the frame beat)
  crane-top    059-crane-up-0030 + 059-drivetrain-top   every drivetrain part
  roll-end     cockpit-roll-0020           the same drivetrain parts, turned
  wheel        cockpit-dive-0040           the steering wheel's face
  corner       108-susp-corner-0024        shocks, wishbones, uprights, hubs
  orbit-109    full/0109                   the whole car
  orbit-120    full/0120, the last frame   the whole car

A pause's parts are measured from its hover mattes (public/renders-sr26/mattes),
which are exactly what can be seen of each part in the desktop still - so a part
hidden behind another, or running out of frame, does not ask for room it never
gets. Brake lines are left out: they run from the master cylinders to every
corner and span 69% of the desktop width; a label on them needs a stretch of
line, not all of it. Everything else is projected vertex by vertex.

A still's largest K is the one that leaves 3% of the frame free on each side
(the subject spans at most 94% of the 4:5 frame both ways), capped at 0.8.

  STAGE    plan (default) | verify | render
  KOPT     render/verify: which option ("k055", "k070", "kvar")
  INV      render: which invocation (see INVOCATIONS)
  ROOT     render/verify: output root; <ROOT>/<KOPT>/{full,layers,...}
  QUALITY  render: preview | final
  PROFILE  verify only: "landscape" dry-runs the desktop invocations instead,
           dumping every render call, to compare against another checkout

Nothing is saved to the .blend.
"""

import bpy, os, sys, json, math, time, types
import numpy as np
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(globals().get(
    "__file__", "/Users/aretelew/Developer/baja/baja-website/v2/artifacts/portrait-plan.py")))
REPO = os.path.dirname(HERE)
STAGE = globals().get("STAGE", "plan")
SCRATCH = globals().get("SCRATCH", "/tmp/portrait-plan-scratch/")
PLAN_OUT = globals().get("PLAN_OUT", os.path.join(HERE, "portrait-plan.json"))
os.makedirs(SCRATCH, exist_ok=True)

MARGIN = 0.03          # of the frame, each side
K_CAP = 0.8
CONSTANT_OPTIONS = {"k055": 0.55, "k070": 0.70}

prof = dict(PROFILE="landscape", HERE=HERE)
exec(open(os.path.join(HERE, "render_profile.py")).read(), prof)
scn = bpy.context.scene

# Every leg the page plays, as the stills it runs between, and whether K may
# change along it:
#   push    the camera travels the whole leg: K must hold, so both ends share one
#   rotate  the camera turns in place (no travel): K may ease with the leg
#   orbit   painted orbit frames: a pure rotation at a constant rate, K may ease
#   tail    K may change only where the leg's own focal ramp does, the stretch
#           where the camera has nearly stopped (cockpit-susp's last third)
LEGS = [
    ("orbit-001", "orbit-032", "orbit", "full/0001-0032"),
    ("orbit-001", "brake-close", "push", "000-brake-arc (+ cover)"),
    ("brake-close", "orbit-032", "push", "brake-exit (+ cover)"),
    ("orbit-032", "crane-top", "push", "059-crane-up"),
    ("crane-top", "roll-end", "rotate", "cockpit-roll"),
    ("roll-end", "wheel", "push", "cockpit-dive"),
    ("wheel", "corner", "tail", "cockpit-susp"),
    ("corner", "orbit-109", "push", "108-susp-corner (+ wheels), played back out"),
    ("orbit-109", "orbit-120", "orbit", "full/0109-0120"),
]
RULE = ("kvar: each still's largest K (3% margin a side, cap 0.8). A push must hold "
        "one K, so every still joined by pushes takes the smallest K among them. K "
        "eases only across orbit frames (linear in frame, as the orbit turns), the "
        "roll (the camera turns in place, on the roll's own easing) and cockpit-susp's "
        "focal ramp (the last stretch, once the camera has nearly stopped). Shift eases "
        "on each leg's own curve. Both are each still's value exactly at every seam.")


def arc_globals(**kw):
    g = dict(QUALITY="preview", N=30, PART_N=18, AZ_END=45.0, EL_END=32.0, PAD=0.26,
             NOSE_PICK="deck", START_BF=1, LEG="in", STAGE="none",
             OUTDIR=SCRATCH, __file__=os.path.join(HERE, "render-brake-arc.py"))
    g.update(kw)
    return g


def matte_extent(pause, parts):
    """Union of the parts' visible pixels in the desktop still: (u0, u1, v0, v1),
    0-1 of the desktop frame, v up."""
    import OpenImageIO as oiio
    u0 = v0 = 1.0; u1 = v1 = 0.0
    for part in parts:
        a = oiio.ImageBuf(os.path.join(REPO, "public/renders-sr26/mattes", pause, part + ".webp")) \
            .get_pixels(oiio.FLOAT)[..., 3]
        H, W = a.shape
        ys, xs = np.where(a > 0.5)
        u0, u1 = min(u0, xs.min() / W), max(u1, (xs.max() + 1) / W)
        v0, v1 = min(v0, 1 - (ys.max() + 1) / H), max(v1, 1 - ys.min() / H)
    return (float(u0), float(u1), float(v0), float(v1))


def verts_extent(M, lens, pts):
    u, v = prof["desk_uv"](M, lens, pts)
    return (float(u.min()), float(u.max()), float(v.min()), float(v.max()))


def rotate_extent(ext, M_from, M_to, lens):
    """A desktop-frame box seen from one camera, re-projected into another at the
    same position (the roll): through the four corners' view rays."""
    u0, u1, v0, v1 = ext
    Rf, Rt = M_from.to_3x3(), M_to.to_3x3()
    us, vs = [], []
    for u in (u0, u1):
        for v in (v0, v1):
            d = Rf @ Vector(((u - 0.5) * 36.0 / lens, (v - 0.5) * prof["DESK_V_MM"] / lens, -1.0))
            c = Rt.transposed() @ d
            us.append(0.5 + (c.x / -c.z) * lens / 36.0)
            vs.append(0.5 + (c.y / -c.z) * lens / prof["DESK_V_MM"])
    return (min(us), max(us), min(vs), max(vs))


def kmax_of(ext):
    u0, u1, v0, v1 = ext
    return min((1 - 2 * MARGIN) * 0.45 / (u1 - u0), (1 - 2 * MARGIN) / (v1 - v0))


def pose_key(M):
    q = M.to_quaternion()
    return [round(c, 5) for c in M.translation] + [round(c, 5) for c in (q @ Vector((0, 0, -1)))]


def make_plan():
    stills = {}
    orbit_cam = scn.camera
    car = prof["world_verts"](prof["car_names"]())
    tubes = prof["world_verts"](["26-FR-TUB Linked Tubes"])

    # the brake closeup and the corner closeup, from their own scripts (nothing renders)
    arc = arc_globals()
    exec(open(os.path.join(HERE, "render-brake-arc.py")).read(), arc)
    corner = dict(STAGE="none", OUTDIR=SCRATCH, __file__=os.path.join(HERE, "render-susp-corner.py"))
    exec(open(os.path.join(HERE, "render-susp-corner.py")).read(), corner)
    crane = dict(ARC="verify", OUTDIR=SCRATCH, __file__=os.path.join(HERE, "render-crane.py"))
    exec(open(os.path.join(HERE, "render-crane.py")).read(), crane)
    dive = dict(STAGE="verify", OUTDIR=SCRATCH, __file__=os.path.join(HERE, "render-dive.py"))
    exec(open(os.path.join(HERE, "render-dive.py")).read(), dive)
    scn.camera = orbit_cam
    lens_orbit = orbit_cam.data.lens

    def add(sid, M, lens, subject, ext, files):
        stills[sid] = dict(files=files, subject=subject, lens=round(lens, 4), pose=pose_key(M),
                           extent=[round(x, 5) for x in ext], kmax=round(kmax_of(ext), 4))

    for bf, files in ((1, "full/0001"), (109, "full/0109"), (120, "full/0120")):
        M = prof["orbit_matrix"](bf, orbit_cam)
        add("orbit-%03d" % bf, M, lens_orbit, "whole car (vertices)", verts_extent(M, lens_orbit, car), files)
    M = prof["orbit_matrix"](32, orbit_cam)
    add("orbit-032", M, lens_orbit, "frame tubes (vertices)", verts_extent(M, lens_orbit, tubes),
        "full/0032, 031-frame")
    stills["orbit-032"]["car_kmax"] = round(kmax_of(verts_extent(M, lens_orbit, car)), 4)

    add("brake-close", arc["pose"](arc["N"] - 1)[0], arc["src_cam"].lens,
        "brakes mattes: caliper, rotor, master-cylinders (not brake-lines)",
        matte_extent("brakes", ["caliper", "rotor", "master-cylinders"]), "000-brake-arc-0030, brake-exit-0001")
    stills["brake-close"]["with_brake_lines_kmax"] = round(kmax_of(
        matte_extent("brakes", ["caliper", "rotor", "master-cylinders", "brake-lines"])), 4)

    DRIVE_PARTS = ["engine", "cvt", "gearbox", "rear-half-shafts", "propshaft", "bevel-box", "dog-clutch",
                   "front-transfer-case", "torque-limiter", "front-hub-and-spindle", "rear-hub-and-spindle"]
    M_top = crane["look_at"](crane["TGT"] + crane["d_top"] * crane["TOP_DIST"], crane["TGT"], crane["TOP_UP"])
    top_ext = matte_extent("drivetrain", DRIVE_PARTS)
    add("crane-top", M_top, lens_orbit, "drivetrain mattes (all 11 parts)", top_ext,
        "059-crane-up-0030, 059-drivetrain-top, cockpit-roll-0001")
    M_roll, lens_roll = dive["roll_pose"](dive["N_ROLL"] - 1)
    add("roll-end", M_roll, lens_roll, "drivetrain mattes, turned with the roll",
        rotate_extent(top_ext, M_top, M_roll, lens_roll), "cockpit-roll-0020, cockpit-dive-0001")

    M_wheel, lens_wheel = dive["dive_pose"](dive["N_DIVE"] - 1)
    sw = prof["world_verts"](["26-FI-SUS-C1-00 Steering Wheel and Column Assem"])
    face = sw[(sw - np.array(dive["CEN"])) @ np.array(dive["E0"]) < 0.12]   # the rim, not the column
    add("wheel", M_wheel, lens_wheel, "steering wheel face (vertices, column cut at 0.12 m)",
        verts_extent(M_wheel, lens_wheel, face), "cockpit-dive-0040, cockpit-susp-0001")

    add("corner", corner["pose"](corner["N"] - 1)[0], corner["src_cam"].lens,
        "suspension mattes (shocks, wishbones, uprights, hubs)",
        matte_extent("suspension", ["shocks", "wishbones", "uprights", "hubs"]),
        "108-susp-corner-0024, cockpit-susp-0040")

    # kvar: pushes join stills into groups that share one K
    parent = {s: s for s in stills}
    def root(s):
        while parent[s] != s: s = parent[s]
        return s
    for a, b, kind, _ in LEGS:
        if kind == "push":
            parent[root(a)] = root(b)
    groups = {}
    for s in stills:
        groups.setdefault(root(s), []).append(s)
    kvar = {}
    for members in groups.values():
        k = min(min(stills[m]["kmax"], K_CAP) for m in members)
        for m in members:
            kvar[m] = round(k, 4)

    options = {}
    for name, fixed in list(CONSTANT_OPTIONS.items()) + [("kvar", None)]:
        opt = {}
        for sid, st in stills.items():
            K = fixed if fixed is not None else kvar[sid]
            shift, span = prof["portrait_fit"](st["extent"], K)
            opt[sid] = dict(K=K, shift=[round(shift[0], 6), round(shift[1], 6)],
                            span=[round(span[0], 4), round(span[1], 4)])
        options[name] = opt
    out = dict(generated="artifacts/portrait-plan.py STAGE=plan - do not edit", margin=MARGIN,
               k_cap=K_CAP, rule=RULE, legs=LEGS, stills=stills,
               kvar_groups=sorted(sorted(m) for m in groups.values()), options=options)
    with open(PLAN_OUT, "w") as f:
        json.dump(out, f, indent=1)
    return out


# ---------- the render invocations the page needs, per option ----------
ORBIT_FRAMES = list(range(1, 33)) + list(range(109, 121))

def invocations(root, kopt, portrait=True):
    """(name, script, globals) for every render call the page's portrait set needs."""
    base = os.path.join(root, kopt) if portrait else root
    full, layers = os.path.join(base, "full/"), os.path.join(base, "layers/")
    arcdir = os.path.join(layers, "brake-arc/")
    P = dict(PROFILE="portrait", KOPT=kopt) if portrait else {}
    return [
        ("orbit", "render-orbit.py", dict(P, FRAMES=ORBIT_FRAMES, OUTDIR=full)),
        ("arc-in", "render-brake-arc.py", arc_globals(**P, STAGE="all", OUTDIR=arcdir)),
        ("arc-out", "render-brake-arc.py", arc_globals(**P, STAGE="all", LEG="out", PART_N=30,
                                                       NAME_BASE="brake-exit-%04d",
                                                       NAME_PART="brake-exit-cover-%04d", OUTDIR=arcdir)),
        ("frame", "render-layers.py", dict(P, STAGE="frame" if portrait else "stills", OUTDIR=layers)),
        ("crane", "render-crane.py", dict(P, ARC="approach", N=30, NAME_UP="059-crane-up-%04d", OUTDIR=layers)),
        ("drive", "render-crane.py", dict(P, ARC="isolate", NAME_ISO="059-drivetrain-top", OUTDIR=layers)),
        ("roll", "render-dive.py", dict(P, STAGE="roll", OUTDIR=layers)),
        ("dive", "render-dive.py", dict(P, STAGE="dive", OUTDIR=layers)),
        ("susp", "render-cockpit-susp.py", dict(P, STAGE="render", N=40, OUTDIR=layers)),
        ("corner", "render-susp-corner.py", dict(P, STAGE="all", OUTDIR=layers)),
    ]


def baseline():
    """What every desktop render ran with. render-crane.py sets none of it itself
    (it was run after the others in one session), so it is set here for all."""
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    try: prefs.get_devices()
    except Exception: pass
    for d in prefs.devices: d.use = (d.type == 'METAL')
    r, cy = scn.render, scn.cycles
    r.engine = 'CYCLES'; cy.device = 'GPU'
    cy.use_adaptive_sampling = True; cy.adaptive_threshold = 0.01
    cy.use_denoising = True; cy.denoiser = 'OPENIMAGEDENOISE'; cy.denoising_prefilter = 'ACCURATE'
    r.use_persistent_data = True; r.use_motion_blur = False; r.film_transparent = True
    scn.display_settings.display_device = 'sRGB'; scn.view_settings.view_transform = 'AgX'
    DARK = {"Rubber Black": 0.035, "Black Rubber": 0.035, "Black 3d Print": 0.035,
            "Black Aluminum": 0.035, "Black Plastic": 0.030, "Black Oxide": 0.030, "Rim": 0.050}
    for mn, val in DARK.items():
        m = bpy.data.materials.get(mn)
        if not m or not m.use_nodes: continue
        for n in m.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED' and not n.inputs['Base Color'].is_linked:
                a = n.inputs['Base Color'].default_value[3]
                n.inputs['Base Color'].default_value = (val, val, val, a)


def run(inv, extra, scripts_dir=HERE):
    name, script, g = inv
    g = dict(g, **extra)
    g["__file__"] = os.path.join(scripts_dir, script)
    exec(open(g["__file__"]).read(), g)
    return g


# ---------- dry run: every render call, captured instead of rendered ----------
CAPTURE = []

def _snap(**kw):
    r, cy = scn.render, scn.cycles
    cam = scn.camera
    M = cam.evaluated_get(bpy.context.evaluated_depsgraph_get()).matrix_world.copy()
    cd = cam.data
    CAPTURE.append(dict(
        file=os.path.relpath(r.filepath, CAPTURE_ROOT) if CAPTURE_ROOT else os.path.basename(r.filepath),
        key=prof["camera_key"](M, cd), matrix=[round(v, 7) for row in M for v in row],
        dof=[cd.dof.use_dof, round(cd.dof.focus_distance, 6), round(cd.dof.aperture_fstop, 6),
             cd.dof.aperture_blades, cd.clip_start],
        res=[r.resolution_x, r.resolution_y, r.resolution_percentage], samples=cy.samples,
        fmt=[r.image_settings.file_format, r.image_settings.color_mode, r.image_settings.quality],
        film=r.film_transparent, tmb=cy.transparent_max_bounces, border=r.use_border,
        objects=sorted((o.name, o.hide_render, o.visible_camera, o.is_holdout)
                       for o in bpy.data.objects if o.type in {'MESH', 'CURVE'} and not o.name.startswith("TMP_CAPTURE")),
        fades=sorted((m.name, round(n.outputs[0].default_value, 6)) for m in bpy.data.materials
                     if m.name.endswith(("__shadowfade", "__splitfade")) for n in m.node_tree.nodes
                     if n.type == 'VALUE'),
        frame=scn.frame_current))
    return {'FINISHED'}

CAPTURE_ROOT = None

def dry_run(invs, extra, scripts_dir=HERE):
    """Run each invocation with bpy.ops.render.render swapped for a recorder."""
    real = bpy.ops.render
    proxy = types.SimpleNamespace(**{n: getattr(real, n) for n in dir(real) if not n.startswith('_')})
    proxy.render = _snap
    bpy.ops.render = proxy
    orbit_cam = scn.camera
    try:
        for inv in invs:
            scn.camera = orbit_cam
            scn.render.resolution_x, scn.render.resolution_y = 1920, 1080
            scn.frame_set(1)
            run(inv, extra, scripts_dir)
    finally:
        del bpy.ops.render
        scn.camera = orbit_cam


SEAMS = [
    ("full/0001", "layers/brake-arc/000-brake-arc-0001"),
    ("layers/brake-arc/000-brake-arc-0030", "layers/brake-arc/brake-exit-0001"),
    ("layers/brake-arc/brake-exit-0030", "full/0032"),
    ("full/0032", "layers/031-frame"),
    ("full/0032", "layers/059-crane-up-0001"),
    ("layers/059-crane-up-0030", "layers/059-drivetrain-top"),
    ("layers/059-drivetrain-top", "layers/cockpit-roll-0001"),
    ("layers/cockpit-roll-0020", "layers/cockpit-dive-0001"),
    ("layers/cockpit-dive-0040", "layers/cockpit-susp-0001"),
    ("layers/cockpit-susp-0040", "layers/108-susp-corner-0024"),
    ("layers/108-susp-corner-0001", "full/0109"),
]
COVERS = ([("layers/brake-arc/000-brake-arc-%04d" % i, "layers/brake-arc/000-brake-cover-%04d" % i) for i in range(1, 19)]
          + [("layers/brake-arc/brake-exit-%04d" % i, "layers/brake-arc/brake-exit-cover-%04d" % i) for i in range(1, 31)]
          + [("layers/108-susp-corner-%04d" % i, "layers/108-susp-corner-wheels-%04d" % i) for i in range(1, 15)])


if STAGE == "plan":
    t0 = time.time()
    out = make_plan()
    print("[plan] wrote %s in %.1fs" % (PLAN_OUT, time.time() - t0))
    for sid, st in out["stills"].items():
        print("[plan] %-12s kmax %.3f  %s" % (sid, st["kmax"], "  ".join(
            "%s K %.3f shift %+.4f %+.4f span %.3f x %.3f" % (o, v[sid]["K"], v[sid]["shift"][0], v[sid]["shift"][1],
                                                            v[sid]["span"][0], v[sid]["span"][1])
            for o, v in out["options"].items())))
    print("[plan] groups", out["kvar_groups"])

elif STAGE == "verify":
    ROOT = globals().get("ROOT", SCRATCH)
    VPROFILE = globals().get("VPROFILE", "portrait")
    SCRIPTS = globals().get("SCRIPTS", HERE)
    if VPROFILE == "landscape":
        # every desktop invocation, dumped for comparison with another checkout's
        CAPTURE_ROOT = None
        invs = invocations(ROOT, "", portrait=False)
        if not os.path.exists(os.path.join(SCRIPTS, "render-orbit.py")):
            invs = [i for i in invs if i[0] != "orbit"]
        dry_run(invs, dict(QUALITY="preview"), SCRIPTS)
        dump = globals().get("DUMP", os.path.join(SCRATCH, "landscape-dump.json"))
        json.dump(CAPTURE, open(dump, "w"), indent=0)
        print("[verify] landscape dump: %d render calls -> %s" % (len(CAPTURE), dump))
    else:
        KOPT = globals()["KOPT"]
        CAPTURE_ROOT = os.path.join(ROOT, KOPT)
        dry_run(invocations(ROOT, KOPT), dict(QUALITY="preview"))
        byfile = {os.path.splitext(c["file"])[0]: c for c in CAPTURE}
        plan = json.load(open(PLAN_OUT))
        res = {"KOPT": KOPT, "files": len(byfile), "seams": {}, "covers_mismatch": []}
        for a, b in SEAMS:
            res["seams"]["%s -> %s" % (a, b)] = prof["seam"](byfile[a]["key"], byfile[b]["key"])
        for a, b in COVERS:
            if prof["seam"](byfile[a]["key"], byfile[b]["key"]) != "MATCH":
                res["covers_mismatch"].append((a, b))
        # each still's K and shift, as rendered, against the plan
        K_of = lambda c: round(prof["DESK_V_MM"] / c["key"][11], 4)
        still_files = {"orbit-001": "full/0001", "brake-close": "layers/brake-arc/000-brake-arc-0030",
                       "orbit-032": "full/0032", "crane-top": "layers/059-drivetrain-top",
                       "roll-end": "layers/cockpit-roll-0020", "wheel": "layers/cockpit-dive-0040",
                       "corner": "layers/108-susp-corner-0024", "orbit-109": "full/0109", "orbit-120": "full/0120"}
        res["stills"] = {}
        for sid, f in still_files.items():
            c = byfile[f]; want = plan["options"][KOPT][sid]
            ok = abs(K_of(c) - want["K"]) < 1e-4 and abs(c["key"][12] - want["shift"][0]) < 1e-5 \
                and abs(c["key"][13] - want["shift"][1]) < 1e-5
            res["stills"][sid] = [K_of(c), c["key"][12], c["key"][13], "MATCH" if ok else "PLAN MISMATCH"]
        # K changes only where the rule allows it: report per file the K steps
        order = (["full/%04d" % b for b in range(1, 33)] +
                 ["layers/059-crane-up-%04d" % i for i in range(1, 31)] +
                 ["layers/cockpit-roll-%04d" % i for i in range(1, 21)] +
                 ["layers/cockpit-dive-%04d" % i for i in range(1, 41)] +
                 ["layers/cockpit-susp-%04d" % i for i in range(1, 41)] +
                 ["layers/108-susp-corner-%04d" % i for i in range(24, 0, -1)] +
                 ["full/%04d" % b for b in range(109, 121)])
        changes = {}
        for p, q in zip(order, order[1:]):
            dk = K_of(byfile[q]) - K_of(byfile[p])
            if abs(dk) > 1e-6:
                leg = q.split("/")[-1].rsplit("-", 1)[0] if "layers" in q else "orbit"
                changes.setdefault(leg, []).append(round(dk, 4))
        res["k_changes_by_leg"] = {k: [len(v), round(sum(v), 4)] for k, v in changes.items()}
        arcK = {K_of(byfile["layers/brake-arc/%s-%04d" % (p, i)]) for p in ("000-brake-arc", "brake-exit")
                for i in range(1, 31)}
        res["brake_arc_K_values"] = sorted(arcK)
        # what clips: the whole car on orbit frames and the crane, each still's subject
        car = prof["world_verts"](prof["car_names"]())[::5]
        clip = {}
        for f in ["full/%04d" % b for b in ORBIT_FRAMES] + ["layers/059-crane-up-%04d" % i for i in range(1, 31)]:
            c = byfile[f]
            M = Matrix([c["matrix"][0:4], c["matrix"][4:8], c["matrix"][8:12], c["matrix"][12:16]])
            K, sx, sy = K_of(c), c["key"][12], c["key"][13]
            u, v = prof["desk_uv"](M, c["key"][9], car)
            up = 0.5 + (u - 0.5) * K / 0.45 - sx * 1.25
            vp = 0.5 + (v - 0.5) * K - sy
            over = [max(0.0, -up.min()), max(0.0, up.max() - 1), max(0.0, -vp.min()), max(0.0, vp.max() - 1)]
            if max(over) > 0.002:
                clip[f] = [round(x, 3) for x in over]
        res["car_clipped (left,right,bottom,top of frame)"] = clip
        res["subject_span_over_1"] = {sid: v["span"] for sid, v in plan["options"][KOPT].items()
                                      if max(v["span"]) > 1.0}
        out = os.path.join(SCRATCH, "verify-%s.json" % KOPT)
        json.dump(res, open(out, "w"), indent=1)
        print("[verify] %s: %d files; seams %s; covers mismatched %d; stills %s -> %s" % (
            KOPT, len(byfile), sorted(set(v if isinstance(v, str) else "FAIL" for v in res["seams"].values())),
            len(res["covers_mismatch"]),
            sorted(set(v[3] for v in res["stills"].values())), out))

elif STAGE == "render":
    ROOT = globals()["ROOT"]
    KOPT = globals()["KOPT"]
    INV = globals()["INV"]
    inv = [i for i in invocations(ROOT, KOPT) if i[0] == INV][0]
    baseline()
    t0 = time.time()
    run(inv, dict(QUALITY=globals().get("QUALITY", "preview"),
                  PREVIEW_SPP=globals().get("PREVIEW_SPP", 32)))
    print("[render] %s %s done in %.1fs" % (KOPT, INV, time.time() - t0), flush=True)
