"""Adapt CC0 Innerscene PWC + Blender Studio realistic human. Blender 4.5 LTS.
No gameplay changes. All modeling coordinates in this script are game Y-up.
"""
import bpy,math,json,numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
R=Path(__file__).resolve().parents[2];S=R/'assets/racecraft/source';O=R/'public/models'
def B(p):return Vector((p[0],-p[2],p[1]))
def G(p):return Vector((p[0],p[2],-p[1]))
def select(objects):
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.hide_set(False);o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
def mat(name,color,metal=0,rough=.5):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
def smooth(o):
 for p in o.data.polygons:p.use_smooth=True
 return o
def tube(name,points,r,material,sides=8):
 curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=12;curve.bevel_depth=r;curve.bevel_resolution=2
 sp=curve.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for q,p in zip(sp.bezier_points,points):q.co=B(p);q.handle_left_type=q.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o);o.data.materials.append(material)
 select([o]);bpy.ops.object.convert(target='MESH');return smooth(bpy.context.object)
def sphere(name,p,scale,material,segments=24,rings=16):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=B(p));o=bpy.context.object;o.name=name;o.scale=(scale[0],scale[2],scale[1]);select([o]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material);return smooth(o)
def empty(name,p):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=B(p);return o
def export(path,objects):
 select(objects);bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_skins=True,export_all_influences=False,export_materials='EXPORT')
def stats(objects):return {'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects if o.type=='MESH'),'draws':sum(max(1,len(o.data.materials)) for o in objects if o.type=='MESH')}
manifest=[]

# PWC: retain continuous closed hull and distinct saddle, wells, pump hardware.
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(S/'pwc-cc0.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];rotation=Matrix.Rotation(-math.pi/2,4,'Z');scale=Matrix.Diagonal((1.18,1.18,1.18,1))
for o in meshes:
 o.data.transform(scale@rotation@o.matrix_world);o.parent=None;o.matrix_world=Matrix.Identity(4)
for o in list(bpy.context.scene.objects):
 if o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True)
for m in bpy.data.materials:
 if not m.use_nodes:continue
 p=m.node_tree.nodes.get('Principled BSDF')
 if not p:continue
 if 'teal enamel' in m.name:
  m.name='Paint';p.inputs['Metallic'].default_value=.24;p.inputs['Roughness'].default_value=.26;p.inputs['Coat Weight'].default_value=.38;p.inputs['Coat Roughness'].default_value=.18
  # Neutralize the supplied teal image so player and AI palettes tint the same paint.
  for n in m.node_tree.nodes:
   if n.type=='TEX_IMAGE' and n.image:
    im=n.image;a=np.array(im.pixels[:],dtype=np.float32).reshape(-1,4);lum=a[:,:3].mean(axis=1);a[:,:3]=np.clip(lum[:,None]*.28+.72,0,1);im.pixels.foreach_set(a.ravel());im.pack()
 elif 'white marine' in m.name:
  m.name='Pearl silver gelcoat';p.inputs['Metallic'].default_value=.12;p.inputs['Roughness'].default_value=.32;p.inputs['Coat Weight'].default_value=.2
 elif 'polished steel' in m.name:p.inputs['Roughness'].default_value=.27
 elif 'clear glazing' in m.name:
  p.inputs['Transmission Weight'].default_value=0;p.inputs['Roughness'].default_value=.14;p.inputs['Base Color'].default_value=(.025,.075,.11,1)
 for n in m.node_tree.nodes:
  if n.type=='TEX_IMAGE' and n.image and max(n.image.size)>512:n.image.scale(512,512);n.image.pack()
glow=mat('Navigation light',(.06,.65,.8),.15,.28);glow.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(.03,.5,.7,1);glow.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=.7
display=mat('Digital marine instrument',(.025,.06,.075),.1,.25)
N=256;y,x=np.mgrid[:N,:N];radius=np.hypot(x-128,y-128);angle=np.arctan2(y-128,x-128);rgba=np.ones((N,N,4),np.float32);rgba[:,:,:3]=(.012,.03,.045)
ring=(radius>89)&(radius<98)&(angle<2.4);rgba[ring,:3]=(.10,.72,.83)
for i in range(5):rgba[107+i*10:112+i*10,75:178-i*10,:3]=(.19,.57,.68)
image=bpy.data.images.new('Original digital instrument',width=N,height=N);image.pixels.foreach_set(rgba.ravel());image.pack();n=display.node_tree.nodes.new('ShaderNodeTexImage');n.image=image;display.node_tree.links.new(n.outputs['Color'],display.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
for o in meshes:
 if 'recessed instrument face' in o.name or 'finite instrument lens' in o.name:
  o.data.materials.clear();o.data.materials.append(display)
  points=[G(v.co) for v in o.data.vertices];xmin=min(p.x for p in points);xmax=max(p.x for p in points);zmin=min(p.z for p in points);zmax=max(p.z for p in points)
  uv=o.data.uv_layers.active or o.data.uv_layers.new(name='Instrument face UV')
  for loop in o.data.loops:
   p=points[loop.vertex_index];uv.data[loop.index].uv=((p.x-xmin)/max(.001,xmax-xmin),(p.z-zmin)/max(.001,zmax-zmin))
for side in [-1,1]:
 meshes.append(tube('Inset navigation ribbon',[(side*.63,.556,-.80),(side*.64,.556,-.30),(side*.57,.556,.35)],.007,glow))
# Model-space mount metadata; sizes stay inside the original capsule's visual envelope.
grips=[]
for o in meshes:
 if 'handgrip' in o.name:
  vs=[G(o.matrix_world@v.co) for v in o.data.vertices];grips.append(sum(vs,Vector())/len(vs))
grips.sort(key=lambda p:p.x)
sockets=[empty('RiderSeat',(0,1.10,-.10)),empty('Grip_L',grips[0]),empty('Grip_R',grips[1]),empty('Foot_L',(-.50,.541,-.06)),empty('Foot_R',(.50,.541,-.06))]
sockets.append(empty('JetOutlet',(0,.28,-2.12)))
# Merge by shared material, retaining editable original named parts in the .blend below.
bpy.ops.wm.save_as_mainfile(filepath=str(S/'racecraft.blend'),compress=True)
batches=[];material_groups={m:[o for o in meshes if m in o.data.materials[:]] for m in {m for o in meshes for m in o.data.materials}}
for material,objects in material_groups.items():
 select(objects)
 if len(objects)>1:bpy.ops.object.join()
 o=bpy.context.object;o.name='PWC_'+material.name.replace(' ','_');batches.append(o)
for o in batches:
 select([o]);d=o.modifiers.new('Game surface budget','DECIMATE');d.ratio=.58;d.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=d.name)
export(O/'watercraft.glb',batches+sockets);manifest.append({'file':'public/models/watercraft.glb',**stats(batches)})
for o in batches:
 select([o]);d=o.modifiers.new('AI and mobile surface reduction','DECIMATE');d.ratio=.42;d.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=d.name)
