"""Original whole-city engineering kit. Reuses approved CC0/original PBRs.
Editable swept curves, extruded profiles, bevels and weighted normals, not boxes.
Blender --background --factory-startup --python scripts/art/build-city-services.py
"""
from pathlib import Path
import bpy, math, json
path=Path(__file__).with_name('build-city-modules.py')
# Share the already authored surface/UV modelling helpers, without rebuilding
# or overwriting any approved source or binary asset.
exec(compile(path.read_text(encoding='utf-8').split('extension=runpy.run_path')[0],str(path),'exec'))
OUT=ROOT/'public/models/city-sample';roots=[];counts={}
def beam(name,a,b,r=.12,mat=metal):return tube(name,[a,b],r,mat)
def rail(x,z0,z1,h=1.35):
    for y,r in [(h,.055),(.7,.035)]:beam('Brushed rail sweep',(x,y,z0),(x,y,z1),r)
    for z in range(int(z0),int(z1)+1,3):
        beam('Anchored stanchion',(x,.38,z),(x,h,z),.06)
        slab('Bolted rail foot',soft(.17,.17,8,x,z),.32,.40,metal,.015)
def promenade():
    slab('Rebated concrete quay',soft(3.4,8.9,32),.02,.30,stone,.08)
    slab('Composite inset walkway',soft(3.05,8.5,32),.30,.34,dark,.025)
    for z in range(-8,9,2):beam('Paving expansion joint',(-3,.36,z),(3,.36,z),.015,metal)
    rail(-3.12,-8,8);rail(3.12,-8,8)
    for z in [-7,7]:
        tube('Curved quay luminaire',[(2.4,.34,z),(2.4,4.5,z),(1.95,5.8,z),(.8,6.1,z)],.09,metal)
        beam('Recessed strip light',(.8,6.0,z),(1.8,5.85,z),.055,light)
    # Actual recessed maintenance kiosk with curved hood and metal door frame.
    slab('Kiosk service enclosure',soft(.62,1.1,16,1.7,2),.34,1.9,dark,.07)
    slab('Kiosk overhanging lid',soft(.72,1.17,16,1.7,2),1.9,2.03,coat,.05)
    for h in [.65,.95,1.25]:beam('Kiosk cooling louvre',(1.08,h,1.5),(1.08,h,2.5),.035,metal)
    for z in [-4,4]:
        slab('Mooring bollard base',oval(.3,.3,16,-2.5,z),.34,.44,metal,.02)
        tube('Mooring cleat',[(-2.5,.4,z),(-2.5,1,z)],.15,metal)
        beam('Cleat transverse head',(-2.85,.9,z),(-2.15,.9,z),.12,metal)
    beam('Embedded cyan guide',(-2.8,.36,-8),(-2.8,.36,8),.035,light)
def crane():
    slab('Dock crane foundation',soft(7.9,12.3,32),.02,.8,stone)
    for x in [-6,6]:
        slab('Crane runner rail',soft(.35,11.8,12,x),.8,1,metal,.03)
        for z in [-9,9]:
            tube('Tapered portal leg',[(x,1,z),(x,18,z),(x*.8,22,z)],.4,metal)
            for dz in [-2,2]:beam('Portal diagonal bracing',(x,5,z),(x,17,z+dz),.10,amber)
            slab('Gantry wheel cover',soft(.8,1.1,16,x,z),1,2.3,dark)
    for z in [-9,9]:
        beam('Box truss upper chord',(-6,23,z),(6,23,z),.22)
        beam('Box truss lower chord',(-6,21,z),(6,21,z),.22)
        for i in range(6):
            x=-6+i*2;beam('Triangulated gantry web',(x,21,z),(x+2,23,z),.08)
        beam('Gantry bridge length',(-5.5,22,z),(5.5,22,z),.1,amber)
    for x in [-4,4]:beam('Trolley longitudinal rails',(x,23,-10),(x,23,10),.18)
    slab('Hoist rounded carriage',soft(2,2,20,0,-2),23,24,dark)
    for x in [-.8,.8]:beam('Suspended hoist cable',(x,23,-2),(x,15,-2),.045)
    slab('Hoist spreader',soft(3,.5,12,0,-2),14.6,15.2,amber)
    slab('Operator cabin sill',soft(1.8,2,16,5,5),18,18.3,metal)
    shell('Operator cabin glazing',[(18.3,soft(1.5,1.8,16,5,5)),(21.4,soft(1.5,1.8,16,5,5))],glass)
    slab('Cabin curved roof',soft(1.8,2,16,5,5),21.4,21.7,coat)
    for z in [-9,9]:beam('Gantry warning light',(-4,23.3,z),(4,23.3,z),.055,light)
def exchange():
    slab('Plant foundation',soft(4.9,6.9,24),.02,.5,stone)
    for x in [-2,2]:
        slab('Recessed exchanger housing',soft(1.8,4,24,x),.5,6,dark)
        shell('Faceted thermal hood',[(6,soft(1.8,4,24,x)),(8,soft(1.1,3,24,x))],coat)
        for z in [-2,0,2]:
            band('Flanged duct ring',oval(.65,.65,20,x,z),8.1,.09,metal)
            slab('Ventilation cavity',oval(.53,.53,20,x,z),7.95,8.05,dark,0)
            for dx in [-.25,0,.25]:beam('Exhaust grille',(x+dx,8.15,z-.4),(x+dx,8.15,z+.4),.035)
        tube('Looped coolant manifold',[(x,.8,-5),(x,10,-5),(x,11,-3),(x,11,3),(x,10,5),(x,.8,5)],.20,metal)
        for z in [-5,5]:
            band('Manifold joint',oval(.31,.31,16,x,z),2,.09,amber)
            beam('Valve stem',(x,2,z),(x+.5,2,z),.06,amber)
        for z in range(-3,4):beam('Service radiator fin',(x-1.7,2,z),(x-1.7,5,z),.06,metal)
    beam('Status column',(-4,.5,-5),(-4,5,-5),.08,metal)
    beam('Plant status lamp',(-4,4,-5),(-4,5,-5),.07,light)
