
import bpy, os, sys, traceback
sc = bpy.context.scene
print("PROBE2 START")
print("resource_path", bpy.utils.resource_path('LOCAL'))
print("view_transform current:", repr(sc.view_settings.view_transform))
try:
    sc.view_settings.view_transform = 'Standard'
    print("set Standard OK ->", repr(sc.view_settings.view_transform))
except Exception as e:
    print("set Standard FAILED", e)
print("display_device", repr(sc.display_settings.display_device))
# engines
for eng in ('BLENDER_EEVEE','CYCLES','BLENDER_WORKBENCH'):
    try:
        sc.render.engine = eng
        print("engine OK:", eng)
    except Exception as e:
        print("engine FAIL:", eng, e)
sc.render.engine = 'BLENDER_EEVEE'

# build tiny scene: emissive plane facing camera, known linear value
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
mat = bpy.data.materials.new("emit"); mat.use_nodes = True
nt = mat.node_tree
for n in list(nt.nodes): nt.nodes.remove(n)
out = nt.nodes.new('ShaderNodeOutputMaterial')
em = nt.nodes.new('ShaderNodeEmission')
em.inputs['Color'].default_value = (0.5, 0.5, 0.5, 1.0)
em.inputs['Strength'].default_value = 1.0
nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
bpy.ops.mesh.primitive_plane_add(size=2, location=(0,0,0))
pl = bpy.context.object
pl.rotation_euler = (1.5707963, 0, 0)
pl.data.materials.append(mat)
cam_data = bpy.data.cameras.new("C"); cam = bpy.data.objects.new("C", cam_data)
bpy.context.collection.objects.link(cam); sc.camera = cam
cam.location = (0, -3, 0); cam.rotation_euler = (1.5707963, 0, 0)
sc.render.resolution_x = 64; sc.render.resolution_y = 64
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'
sc.render.film_transparent = False
outdir = r"C:\Users\caleb\AppData\Local\arcade-hub\_loop\blender\_probe_out"
os.makedirs(outdir, exist_ok=True)

for eng, path in (('BLENDER_EEVEE', 'eevee.png'), ('CYCLES', 'cycles.png')):
    try:
        sc.render.engine = eng
        if eng == 'CYCLES':
            sc.cycles.samples = 8
            sc.cycles.device = 'CPU'
        else:
            sc.eevee.taa_render_samples = 8
        sc.render.filepath = os.path.join(outdir, path)
        bpy.ops.render.render(write_still=True)
        print("RENDER OK", eng, os.path.exists(os.path.join(outdir,path)), os.path.getsize(os.path.join(outdir,path)) if os.path.exists(os.path.join(outdir,path)) else -1)
    except Exception as e:
        print("RENDER FAIL", eng, repr(e))
        traceback.print_exc()
print("PROBE2 END")
