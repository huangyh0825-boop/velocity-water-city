"""Continuous anatomical race suit and full-face helmet reconstruction.
The retained CC0-derived seated skin and 43-bone rig are the fitting mannequin;
limb tubes, spherical joint plates and the previous helmet are removed entirely.
"""
import bpy,bmesh,math,json,importlib.util,sys
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2];SRC=ROOT/'assets/racecraft/source';OUT=ROOT/'public/models'
sys.path.insert(0,str(Path(__file__).parent));from asset_packaging import external_images
spec=importlib.util.spec_from_file_location('art',Path(__file__).with_name('refine-hero-assets.py'));h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
B,G=h.B,h.G;PI=math.pi
bpy.ops.wm.open_mainfile(filepath=str(SRC/'hero-racer.blend'))
body=bpy.data.objects['Tailored_neoprene_suit'];rig=bpy.data.objects['RaceRig']
retained=[]
for o in list(bpy.context.scene.objects):
 if o in [body,rig]:continue
 if any(q in o.name for q in ['glove','Glove','face behind','Eye under','Iris under','Eye pupil']):retained.append(o)
 else:bpy.data.objects.remove(o,do_unlink=True)
for m in list(body.modifiers):body.modifiers.remove(m)
navy=bpy.data.materials['Hero stretch racing textile'];blue=bpy.data.materials['Hero blue leather panels'];silver=bpy.data.materials['Hero pearl helmet'];carbon=bpy.data.materials['Hero woven protection'];rubber=bpy.data.materials['Hero glove and boot grip'];metal=bpy.data.materials['Hero satin hardware'];pale=bpy.data.materials['Hero reflective piping'];black=bpy.data.materials['Hero cavity and visor gasket']
warm=h.material('Racer light grey perforated leather',(.44,.49,.51),0,.65,.06)
# Reuse authored microstructure, not the old shiny plastic suit finish.
for original,copy in [(blue,warm)]:
 for n in original.node_tree.nodes:
  if n.type=='TEX_IMAGE' and n.image and 'normal' in n.image.name:
   t=copy.node_tree.nodes.new('ShaderNodeTexImage');t.image=n.image;nm=copy.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.35;copy.node_tree.links.new(t.outputs['Color'],nm.inputs['Color']);copy.node_tree.links.new(nm.outputs['Normal'],copy.node_tree.nodes.get('Principled BSDF').inputs['Normal'])
blue.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.04
for n in blue.node_tree.nodes:
 if n.type=='NORMAL_MAP':n.inputs['Strength'].default_value=.3
body.data.materials.clear()
for mat in [navy,blue,warm,carbon]:body.data.materials.append(mat)

# Tailored allowance over genuine anatomy. The whole suit remains one weighted skin:
# broad shoulder/upper-arm volumes, relaxed elbows/knees and compression folds.
original_positions=[v.co.copy() for v in body.data.vertices]
original_normals=[v.normal.copy() for v in body.data.vertices]
new_positions=[]
for v in body.data.vertices:
 p=G(original_positions[v.index]);normal=G(original_normals[v.index]);weights={body.vertex_groups[g.group].name:g.weight for g in v.groups}
 limb=max((w for n,w in weights.items() if n.startswith(('UpperArm','Forearm','Thigh','Shin'))),default=0)
 torso=weights.get('RiderTorso',0);pelvis=weights.get('Pelvis',0)
 amount=.006+limb*.011+torso*.011
 # Local flexion folds concentrate at elbows and the hip, rather than sinusoidal whole-body bumps.
 folds=0
 for s in [-1,1]:
  for joint,rad,strength in [('Forearm_',.105,.005),('Shin_',.11,.0045)]:
   center=G(rig.data.bones[joint+str(s)].head_local);distance=(p-center).length
   folds+=math.sin(distance*175+p.x*15)*math.exp(-(distance/rad)**2)*strength
 folds+=math.sin(p.y*100+p.z*32)*math.exp(-((p.y-.05)/.09)**2)*.0025
 p+=normal*(amount+folds);new_positions.extend(B(p))