def transit_link():
    slab('Transit footings',soft(5.9,13.9,32),.02,.55,stone)
    for z in [-10,10]:
        for x in [-4,4]:tube('Branching engineered pier',[(x,.55,z),(x,11,z),(x*.65,13,z)],.3,metal)
    slab('Cantilever transfer deck',soft(5.8,13.5,32),12.5,13.1,coat)
    shell('Open glazed access tube',[(13.1,soft(5,12,32)),(17.2,soft(5,12,32))],silver)
    slab('Stepped transfer roof',soft(5.7,13.1,32),17.2,17.55,coat)
    for z in [-11,-5,1,7,11]:
        tube('Curved facade portal',[(-5,13.1,z),(-5,16.5,z),(-3,18.5,z),(3,18.5,z),(5,16.5,z),(5,13.1,z)],.1,metal)
    for x in [-5,5]:beam('Concourse illuminated edge',(x,13.4,-12),(x,13.4,12),.045,light)
    shell('Entry lift glass',[(.55,soft(1.4,2.3,20)),(12.5,soft(1.4,2.3,20))],glass)
    entrance(4,12,3.5)
for name,fn in [('promenade',promenade),('cargo_crane',crane),('utility_exchange',exchange),('transit_link',transit_link)]:
    active=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(active)
    root=bpy.data.objects.new(name,None);active.objects.link(root);fn()
    for o in list(active.objects):
        if o!=root:o.parent=root
    roots.append(root)
# Promote the exact approved bridge (I-section arches, bearings, ladders and
# rail anchors) into a reusable module, rather than substituting a cheap bridge.
with bpy.data.libraries.load(str(SOURCE/'waterfront-sample.blend'),link=False) as (available,target):
    target.collections=['04_Lumen_Bridge']
bridge=target.collections[0];bpy.context.scene.collection.children.link(bridge)
root=bpy.data.objects.new('waterfront_bridge',None);bridge.objects.link(root)
for o in list(bridge.objects):
    if o==root:continue
    o.parent=root;o.location.y+=20
    if o.data and hasattr(o.data,'materials'):
        for i,m in enumerate(o.data.materials):
            if m and m.name.rsplit('.',1)[-1].isdigit():
                base=m.name.rsplit('.',1)[0]
                if base in bpy.data.materials:o.data.materials[i]=bpy.data.materials[base]
roots.append(root)
for cname,name in [('01_Aster_Curve_Tower','aster_landmark'),('02_Helix_Split_Tower','helix_landmark'),('03_Marina_Atrium','marina_landmark')]:
    with bpy.data.libraries.load(str(SOURCE/'waterfront-sample.blend'),link=False) as (available,target):target.collections=[cname]
    collection=target.collections[0];bpy.context.scene.collection.children.link(collection)
    root=bpy.data.objects.new(name,None);collection.objects.link(root)
    for o in list(collection.objects):
        if o==root:continue
        o.parent=root
        if o.data and hasattr(o.data,'materials'):
            for i,m in enumerate(o.data.materials):
                if m and m.name.rsplit('.',1)[-1].isdigit():
                    base=m.name.rsplit('.',1)[0]
                    if base in bpy.data.materials:o.data.materials[i]=bpy.data.materials[base]
    roots.append(root)
for img in bpy.data.images:
    if img.source=='FILE' and not img.packed_file:img.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'city-services.blend'))
exports=[]
for root in roots:
    parts=[]
    for o in root.children:
        q=o.copy();q.data=o.data.copy();q.parent=None;bpy.context.scene.collection.objects.link(q);parts.append(q)
    bpy.ops.object.select_all(action='DESELECT')
    for q in parts:q.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.convert(target='MESH')
    bymat={}
    for q in parts:bymat.setdefault(q.data.materials[0],[]).append(q)
    root.name+='__source';export=bpy.data.objects.new(root.name.replace('__source',''),None);bpy.context.scene.collection.objects.link(export);exports.append(export)
    for mat,objects in bymat.items():
        bpy.ops.object.select_all(action='DESELECT')
        for q in objects:q.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].parent=export
    counts[export.name]=sum(len(p.vertices)-2 for o in export.children for p in o.data.polygons)
bpy.ops.object.select_all(action='DESELECT')
for root in exports:
    root.select_set(True)
    for o in root.children:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'city-services.glb'),export_format='GLB',use_selection=True,export_yup=True,export_normals=True)
(OUT/'services-manifest.json').write_text(json.dumps({'source':'assets/city-sample/source/city-services.blend','author':'Original project artwork','textures':'Existing sample PBR: original + CC0 ambientCG Metal032/Concrete034','triangles':counts},indent=2),encoding='utf-8')
print('CITY_SERVICES_EXPORTED',counts)
