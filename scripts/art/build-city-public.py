"""Public-domain anatomical spectators, adapted from the retained CC0 Blender
Human Base Meshes adult. Static authored poses: no NPC/racing logic or hero edits.
Run with the project's portable Blender; preserve editable source and GLB.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
with bpy.data.libraries.load(str(ROOT/'assets/racecraft/source/human-base-cc0.blend'),link=False) as (a,b): b.objects=['GEO-body_male_realistic']
base=b.objects[0];bpy.context.collection.objects.link(base)
for v in base.data.vertices:v.co.x+=2.2643022537
floor=min(v.co.z for v in base.data.vertices)
for v in base.data.vertices:v.co.z-=floor
def mat(name,c,rough,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
cloth=mat('Public tailored woven fabric',(.15,.27,.32),.86)
skin=mat('Public anatomical skin',(.48,.29,.18),.64)
trousers=mat('Public dark twill',(.035,.052,.066),.9)
hair=mat('Public hair',(.028,.019,.014),.92)
shoe=mat('Public footwear rubber',(.025,.032,.038),.88)
trim=mat('Public garment seams',(.28,.42,.43),.74)
# A retained 512px woven surface, shared by every pose. No per-person textures.
im=bpy.data.images.new('Public woven fabric normal',512,512);pixels=[]
for y in range(512):
 for x in range(512):pixels.extend((.5+.045*math.sin(x*math.pi/2),.5+.045*math.cos(y*math.pi/2),.995,1))
im.pixels=pixels;im.colorspace_settings.name='Non-Color';im.pack()
nt=cloth.node_tree;tx=nt.nodes.new('ShaderNodeTexImage');tx.image=im;normal=nt.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.35;nt.links.new(tx.outputs['Color'],normal.inputs['Color']);nt.links.new(normal.outputs['Normal'],nt.nodes.get('Principled BSDF').inputs['Normal'])
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
original=[v.co.copy() for v in base.data.vertices]
def pose(p,variant):
 q=p.copy();side=1 if p.x>0 else -1
 arm=smooth(.15,.25,abs(p.x))*smooth(.70,.88,p.z)
 raised=variant==1 and side==1 or variant==3 and side==-1
 if raised:
  pivot=Vector((side*.18,0,1.34));r=Matrix.Rotation(-side*math.radians(123),3,'Y');q=q.lerp(pivot+r@(q-pivot),arm)
 else:q.x-=side*.10*arm*max(0,min(1,(1.37-p.z)/.55))
 if variant==2 and p.z<.87:
  pivot=Vector((side*.09,0,.84));a=side*.13*(1-smooth(.67,.88,p.z));q=pivot+Matrix.Rotation(a,3,'X')@(q-pivot)
 return q
roots=[];stats=[]
for variant in range(4):
 root=bpy.data.objects.new(f'spectator-{variant}',None);bpy.context.collection.objects.link(root);roots.append(root)
 o=base.copy();o.data=base.data.copy();o.name=f'Anatomical citizen {variant}';bpy.context.collection.objects.link(o);o.parent=root;o.data.materials.clear()
 for m in [cloth,skin,trousers,hair,shoe]:o.data.materials.append(m)
 for polygon in o.data.polygons:
  center=sum((original[i] for i in polygon.vertices),Vector())/len(polygon.vertices);x,y,z=center
  is_hand=abs(x)>.32 and z<1.04;is_head=z>1.40
  polygon.material_index=1 if is_head or is_hand else 2 if z<.84 else 0
  if z<.115:polygon.material_index=4
  if z>1.565 and (y>-.075 or z>1.635):polygon.material_index=3
  polygon.use_smooth=True
 for v in o.data.vertices:
  p=original[v.index].copy();n=v.normal.copy();z=p.z
  if .13<z<1.38 and not(abs(p.x)>.33 and z<1.05):
   amount=.008+(.007 if .84<z<1.34 else 0);amount+=.0025*math.sin(z*130+p.x*35)*math.exp(-((z-.91)/.09)**2);p+=n*amount
  v.co=pose(p,variant)
 # Preserve facial/anatomical topology; dissolve coplanar redundant garment faces only.
 dec=o.modifiers.new('Retain anatomical silhouette','DECIMATE');dec.ratio=.55
 bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=dec.name)
 # Individually shaped collar, hem, pocket and wristband contours.
 def curve(name,points,radius,material):
  c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=2;c.bevel_depth=radius;c.bevel_resolution=2;s=c.splines.new('POLY');s.points.add(len(points)-1)
  for p,v in zip(s.points,points):p.co=(*v,1)
  a=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(a);a.parent=root;a.data.materials.append(material);return a
 for z,rx,ry in[(.855,.147,.115),(1.39,.065,.067)]:
  curve('Tailored collar / hem',[(rx*math.cos(i*math.tau/40),ry*math.sin(i*math.tau/40),z) for i in range(41)],.006,trim)
 for side in [-1,1]:
  curve('Shirt panel stitching',[pose(Vector((side*x,-y,z)),variant) for x,y,z in[(.12,.112,.91),(.16,.125,1.04),(.19,.105,1.22),(.17,.07,1.34)]],.0028,trim)
  # Curved sole follows a real anatomical foot, not a rectangular shoe.
  curve('Shoe edge seam',[(side*.18+.064*math.cos(i*math.tau/24),-.015+.115*math.sin(i*math.tau/24),.043) for i in range(25)],.008,shoe)
 # Front points -Z after glTF conversion, matching the existing public-space kit.
 root.rotation_euler.z=math.pi
 stats.append({'name':root.name,'triangles':sum(len(p.vertices)-2 for p in o.data.polygons),'pose':['standing','cheering','walking','waving'][variant]})
bpy.data.objects.remove(base,do_unlink=True)
for o in list(bpy.context.scene.objects):
 if o.type=='CURVE':bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
for root in roots:
 for tier,ratio in [('mid',.30),('far',.12)]:
  copy=bpy.data.objects.new(root.name+'__'+tier,None);bpy.context.collection.objects.link(copy);copy.matrix_world=root.matrix_world.copy()
  for child in list(root.children):
   c=child.copy();c.data=child.data.copy();bpy.context.collection.objects.link(c);c.parent=copy;c.matrix_parent_inverse=child.matrix_parent_inverse.copy()
   if c.type=='MESH':
    dec=c.modifiers.new('Subpixel public-space silhouette','DECIMATE');dec.ratio=ratio;bpy.context.view_layer.objects.active=c;bpy.ops.object.modifier_apply(modifier=dec.name)
out=ROOT/'public/models/city-sample';out.mkdir(parents=True,exist_ok=True)
source=ROOT/'assets/city-public';source.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(source/'public-citizens.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'public-citizens.glb'),export_format='GLB',export_yup=True,export_animations=False)
(source/'citizens-stats.json').write_text(json.dumps(stats,indent=2))
print(stats)