body.data.vertices.foreach_set('co',new_positions)
body.data.update()
for o in retained:
 if any(q in o.name for q in ['face behind','Eye under','Iris under','Eye pupil']):
  for v in o.data.vertices:v.co+=B((0,0,-.027))
def smoothstep(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
fabric=navy.copy();fabric.name='R3 continuous tailored microfabric'
nt=fabric.node_tree;bsdf=nt.nodes.get('Principled BSDF')
for socket in ['Base Color','Metallic']:
 for link in list(bsdf.inputs[socket].links):nt.links.remove(link)
bsdf.inputs['Roughness'].default_value=.76;bsdf.inputs['Metallic'].default_value=0;bsdf.inputs['Coat Weight'].default_value=0
color=nt.nodes.new('ShaderNodeVertexColor');color.layer_name='RaceSuitColors';nt.links.new(color.outputs['Color'],bsdf.inputs['Base Color'])
vest_material=fabric.copy();vest_material.name='R3 woven buoyancy vest nylon'
vp=vest_material.node_tree.nodes.get('Principled BSDF')
for link in list(vp.inputs['Base Color'].links):vest_material.node_tree.links.remove(link)
vp.inputs['Base Color'].default_value=(.017,.080,.20,1)
body.data.materials.clear();body.data.materials.append(fabric)
colors=body.data.color_attributes.new(name='RaceSuitColors',type='FLOAT_COLOR',domain='POINT')
body.data.color_attributes.active_color=colors
white_masks=[]
for v in body.data.vertices:
 p=G(v.co);weights={body.vertex_groups[g.group].name:g.weight for g in v.groups}
 def w(prefix):return sum(value for name,value in weights.items() if name.startswith(prefix))
 white=max(w('UpperArm')*smoothstep(.285,.315,p.y),w('Shin')*smoothstep(.04,.09,p.z),w('RiderTorso')*smoothstep(.12,.16,abs(p.x)))
 blue_weight=min(1,w('Forearm')+w('Thigh')+w('UpperArm')+w('RiderTorso')*.6)
 c=Vector((.026,.045,.067)).lerp(Vector((.017,.102,.245)),blue_weight).lerp(Vector((.45,.50,.52)),white)
 colors.data[v.index].color=(*c,1);white_masks.append(white)
for polygon in body.data.polygons:polygon.material_index=0
h.smooth(body);equipment=list(retained)
def attach(o,bone='Neck'):
 o.data.transform(o.matrix_basis);o.matrix_basis=Matrix.Identity(4)
 for vg in list(o.vertex_groups):o.vertex_groups.remove(vg)
 group=o.vertex_groups.new(name=bone);group.add(list(range(len(o.data.vertices))),1,'REPLACE')
 mod=o.modifiers.new('Anatomical race skin','ARMATURE');mod.object=rig;o.parent=rig;o['rebuiltRiderPart']=True;equipment.append(o);return o
def surface(name,fn,mat,nu=64,nv=48,bone='Neck',thick=.003,sub=1):
 v=[];uv=[];f=[]
 for j in range(nv+1):
  for i in range(nu+1):v.append(fn(i/nu,j/nv));uv.append((i/nu,j/nv))
 for j in range(nv):
  for i in range(nu):k=j*(nu+1)+i;f.append((k,k+1,k+nu+2,k+nu+1))
 o=h.mesh(name,v,f,mat,uv);bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();h.finish(o,sub=sub,thick=thick);return attach(o,bone)
def tube(name,points,r,mat,bone):return attach(h.tube(name,points,r,mat,3),bone)

# Actual sewn panel boundaries are read from the continuous garment topology.
# This avoids rigid tube sleeves and separate visible spherical elbow joints.
body.data.update()
seamverts=[];seamfaces=[];seamweights=[]
for face in body.data.polygons:
 cuts=[]
 for a,b in face.edge_keys:
  x,y=white_masks[a]-.5,white_masks[b]-.5
  if x*y>=0:continue
  t=x/(x-y);aa=body.data.vertices[a];bb=body.data.vertices[b]
  point=aa.co.lerp(bb.co,t);normal=aa.normal.lerp(bb.normal,t).normalized();cuts.append((point+normal*.0015,normal,aa if t<.5 else bb))
 if len(cuts)!=2:continue
 (p,np,aa),(q,nq,bb)=cuts
 cross=(q-p).normalized().cross((np+nq).normalized()).normalized()*.0006
 index=len(seamverts);seamverts.extend([G(p-cross),G(p+cross),G(q+cross),G(q-cross)]);seamfaces.append((index,index+1,index+2,index+3));seamweights.extend([aa,aa,bb,bb])
seams=h.mesh('Continuous garment sewn panel edges',seamverts,seamfaces,pale)
for vg in body.vertex_groups:seams.vertex_groups.new(name=vg.name)
for i,source in enumerate(seamweights):
 for group in source.groups:seams.vertex_groups[group.group].add([i],group.weight,'REPLACE')
mod=seams.modifiers.new('Panel seam skin weights','ARMATURE');mod.object=rig;seams.parent=rig;equipment.append(seams)
# Compact quilted race buoyancy vest: it follows the real torso instead of covering
# the rider with armour balls. Side gussets, front zipper, back number and webbing.
from mathutils.bvhtree import BVHTree
bvh=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get())
def torso_z(x,y,front=True):
 hit=bvh.ray_cast(B((x,y,1.3 if front else -.6)),B((0,0,-1 if front else 1)),3)[0]
 return G(hit).z if hit else .1+y*.48