for image in bpy.data.images:
 if max(image.size)>256:image.scale(256,256);image.pack()
export(O/'watercraft-low.glb',batches+sockets);manifest.append({'file':'public/models/watercraft-low.glb',**stats(batches)})
grip_local=[list(p-Vector((0,1.10,-.10))) for p in grips]

# Human: pose and skin the actual anatomical CC0 base, rather than a new capsule figure.
bpy.ops.wm.open_mainfile(filepath=str(S/'human-base-cc0.blend'));body=bpy.data.objects['GEO-body_male_realistic'];body.name='Tailored_neoprene_suit'
body.data.materials.clear();body.vertex_groups.clear();center=-2.2643022537231445
for v in body.data.vertices:v.co.x-=center
for m in list(body.modifiers):body.modifiers.remove(m)
# Remove the unneeded uncovered head; helmet seals above the neck.
import bmesh
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z>1.46 or v.co.z<.11],context='VERTS');bm.to_mesh(body.data);bm.free()
fabric=mat('Woven racing textile',(.018,.032,.05),0,.78);blue=mat('Flexible blue suit panels',(.025,.16,.28),.06,.57);dark=mat('Rubber gloves and boots',(.018,.023,.03),0,.85);seam=mat('Reflective seam tape',(.47,.56,.59),.2,.49);shell=mat('Helmet pearl composite',(.52,.62,.68),.24,.32);visor=mat('Smoked polycarbonate visor',(.014,.052,.075),.18,.16)
# Packed original 256px weave normal and varying roughness, embedded in GLB.
N=256;y,x=np.mgrid[:N,:N];weave=np.sin(x*np.pi/2)*np.sin(y*np.pi/2);rng=np.random.default_rng(714)
for typ in ['normal','roughness']:
 im=bpy.data.images.new('Original suit '+typ,width=N,height=N);im.colorspace_settings.name='Non-Color';arr=np.ones((N,N,4),np.float32)
 if typ=='normal':arr[:,:,0]=.5+weave*.09;arr[:,:,1]=.5+np.cos(x*np.pi/2)*.06;arr[:,:,2]=.99
 else:arr[:,:,:3]=np.clip(.72+weave[:,:,None]*.05+rng.normal(0,.02,(N,N,1)),.5,.9)
 im.pixels.foreach_set(arr.ravel());im.pack()
 for m in [fabric,blue,dark]:
  nt=m.node_tree;n=nt.nodes.new('ShaderNodeTexImage');n.image=im
  if typ=='normal':q=nt.nodes.new('ShaderNodeNormalMap');q.inputs['Strength'].default_value=.32;nt.links.new(n.outputs['Color'],q.inputs['Color']);nt.links.new(q.outputs['Normal'],nt.nodes.get('Principled BSDF').inputs['Normal'])
  else:nt.links.new(n.outputs['Color'],nt.nodes.get('Principled BSDF').inputs['Roughness'])
