import bpy, os
from mathutils import Vector, Matrix
import numpy as np

STAGE = globals().get("STAGE", "all")
scn = bpy.context.scene
r, cy = scn.render, scn.cycles
OUT = "/Users/aretelew/Developer/baja/baja-website/v2/public/renders-sr26/layers/"
os.makedirs(OUT, exist_ok=True)

# ---------- FIX A (idempotent, same as the orbit pass) ----------
DARK = {"Rubber Black":0.035,"Black Rubber":0.035,"Black 3d Print":0.035,
        "Black Aluminum":0.035,"Black Plastic":0.030,"Black Oxide":0.030,"Rim":0.050}
for mn, val in DARK.items():
    m = bpy.data.materials.get(mn)
    if not m or not m.use_nodes: continue
    for n in m.node_tree.nodes:
        if n.type=='BSDF_PRINCIPLED' and not n.inputs['Base Color'].is_linked:
            a = n.inputs['Base Color'].default_value[3]
            n.inputs['Base Color'].default_value = (val,val,val,a)

# ---------- render settings identical to the orbit pass ----------
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='METAL'
try: prefs.get_devices()
except Exception: pass
for d in prefs.devices: d.use = (d.type=='METAL')
r.engine='CYCLES'; cy.device='GPU'
cy.samples=256; cy.use_adaptive_sampling=True; cy.adaptive_threshold=0.01
cy.use_denoising=True; cy.denoiser='OPENIMAGEDENOISE'; cy.denoising_prefilter='ACCURATE'
r.use_persistent_data=True; r.use_motion_blur=False; r.film_transparent=True
r.resolution_x, r.resolution_y, r.resolution_percentage = 1920,1080,100
r.image_settings.file_format='WEBP'; r.image_settings.color_mode='RGBA'; r.image_settings.quality=80
scn.display_settings.display_device='sRGB'
scn.view_settings.view_transform='AgX'

MESHY={'MESH','CURVE','SURFACE','META','FONT','GPENCIL'}
def meshes(): return [o for o in bpy.data.objects if o.type in MESHY]
def reset():
    for o in meshes():
        o.hide_render=False; o.is_holdout=False
        # the studio rig lights the scene but must never face camera
        o.visible_camera = not o.name.startswith("Plane")
def shoot(name):
    r.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print("[layer] %s" % name, flush=True)

def isolate(names, frame, out, occlude=False):
    reset(); scn.frame_set(frame)
    for o in meshes():
        if o.name.startswith("Plane"):
            o.hide_render=False; o.is_holdout=False       # studio light rig
        elif o.name in names:
            o.hide_render=False; o.is_holdout=False      # studio light rig
        else:
            o.hide_render = not occlude
            o.is_holdout = occlude
    shoot(out)

def without(names, frame, out):
    """Render the car with `names` taken out of view.

    They are hidden from CAMERA rays only, not deleted from the render. Big black
    tires absorb and block a lot of light, so hide_render would let the hubs and
    arm ends they shroud jump brighter the moment the part layer dissolves - the
    lighting has to stay put while only the geometry goes away.
    """
    reset(); scn.frame_set(frame)
    for o in meshes():
        if o.name.startswith("Plane"): continue
        o.visible_camera = o.name not in names
    shoot(out)
    reset()

def without_lit(names, frame, out):
    """The companion to without(): same frame, same parts missing, but dropped
    from the render entirely rather than only hidden from camera.

    without() keeps the tires blocking light so the handover from the canvas is
    invisible, which is right at the instant of the swap and wrong a moment
    later - the hubs and arm ends stay shrouded by wheels that are no longer
    there to shroud them. This renders the other end of that: the same view lit
    as if the wheels had never been in it. The site holds the without() render
    at the swap and cross-fades to this one as the part blurs off, so the
    lighting opens up on the same scroll instead of stepping.
    """
    reset(); scn.frame_set(frame)
    for o in meshes():
        if o.name in names: o.hide_render = True
    shoot(out)
    reset()

