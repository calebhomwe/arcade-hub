"""Render GLB / glTF models as isometric (2:1) sprites: warm golden-hour sun, cool sky fill, real cast shadows, transparent background.
   blender -b --factory-startup --python iso_render.py -- --spec spec.json --out outdir [--ppm 84] [--samples 32]
   spec entries:
     {"name":"barn", "glb":"/abs/barn.glb", "foot":2.6, "yaw":0, "scale":1, "frame":4.6, "shadow":true}
     {"name":"harbour", "parts":[{"glb":"a.glb","x":0,"y":0,"z":0,"yaw":0,"foot":3.0}, ...], "frame":8}
     {"name":"hero", "glb":"char.gltf", "foot":1.0, "action":"Idle", "frame_at":10}     (pose from an embedded animation)
   All sprites share one scale of --ppm pixels per metre so sizes stay comparable. The ground centre of the footprint is the image centre.
   `foot` is the longest horizontal side in metres."""
import argparse, json, math, os, sys
import bpy
from mathutils import Vector

def args():
    ap = argparse.ArgumentParser()
    ap.add_argument('--spec', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--ppm', type=float, default=84); ap.add_argument('--samples', type=int, default=32)
    ap.add_argument('--sun', type=float, default=3.6); ap.add_argument('--sky', type=float, default=0.55)
    ap.add_argument('--elev', type=float, default=30.0); ap.add_argument('--threads', type=int, default=2)
    ap.add_argument('--sunazi', type=float, default=-38.0)
    ap.add_argument('--flat', action='store_true', help='no ground shadow (icons)')
    return ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

def setup(a, frame):
    sc = bpy.context.scene
    size = int(round(frame * a.ppm))
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = a.samples; sc.cycles.use_denoising = True
    try: sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception: pass
    sc.render.threads_mode = 'FIXED'; sc.render.threads = a.threads
    sc.render.resolution_x = size; sc.render.resolution_y = size; sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'AgX'
    try: sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception: pass
    sc.cycles.max_bounces = 4; sc.cycles.diffuse_bounces = 2; sc.cycles.glossy_bounces = 2; sc.cycles.transmission_bounces = 2
    sc.cycles.sample_clamp_indirect = 6
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    nt = w.node_tree; bg = nt.nodes['Background']
    sky = nt.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'NISHITA'; sky.sun_elevation = math.radians(28); sky.sun_rotation = math.radians(225); sky.sun_disc = False; sky.air_density = 1.2; sky.dust_density = 1.5
    nt.links.new(sky.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = a.sky
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
    sun.data.energy = a.sun; sun.data.color = (1.0, 0.80, 0.55); sun.data.angle = math.radians(6)
    sun.rotation_euler = (math.radians(52), 0, math.radians(a.sunazi))
    fill = bpy.data.objects.new('fill', bpy.data.lights.new('fill', 'SUN')); sc.collection.objects.link(fill)
    fill.data.energy = 0.55; fill.data.color = (0.62, 0.74, 1.0); fill.rotation_euler = (math.radians(65), 0, math.radians(140))
    if not a.flat:
        bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0)); g = bpy.context.active_object; g.is_shadow_catcher = True
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = frame
    el = math.radians(a.elev); d = 40
    cam.location = (d * math.cos(el) * 0.7071, -d * math.cos(el) * 0.7071, d * math.sin(el))
    cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.clip_end = 200
    return sc

def bbox(objs):
    """world-space bounding box of the *posed* meshes (skinned models keep their rest-pose bound_box, which is wrong)"""
    dg = bpy.context.evaluated_depsgraph_get()
    lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        if o.type != 'MESH' or o.name.startswith('Icosphere') or o.hide_render: continue
        ev = o.evaluated_get(dg); me = ev.to_mesh()
        mw = ev.matrix_world
        for v in me.vertices:
            p = mw @ v.co
            lo.x = min(lo.x, p.x); lo.y = min(lo.y, p.y); lo.z = min(lo.z, p.z)
            hi.x = max(hi.x, p.x); hi.y = max(hi.y, p.y); hi.z = max(hi.z, p.z)
        ev.to_mesh_clear()
    return lo, hi

def place_part(sc, p, default_foot):
    before = set(bpy.data.objects)
    path = p['glb']
    if path.endswith('.gltf') or path.endswith('.glb'): bpy.ops.import_scene.gltf(filepath=path)
    else: raise SystemExit('unsupported ' + path)
    objs = [o for o in bpy.data.objects if o not in before]
    for o in list(objs):
        if o.type == 'MESH' and o.name.startswith('Icosphere'):
            bpy.data.objects.remove(o, do_unlink=True); objs.remove(o)
    root = bpy.data.objects.new('root', None); sc.collection.objects.link(root)
    for o in objs:
        if o.parent is None or o.parent not in objs: o.parent = root
    # pose from an embedded animation
    if p.get('action'):
        arm = [o for o in objs if o.type == 'ARMATURE']
        if arm:
            act = None
            for ac in bpy.data.actions:
                if ac.name.lower().endswith(p['action'].lower()) or p['action'].lower() in ac.name.lower(): act = ac; break
            if act:
                arm[0].animation_data_create(); arm[0].animation_data.action = act
                sc.frame_set(int(p.get('frame_at', 1)))
    bpy.context.view_layer.update()
    lo, hi = bbox(objs); size = hi - lo
    foot = p.get('foot', default_foot)
    if p.get('height'): k = p['height'] / max(size.z, 0.001) * p.get('scale', 1.0)
    else: k = foot / max(size.x, size.y, 0.001) * p.get('scale', 1.0)
    root.scale = (k, k, k); root.rotation_euler = (0, 0, math.radians(p.get('yaw', 0)))
    bpy.context.view_layer.update()
    lo, hi = bbox(objs); c = (lo + hi) / 2
    root.location = (-c.x + p.get('x', 0), -c.y + p.get('y', 0), -lo.z + p.get('z', 0))
    bpy.context.view_layer.update()
    # Kenney kits ship materials with metallic = 1, which renders as washed-out pastel: make them ordinary painted surfaces
    for o in objs:
        if o.type == 'MESH':
            for m in o.data.materials:
                if m and m.use_nodes:
                    for n in m.node_tree.nodes:
                        if n.type == 'BSDF_PRINCIPLED' and not n.inputs['Metallic'].is_linked and n.inputs['Metallic'].default_value > 0.5 and not p.get('metal'):
                            n.inputs['Metallic'].default_value = 0.0
                            if not n.inputs['Roughness'].is_linked: n.inputs['Roughness'].default_value = 0.65
    if p.get('tint'):
        for o in objs:
            if o.type == 'MESH':
                for m in o.data.materials:
                    if m and m.use_nodes:
                        for n in m.node_tree.nodes:
                            if n.type == 'BSDF_PRINCIPLED':
                                bc = n.inputs['Base Color']; bc.default_value = tuple(x * y for x, y in zip(bc.default_value, list(p['tint']) + [1]))
    return objs

def main():
    a = args(); spec = json.load(open(a.spec)); os.makedirs(a.out, exist_ok=True)
    for s in spec:
        outp = os.path.join(a.out, s['name'] + '.png')
        if os.path.exists(outp) and not os.environ.get('FORCE'): continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        frame = s.get('frame', 4.6)
        sc = setup(a, frame)
        parts = s.get('parts') or [dict(s)]
        for p in parts: place_part(sc, p, s.get('foot', 2.0))
        sc.render.filepath = outp
        bpy.ops.render.render(write_still=True)
        print('rendered', s['name'], flush=True)

main()