for m in [fabric,blue,dark]:body.data.materials.append(m)
rest={};pose={};parents={}
def bone(name,a,b,pa=None):rest[name]=(Vector(a),Vector(b));parents[name]=pa
bone('Pelvis',(0,0,.86),(0,0,.99));bone('RiderTorso',(0,0,.99),(0,0,1.35),'Pelvis');bone('Neck',(0,0,1.35),(0,0,1.48),'RiderTorso')
pose['Pelvis']=(Vector((0,-.07,0)),Vector((0,.06,.04)));pose['RiderTorso']=(Vector((0,.06,.04)),Vector((0,.46,.25)));pose['Neck']=(Vector((0,.46,.25)),Vector((0,.59,.30)))
def elbow(a,b,l1=.31,l2=.29,side=1):
 delta=b-a;length=min(delta.length,l1+l2-.001);axis=delta.normalized();along=(length*length+l1*l1-l2*l2)/(2*length);bend=Vector((side,.05,-.15));bend=(bend-axis*bend.dot(axis)).normalized();return a+axis*along+bend*math.sqrt(max(0,l1*l1-along*along))
for i,side in enumerate([-1,1]):
 suffix=str(side);shoulder=Vector((side*.205,.46,.25));hand=Vector(grip_local[i]);e=elbow(shoulder,hand,side=side)
 bone('UpperArm_'+suffix,(side*.18,0,1.35),(side*.30,.018,1.11),'RiderTorso');bone('Forearm_'+suffix,(side*.30,.018,1.11),(side*.405,.005,.89),'UpperArm_'+suffix);bone('Hand_'+suffix,(side*.405,.005,.89),(side*.43,-.01,.78),'Forearm_'+suffix)
 pose['UpperArm_'+suffix]=(shoulder,e);pose['Forearm_'+suffix]=(e,hand);pose['Hand_'+suffix]=(hand,hand+Vector((0,-.035,.045)))
 bone('Thigh_'+suffix,(side*.095,0,.88),(side*.105,.025,.49),'Pelvis');bone('Shin_'+suffix,(side*.105,.025,.49),(side*.10,.04,.10),'Thigh_'+suffix);bone('Foot_'+suffix,(side*.10,.04,.10),(side*.1,-.12,.035),'Shin_'+suffix)
 pose['Thigh_'+suffix]=(Vector((side*.12,-.04,.00)),Vector((side*.38,-.23,.30)));pose['Shin_'+suffix]=(Vector((side*.38,-.23,.30)),Vector((side*.50,-.47,-.08)));pose['Foot_'+suffix]=(Vector((side*.50,-.47,-.08)),Vector((side*.50,-.52,.14)))