# The site indexes the orbit 0-based: frameUrl(i) resolves to (i+1).webp, so a
# chapter pauseFrame of N paints Blender frame N+1. Layer files stay named after
# the pauseFrame so they match CAR_REVEALS, but they have to be RENDERED one
# Blender frame later or they sit ~3 degrees of orbit off the canvas.
def bf(pause_frame): return pause_frame + 1

WHEELS  = {"DWT_A514-429M","Right_side_front_wheel",
           "23InchRearV2","23InchRearV2.001","ScanBasedRom","ScanBasedRom.001"}
FRAME   = {"26-FR-TUB Linked Tubes"}
# The U-joint hardware carries vendor part numbers rather than the -DRT- tag,
# so the name filter skipped it and every yoke rendered with an empty bore
# where the cross (the "spider") and its four bearing caps belong.
UJOINT  = {o.name for o in meshes() if o.name.startswith(
           ("SDH-5-170X_CROSS", "SDH-5-170X_CAP",
            "Mock_MOOG405_Spider", "Mock_MOOG405_Cap"))}
# The +X half of the front inboard linkage - yoke cup, cup tabs, inboard yoke -
# came in from CAD under generic Node_* names, while its -X mirror kept proper
# -DRT- part numbers. The name filter dropped it, so the right-hand front shaft
# rendered floating, disconnected from the torque limiter case. Listed explicitly
# rather than by a Node_* prefix: that prefix is a grab-bag in this file and also
# covers throttle and upright parts that must stay out of the drivetrain view.
LINK    = {"Node_1","Node_641","Node_643","Node_645","Node_647","Node_649",
           "Node_651","Node_653","Node_655","Node_657","Node_7325"}
DRIVE   = ({o.name for o in meshes() if "-DRT-" in o.name or "_DRT_" in o.name}
           | UJOINT | LINK | {"26-KOHLER ENGINE_step", "Outboard Yoke Spacer"})
STEER   = "26-FI-SUS-C1-00 Steering Wheel and Column Assem"

if STAGE in ("all", "stills", "drivetrain", "suspension"):
    if STAGE in ("all", "stills"):
        # The brakes beat dollies into a closeup rather than dissolving the tire
        # from 6m out, so its base and part are sequences now - see
        # artifacts/render-brake-push.py. The stills this used to write are the
        # first frame of each of those.
        isolate(FRAME,  bf(31),  "031-frame")
    if STAGE in ("all", "stills", "suspension"):
        # The suspension beat reads from the rear view, one frame after the crane
        # sets the camera back down on the orbit.
        without(WHEELS,     bf(59), "059-susp-base")
        without_lit(WHEELS, bf(59), "059-susp-lit")
        isolate(WHEELS,     bf(59), "059-susp-wheels", occlude=True)
    # The drivetrain is now revealed from overhead by the crane beat, so its
    # rear-view isolate is rendered by artifacts/render-crane.py instead.