for front in [True,False]:
 for s in [-1,1]:
  def vest(u,t,front=front,s=s):
   y=.115+t*.325;width=.12+.036*math.sin(t*PI);x=s*(.014+u*width)
   samples=[torso_z(xx,y,front) for xx in [0,.05,.10,.13]]
   plane=max(samples) if front else min(samples)
   z=plane+(1 if front else -1)*(.010-.009*(x/width)**2)
   return(x,y,z)
  surface('Anatomically fitted race vest panel',vest,vest_material,40,64,'RiderTorso',.004,1)
  for j in range(3):
   t=(.19+j*.069-.115)/.325;tube('Vest quilting seam',[vest(u,t) for u in [.08,.25,.45,.65,.85]],.0011,navy,'RiderTorso')
for j in range(26):
 y=.14+j*.010;attach(h.box('Vest zipper tooth',(0,y,torso_z(0,y)+.013),(.006,.004,.003),metal,.0008),'RiderTorso')
for s in [-1,1]:
 tube('Vest bound shoulder strap',[(s*.12,.42,torso_z(s*.12,.42)+.008),(s*.14,.463,.26),(s*.14,.43,torso_z(s*.14,.43,False)-.01)],.013,navy,'RiderTorso')
attach(h.text('Rider team back lettering','VECTOR',(0,.40,torso_z(0,.40,False)-.022),.033,pale,rotation=(PI/2,0,PI)),'RiderTorso')
attach(h.text('Rider back competition number','07',(0,.26,torso_z(0,.26,False)-.023),.09,pale,rotation=(PI/2,0,PI)),'RiderTorso')
# Side wraps and lower webbing make the PFD a wearable garment with visible depth.
for s in [-1,1]:
 def sidewrap(u,t,s=s):
  y=.14+t*.25;front=torso_z(s*.14,y);back=torso_z(s*.14,y,False)
  return(s*(.142+.030*math.sin(u*PI)),y,front*(1-u)+back*u)
 surface('Race vest elastic side gusset',sidewrap,navy,36,36,'RiderTorso',.003,1)
 for y in [.16,.24]:
  tube('PFD waist webbing strap',[(s*.148,y,torso_z(s*.14,y)+.012),(s*.18,y,.12+y*.45),(s*.148,y,torso_z(s*.14,y,False)-.012)],.008,carbon,'RiderTorso')