def weights(p):
 x,y,z=p;s='-1' if x<0 else '1';ax=abs(x)
 def blend(a,b,t):t=max(0,min(1,t));return {a:1-t,b:t}
 if ax>.17+max(0,1.30-z)*.26 and z>.70:
  if z<.94:return blend('Hand_'+s,'Forearm_'+s,(z-.83)/.11)
  return blend('Forearm_'+s,'UpperArm_'+s,(z-1.06)/.12)
 if z<.91:
  if z<.16:return blend('Foot_'+s,'Shin_'+s,(z-.09)/.08)
  if z<.56:return blend('Shin_'+s,'Thigh_'+s,(z-.43)/.13)
  return blend('Thigh_'+s,'Pelvis',(z-.80)/.14)
 if z>1.34:return blend('RiderTorso','Neck',(z-1.34)/.10)
 return blend('Pelvis','RiderTorso',(z-.96)/.16)
def transform(p,w):
 result=Vector()
 for n,weight in w.items():
  a,b=rest[n];c,d=pose[n];axis=(b-a).normalized();q=axis.rotation_difference((d-c).normalized());v=p-a;u=v.dot(axis);result+=(c+q@(v-axis*u)*1.08+(d-c)*(u/(b-a).length))*weight
 return result
# Native bone-heat weights give continuous shoulder/hip transitions on the actual base.
ad=bpy.data.armatures.new('Temporary anatomical bind');ar=bpy.data.objects.new('Temporary anatomical bind',ad);bpy.context.collection.objects.link(ar);select([ar]);bpy.ops.object.mode_set(mode='EDIT')
for n,(a,b) in rest.items():e=ad.edit_bones.new(n);e.head=a;e.tail=b
for n,pa in parents.items():
 if pa:ad.edit_bones[n].parent=ad.edit_bones[pa]
bpy.ops.object.mode_set(mode='OBJECT');select([body,ar]);bpy.context.view_layer.objects.active=ar;bpy.ops.object.parent_set(type='ARMATURE_AUTO')
auto_weights=[{body.vertex_groups[g.group].name:g.weight for g in v.groups if g.weight>0} for v in body.data.vertices]
body.parent=None
for m in list(body.modifiers):body.modifiers.remove(m)
bpy.data.objects.remove(ar,do_unlink=True)
allweights=[]
for v in body.data.vertices:
 p=v.co.copy();p.y=max(p.y,-.135) if p.z<1.04 else p.y;w=auto_weights[v.index] or weights(p);total=sum(w.values());w={n:q/total for n,q in w.items()};allweights.append(w);posed=transform(p,w)
 if p.z<.15:posed.y=max(-.55,min(-.46,posed.y));posed.z=max(-.12,min(.15,posed.z))
 v.co=B(posed)
body.vertex_groups.clear()
for name in rest:body.vertex_groups.new(name=name)
for i,w in enumerate(allweights):
 for n,value in w.items():
  if value>0:body.vertex_groups[n].add([i],value,'REPLACE')
for p in body.data.polygons:
 pos=sum((G(body.data.vertices[i].co) for i in p.vertices),Vector())/len(p.vertices)
 p.material_index=2 if pos.y<-.5 or (abs(pos.x)>.32 and pos.y<.28) else 0;p.use_smooth=True
rig_data=bpy.data.armatures.new('Racer anatomical skeleton');rig=bpy.data.objects.new('RaceRig',rig_data);bpy.context.collection.objects.link(rig);select([rig]);bpy.ops.object.mode_set(mode='EDIT')
for n,(a,b) in pose.items():e=rig.data.edit_bones.new(n);e.head=B(a);e.tail=B(b)
for n,pa in parents.items():
 if pa:rig.data.edit_bones[n].parent=rig.data.edit_bones[pa]
bpy.ops.object.mode_set(mode='OBJECT');mod=body.modifiers.new('Continuous anatomical deformation','ARMATURE');mod.object=rig;body.parent=rig
def attach(o,bone_name):
 # Skin rigid accessories using the same bind skeleton, retaining their authored coordinates.
 vg=o.vertex_groups.new(name=bone_name);vg.add(list(range(len(o.data.vertices))),1,'REPLACE');mod=o.modifiers.new('Racer equipment rig','ARMATURE');mod.object=rig;o.parent=rig;return o
equipment=[]
# Helmet is a closed contoured shell with chin bar, separate visor, seals and vents.
equipment.append(attach(sphere('Contoured full-face helmet',(0,.755,.315),(.126,.157,.153),shell,40,24),'Neck'))
equipment.append(attach(sphere('Chin guard',(0,.68,.411),(.109,.067,.091),shell),'Neck'))
equipment.append(attach(tube('Continuous neck seal',[(0,.53,.28),(0,.63,.30)],.074,dark),'Neck'))
# Visor patch follows the front hemisphere instead of a second full sphere.
verts=[];faces=[]
for j in range(9):
 for i in range(25):
  az=-1.25+i/24*2.5;el=-.13+j/8*.56;verts.append(B((math.sin(az)*math.cos(el)*.130,.755+math.sin(el)*.157,.315+math.cos(az)*math.cos(el)*.157)))
