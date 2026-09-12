
import bpy, sys, os, time
print("VERSION", bpy.app.version_string)
print("ENGINES", [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items])
try:
    import numpy; print("NUMPY", numpy.__version__)
except Exception as e:
    print("NUMPY FAIL", e)
print("HAS shade_smooth_by_angle", hasattr(bpy.ops.object, "shade_smooth_by_angle"))
print("HAS shade_auto_smooth", hasattr(bpy.ops.object, "shade_auto_smooth"))
print("HAS shade_smooth", hasattr(bpy.ops.object, "shade_smooth"))
sc = bpy.context.scene
print("EEVEE attrs", [a for a in dir(sc.eevee) if 'sample' in a or 'ray' in a][:20])
print("CYCLES attrs", [a for a in dir(sc.cycles) if 'sample' in a or 'denois' in a][:20])
print("VIEW TRANSFORMS", [i.identifier for i in bpy.types.ColorManagedViewSettings.bl_rna.properties['view_transform'].enum_items])
print("BLEND METHODS", [i.identifier for i in bpy.types.Material.bl_rna.properties['blend_method'].enum_items] if 'blend_method' in bpy.types.Material.bl_rna.properties else "none")
print("CPU COUNT", os.cpu_count())
print("GPU?", end=" ")
try:
    prefs = bpy.context.preferences.addons.get('cycles')
    print("cycles prefs", prefs is not None)
except Exception as e:
    print("err", e)