# Boots have a real toe box, raised instep, ankle shaft and layered flex panels.
for s in [-1,1]:
 x=s*.50;bone='Foot_'+str(s)
 boot=h.loft('Racing boot sculpted upper '+str(s),[(-.168,x,-.50,.032,.027),(-.11,x,-.465,.062,.081),(-.05,x,-.47,.067,.079),(.035,x,-.496,.070,.045),(.13,x,-.510,.062,.032),(.20,x,-.515,.035,.023),(.218,x,-.519,.012,.012)],navy,72,56,.83,2);attach(boot,bone)
 attach(h.loft('Boot traction outsole '+str(s),[(-.17,x,-.546,.032,.009),(-.11,x,-.548,.067,.010),(.0,x,-.548,.074,.011),(.15,x,-.548,.067,.010),(.221,x,-.547,.025,.008)],rubber,64,48,.73,2),bone)
 # Elastic ankle fabric is a continuous tapered wrap around the actual shin line.
 ankle=G(rig.data.bones['Foot_'+str(s)].head_local);knee=G(rig.data.bones['Shin_'+str(s)].head_local);axis=(knee-ankle).normalized();u=axis.cross(Vector((0,0,1))).normalized();v=axis.cross(u).normalized()
 surface('Boot flexible ankle gaiter '+str(s),lambda a,t,c=ankle,axis=axis,u=u,v=v:c+axis*(.015+t*.075)+(u*math.cos(a*PI*2)+v*math.sin(a*PI*2))*(.054-t*.007),navy,48,36,'Shin_'+str(s),.002,1)
 for j in range(2):
  z=-.045+j*.052
  surface('Boot contoured closure strap',lambda u,t,x=x,z=z:(x+(u-.5)*.127,-.441-.036*abs(u-.5)*2-t*.012,z+t*.018),carbon,32,8,bone,.002,1)
 for j in range(9):tube('Boot wet grip tread',[(x-.06,-.559,-.11+j*.033),(x+.06,-.559,-.11+j*.033)],.002,rubber,bone)

# Helmet is rebuilt as one designed shell with an actual shaped eye port. The
# prominent chinbar, brow, jaw and spoiler are surface forms, not sphere accessories.
profile=[(.560,.075,.105,.275),(.580,.102,.149,.283),(.608,.121,.181,.287),(.642,.130,.182,.290),(.674,.136,.166,.291),(.700,.140,.154,.291),(.746,.145,.149,.289),(.784,.142,.143,.286),(.820,.128,.127,.282),(.854,.105,.105,.279),(.880,.072,.071,.275),(.897,.026,.027,.273),(.899,.002,.002,.273)]
def helmet(a,t):
 y,rx,rz,z=h.sample(profile,t);front=max(0,math.cos(a));rear=max(0,-math.cos(a))
 # Structured cheek sweep and an integrated aerodynamic rear trailing ridge.
 cheek=.009*math.exp(-((y-.65)/.045)**2)*math.sin(a)**2
 return Vector((math.sin(a)*(rx+cheek),y,z+math.cos(a)*rz-rear**7*.013*math.exp(-((y-.80)/.045)**2)))
v=[];uv=[];faces=[];N=128;M=104
for j in range(M+1):
 for i in range(N+1):v.append(helmet(-PI+i/N*2*PI,j/M));uv.append((i/N,j/M))
for j in range(M):
 for i in range(N):
  a=-PI+(i+.5)/N*2*PI;p=helmet(a,(j+.5)/M);edge=.683+.014*abs(math.sin(a));top=.793-.024*abs(math.sin(a))
  if abs(a)<1.18 and edge<p.y<top:continue
  if abs(a)<.29 and .618<p.y<.643:continue
  k=j*(N+1)+i;faces.append((k,k+1,k+N+2,k+N+1))
helmetmesh=h.mesh('Racer R3 sculpted full face shell',v,faces,silver,uv);h.finish(helmetmesh,sub=1,thick=.004);attach(helmetmesh)
visor=h.material('Racer neutral smoke optical visor',(.15,.20,.23),.12,.065,.95);visor.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.78;visor.surface_render_method='DITHERED'
def vis(a,t):
 angle=-1.20+a*2.40;edge=.679+.014*abs(math.sin(angle));top=.797-.024*abs(math.sin(angle));y=edge+t*(top-edge)
 return(math.sin(angle)*.151,y,.291+math.cos(angle)*(.164-.014*t))