for j in range(8):
 for i in range(24):a=j*25+i;faces.append((a,a+1,a+26,a+25))
me=bpy.data.meshes.new('Cut visor surface');me.from_pydata(verts,[],faces);o=bpy.data.objects.new('Recessed smoked visor',me);bpy.context.collection.objects.link(o);o.data.materials.append(visor);smooth(o);equipment.append(attach(o,'Neck'))
for side in [-1,1]:
 equipment.append(attach(tube('Helmet cheek seal',[(side*.12,.79,.38),(side*.12,.72,.40),(side*.10,.66,.42)],.011,dark),'Neck'))
 equipment.append(attach(tube('Helmet crown seam',[(side*.05,.90,.30),(side*.07,.87,.40),(side*.09,.81,.44)],.003,blue),'Neck'))
 equipment.append(attach(tube('Visor hinge',[(side*.127,.76,.335),(side*.134,.76,.35)],.016,shell),'Neck'))
 # Shaped, low profile protection; original anatomical body stays continuous underneath.
 equipment.append(attach(sphere('Shoulder protector',(side*.22,.445,.25),(.085,.042,.07),blue),'UpperArm_'+str(side)))
 equipment.append(attach(sphere('Knee protection',(side*.38,-.23,.335),(.085,.045,.045),blue),'Thigh_'+str(side)))
 # Toe caps/sole follow footboard positions, not the old floating boot position.
 equipment.append(attach(sphere('Boot toe',(side*.50,-.505,.025),(.078,.045,.13),dark),'Foot_'+str(side)))
 equipment.append(attach(tube('Boot sole',[(side*.50-.065,-.548,-.12),(side*.50,-.548,.15),(side*.50+.065,-.548,-.12)],.010,dark),'Foot_'+str(side)))
 equipment.append(attach(tube('Suit shoulder piping',[(side*.17,.44,.20),(side*.14,.35,.15),(side*.11,.10,.09)],.004,seam),'RiderTorso'))
equipment.append(attach(sphere('Spinal impact pad',(0,.29,.11),(.085,.20,.025),dark),'RiderTorso'))
equipment.append(attach(tube('Back center reflective stripe',[(0,.12,.07),(0,.31,.09),(0,.46,.16)],.009,seam),'RiderTorso'))
# Bake accessory origin transforms into mesh before export/skinning.
for o in equipment:
 if 'Neck' in o.vertex_groups:o.location.z-=.04
 o.data.transform(o.matrix_basis);o.matrix_basis=Matrix.Identity(4)
all_objects=[rig,body]+equipment
for o in all_objects:o.hide_set(False);o.hide_render=False
# Store rest-pose metadata for runtime IK. All vector values are game Y-up.
rig['racerRigVersion']=1;rig['grips']=json.dumps(grip_local);rig['shoulders']=json.dumps([list(pose['UpperArm_'+str(s)][0]) for s in [-1,1]])
bpy.ops.wm.save_as_mainfile(filepath=str(S/'racer.blend'),compress=True)
select([body]+equipment);bpy.ops.object.join();all_objects=[rig,body]
export(O/'rider.glb',all_objects);manifest.append({'file':'public/models/rider.glb',**stats(all_objects)})
for o in [body]:
 select([o]);d=o.modifiers.new('AI and mobile silhouette LOD','DECIMATE');d.ratio=.46;d.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=d.name)
export(O/'rider-low.glb',all_objects);manifest.append({'file':'public/models/rider-low.glb',**stats(all_objects)})
for row in manifest:row['bytes']=(R/row['file']).stat().st_size
(O/'manifest.json').write_text(json.dumps({'method':'Blender CC0 PWC deep adaptation and anatomical human skinning','sources':['assets/racecraft/source/pwc-cc0.glb','assets/racecraft/source/human-base-cc0.blend'],'assets':manifest,'grips':grip_local},indent=2))
print('RACECRAFT',json.dumps(manifest));print('GRIPS',grip_local)