if STAGE.startswith("steer") or STAGE == "all":
    E0  = Vector((0.0011,0.9729,-0.2312)).normalized()
    E1  = Vector((-0.0002,0.2312,0.9729)).normalized()
    CEN = Vector((-0.0002,0.439,0.4752)); D=1.0; CUT=0.12
    sw  = bpy.data.objects[STEER]
    me  = sw.data; nv = len(me.vertices)
    co  = np.empty(nv*3); me.vertices.foreach_get("co", co); co=co.reshape(nv,3)
    mw  = np.array(sw.matrix_world.to_4x4())
    world = (co @ mw[:3,:3].T) + mw[:3,3]
    t = (world - np.array(CEN)) @ np.array(E0)
    col_idx = np.where(t >= CUT)[0].tolist()          # column verts -> masked out

    old = bpy.data.objects.get("TMP_WHEELDISC")
    if old: bpy.data.objects.remove(old, do_unlink=True)
    tmp = sw.copy(); tmp.data = sw.data.copy(); tmp.name = "TMP_WHEELDISC"
    for c in sw.users_collection: c.objects.link(tmp)
    tmp.matrix_world = sw.matrix_world.copy()
    vg = tmp.vertex_groups.new(name="COLUMN"); vg.add(col_idx, 1.0, 'REPLACE')
    mod = tmp.modifiers.new("DropColumn", 'MASK'); mod.vertex_group="COLUMN"; mod.invert_vertex_group=True

    # The fly-out parks the wheel 1m from a 70mm f/2.8 camera that is focused on
    # the bodywork ~6.3m away - a ~79px circle of confusion, which is why the hero
    # frames came back unreadably soft. These frames contain nothing but the wheel,
    # so depth of field buys no separation here; switch it off and restore after.
    cam_data = scn.camera.data
    dof_was = cam_data.dof.use_dof
    cam_data.dof.use_dof = False

    reset(); scn.frame_set(bf(76)); bpy.context.view_layer.update()
    cmw  = scn.camera.evaluated_get(bpy.context.evaluated_depsgraph_get()).matrix_world.copy()
    cpos = cmw.translation.copy()
    cfwd = (cmw.to_quaternion() @ Vector((0,0,-1))).normalized()
    cup  = (cmw.to_quaternion() @ Vector((0,1,0))).normalized()
    src_n=(-E0).normalized(); src_u=E1.normalized()
    src_r=src_u.cross(src_n).normalized(); src_u=src_n.cross(src_r).normalized()
    tgt_n=(-cfwd).normalized(); tgt_u=cup.normalized()
    tgt_r=tgt_u.cross(tgt_n).normalized(); tgt_u=tgt_n.cross(tgt_r).normalized()
    S=Matrix(((src_r.x,src_u.x,src_n.x),(src_r.y,src_u.y,src_n.y),(src_r.z,src_u.z,src_n.z)))
    T=Matrix(((tgt_r.x,tgt_u.x,tgt_n.x),(tgt_r.y,tgt_u.y,tgt_n.y),(tgt_r.z,tgt_u.z,tgt_n.z)))
    R=(T @ S.inverted()).to_4x4()
    start = tmp.matrix_world.copy()
    target = Matrix.Translation(cpos+cfwd*D) @ R @ Matrix.Translation(-CEN) @ start
    l0,q0,s0 = start.decompose(); l1,q1,s1 = target.decompose()

    for o in meshes():
        o.hide_render = (o.name != "TMP_WHEELDISC") and not o.name.startswith("Plane")
        o.is_holdout = False

    # The world background is black (strength 0), so these Plane emitters are the
    # only light in the scene and they sit 2.7-4.7m around the car. The wheel flies
    # 5.6m out toward the camera, clean out of that volume, and lands less than half
    # as bright as it started. Carry the rig along on the same translation so it
    # stays lit the way it is in the car. Translation only, never rotation - the
    # wheel turns to face the viewer and the shading should respond to that.
    RIG = [(o, o.matrix_world.copy()) for o in meshes() if o.name.startswith("Plane")]
    CEN_local = start.inverted() @ CEN
    N=18
    rng = range(N) if STAGE in ("all","steer") else (range(0,9) if STAGE=="steer_a" else range(9,18))
    try:
        for i in rng:
            x=i/(N-1); te=x*x*(3-2*x)
            tmp.matrix_world = Matrix.LocRotScale(l0.lerp(l1,te), q0.slerp(q1,te), s0.lerp(s1,te))
            delta = (tmp.matrix_world @ CEN_local) - CEN
            for pl, m0 in RIG:
                m = m0.copy(); m.translation = m0.translation + delta; pl.matrix_world = m
            bpy.context.view_layer.update()
            shoot("076-steering-%04d" % (i+1))
    finally:
        for pl, m0 in RIG:
            pl.matrix_world = m0.copy()
        cam_data.dof.use_dof = dof_was
        bpy.data.objects.remove(tmp, do_unlink=True)

reset(); scn.frame_set(1)
print("[layer] STAGE %s DONE" % STAGE, flush=True)