surface('Racer R3 formed optical visor',vis,visor,96,40,'Neck',.0015,1)
for edge in [0,1]:tube('Helmet continuous eye port seal',[vis(i/96,edge) for i in range(97)],.003,black,'Neck')
# Paint patches follow the actual crown, with flowing livery instead of round pipes.
for s in [-1,1]:
 surface('Helmet flowing cobalt crown panel',lambda u,t,s=s:helmet(s*(.22+u*.25),.62+t*.33)+Vector((s*.001,.001,.001)),blue,24,48,'Neck',.0007,1)
 surface('Helmet sculpted chin cheek accent',lambda u,t,s=s:helmet(s*(.36+u*.78),.08+t*.22)+Vector((s*.001,0,.001)),blue,32,32,'Neck',.0007,1)
 attach(h.ring('Helmet visor ratchet cover',(s*.143,.739,.343),.016,.016,carbon,.004,'x'))
 attach(h.ring('Helmet ratchet captive screw',(s*.148,.739,.343),.006,.006,metal,.002,'x'))
 # Curved rear spoiler is a solid aerofoil, rather than old wire-loop appendages.
 surface('Helmet integrated rear spoiler',lambda u,t,s=s:(s*(.015+u*.105),.812+.010*math.sin(u*PI)-t*.020,.174-t*.030+.010*math.cos(u*PI)),carbon,40,16,'Neck',.004,1)
 for j in range(3):tube('Helmet recessed brow ventilation',[(s*(.045+j*.016),.791,.420),(s*(.045+j*.016),.802,.406)],.0025,black,'Neck')
 for j in range(4):tube('Helmet rear exhaust louvre',[(s*.115,.775+j*.009,.218),(s*.099,.779+j*.009,.201)],.0018,black,'Neck')
surface('Helmet chin vent inner plenum',lambda u,t:((u-.5)*.085,.615+t*.032,.471),black,12,8,'Neck',.002,0)
for j in range(5):tube('Helmet chin vent solid louvre',[(-.034+j*.017,.618,.482),(-.034+j*.017,.641,.481)],.0018,carbon,'Neck')
for s in [-1,1]:tube('Helmet neck roll',[(s*.074,.574,.25),(s*.08,.572,.32),(s*.055,.575,.37)],.009,black,'Neck')
surface('Racer anatomical balaclava collar',lambda u,t:(math.sin(u*PI*2)*(.079-t*.004),.514+t*.076,.282+math.cos(u*PI*2)*(.075-t*.003)),navy,64,36,'Neck',.002,1)
attach(h.text('Helmet competition number','07',(0,.792,.134),.047,blue,rotation=(PI/2,0,PI)))

mod=body.modifiers.new('Continuous weighted anatomical race suit','ARMATURE');mod.object=rig;body.parent=rig
rig['heroDetailVersion']=2;rig['riderRebuild']='R3 continuous garment and sculpted helmet';rig['gloveDigitBones']=28
for im in bpy.data.images:
 if im.filepath:im.filepath=bpy.path.relpath(bpy.path.abspath(im.filepath),start=str(SRC))
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'hero-rider-r3.blend'),compress=True)
h.select([body]+equipment);bpy.ops.object.join();body=bpy.context.object;body.name='R3_AnatomicalRaceRider'
row=h.export('rider.glb',[rig,body]);textures=external_images(OUT/'rider.glb','rider-r3/textures');row['bytes']=(OUT/'rider.glb').stat().st_size;row['textureBytes']=sum(i['bytes'] for i in textures)
manifest=json.loads((OUT/'manifest.json').read_text());manifest['assets']=[row if a['file']==row['file'] else a for a in manifest['assets']]
manifest['method']='Original VECTOR R8 exterior reconstruction and CC0-derived R3 anatomical racing rider'
manifest['heroMethod']='Compound PWC surfaces and continuous tailored anatomical race suit; retained seated rig with closed glove digits'
manifest['heroSources']=['assets/racecraft/source/hero-pwc-r8.blend','assets/racecraft/source/hero-rider-r3.blend']
manifest['riderRebuild']={'source':'assets/racecraft/source/hero-rider-r3.blend','method':'CC0 anatomical skin with continuous tailored race suit, reconstructed full-face helmet and boots','bones':len(rig.data.bones),'textures':textures}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2));print('HERO_RIDER_R3',json.dumps(row))
