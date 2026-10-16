"""R4: anatomical tailoring, curved flotation gear and articulated racing posture.
Adapt the retained CC0 adult skin; rebuild the helmet and reinforcement contours,
add thoracic/clavicle articulation, and preserve the glove/seat/foot interfaces.
The R3 generation script is retained separately as history, not executed here.
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
for link in list(blue.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].links):blue.node_tree.links.remove(link)
blue.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.025,.12,.29,1)
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
 amount=.004+limb*.0025+torso*.005
 # Local flexion folds concentrate at elbows and the hip, rather than sinusoidal whole-body bumps.
 folds=0
 for s in [-1,1]:
  for joint,rad,strength in [('Forearm_',.075,.0024),('Shin_',.080,.0027)]:
   center=G(rig.data.bones[joint+str(s)].head_local);distance=(p-center).length
   folds+=math.sin(distance*175+p.x*15)*math.exp(-(distance/rad)**2)*strength
 folds+=math.sin(p.y*100+p.z*32)*math.exp(-((p.y-.05)/.09)**2)*.0025
 p+=normal*(amount+folds)
 # Tailor shoulder breadth without ballooning the upper arm; preserve hand/foot anchors.
 p.x+=math.copysign(.013*torso*max(0,min(1,(p.y-.21)/.22)),p.x) if abs(p.x)>.09 else 0
 new_positions.extend(B(p))
body.data.vertices.foreach_set('co',new_positions)
body.data.update()
for o in retained:
 if any(q in o.name for q in ['face behind','Eye under','Iris under','Eye pupil']):
  for v in o.data.vertices:v.co+=B((0,0,-.027))
def smoothstep(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
fabric=navy.copy();fabric.name='R4 articulated technical race suit'
nt=fabric.node_tree;bsdf=nt.nodes.get('Principled BSDF')
for socket in ['Base Color','Metallic']:
 for link in list(bsdf.inputs[socket].links):nt.links.remove(link)
bsdf.inputs['Roughness'].default_value=.76;bsdf.inputs['Metallic'].default_value=0;bsdf.inputs['Coat Weight'].default_value=0
color=nt.nodes.new('ShaderNodeVertexColor');color.layer_name='RaceSuitColors';nt.links.new(color.outputs['Color'],bsdf.inputs['Base Color'])
vest_material=fabric.copy();vest_material.name='Team woven flotation panels'
vp=vest_material.node_tree.nodes.get('Principled BSDF')
for link in list(vp.inputs['Base Color'].links):vest_material.node_tree.links.remove(link)
vp.inputs['Base Color'].default_value=(.015,.09,.24,1)
body.data.materials.clear();body.data.materials.append(fabric)
colors=body.data.color_attributes.new(name='RaceSuitColors',type='FLOAT_COLOR',domain='POINT')
body.data.color_attributes.active_color=colors
white_masks=[]
for v in body.data.vertices:
 p=G(v.co);weights={body.vertex_groups[g.group].name:g.weight for g in v.groups}
 def w(prefix):return sum(value for name,value in weights.items() if name.startswith(prefix))
 white=max(w('UpperArm')*smoothstep(.285,.315,p.y),w('Shin')*smoothstep(.04,.09,p.z),w('RiderTorso')*smoothstep(.12,.16,abs(p.x)))
 blue_weight=min(1,w('Forearm')+w('Thigh')+w('UpperArm')+w('RiderTorso')*.6)
 c=Vector((.018,.025,.032)).lerp(Vector((.024,.044,.063)),blue_weight).lerp(Vector((.135,.17,.20)),white*.72)
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
# Fitted, curved PFD shells follow the actual chest/back BVH at every sample.
# Shaped armholes and a scooped neckline replace the former flat rectangular pads.
def panel(u,t,front=True,s=1):
 y=.12+t*.326-.038*t**6*(1-u)**3
 width=.143-.052*t**7-.017*(1-t)**5
 x=s*(.008+u*width);z=torso_z(x,y,front)
 lift=.009+.009*math.sin(u*PI)**2*math.sin(t*PI)**2
 return Vector((x,y,z+(1 if front else -1)*lift))
for front in [True,False]:
 for side in [-1,1]:
  surface('R4 shaped flotation '+('chest' if front else 'back')+str(side),lambda u,t,f=front,s=side:panel(u,t,f,s),vest_material,48,72,'RiderTorso',.004,1)
  for t in [.0,1.]:tube('PFD bound garment hem',[panel(i/40,t,front,side) for i in range(41)],.0022,navy,'RiderTorso')
  for u in [0,1]:tube('PFD stitched curved armhole',[panel(u,i/50,front,side) for i in range(51)],.0022,navy,'RiderTorso')
  # Channel quilting follows the chest contour, rather than protruding rigid armour.
  for t in [.28,.52,.76]:
   tube('PFD flexible foam channel',[panel(i/32,t+.035*math.sin(i/32*PI),front,side) for i in range(33)],.0012,navy,'RiderTorso')
for side in [-1,1]:
 # A broad textile shoulder yoke is fitted across chest, trapezius and upper back.
 def yoke(u,t,s=side):
  x=s*(.092+.051*u);y=.427+.038*math.sin(t*PI)
  front=torso_z(x,.427);back=torso_z(x,.427,False)
  return(x,y,front*(1-t)+back*t)
 surface('PFD woven shoulder yoke',yoke,navy,24,48,'RiderTorso',.003,1)
 for y in [.17,.26]:
  front=torso_z(side*.14,y);back=torso_z(side*.14,y,False)
  surface('PFD flat side adjustment webbing',lambda u,t,s=side,y=y,f=front,b=back:(s*(.148+.012*math.sin(u*PI)),y+(t-.5)*.019,f*(1-u)+b*u),carbon,36,8,'RiderTorso',.001,1)
  attach(h.box('PFD recessed adjustment buckle',(side*.162,y,(front+back)/2),(.009,.028,.035),rubber,.003),'RiderTorso')
for j in range(35):
 y=.135+j*.0075;attach(h.box('Sealed front zipper teeth',(0,y,torso_z(0,y)+.012),(.004,.003,.002),metal,.0005),'RiderTorso')
tube('PFD zipper pull',[(0,.385,torso_z(0,.385)+.017),(0,.365,torso_z(0,.365)+.024)],.0025,metal,'RiderTorso')
attach(h.text('Rider team back lettering','VECTOR',(0,.372,torso_z(0,.372,False)-.016),.028,pale,rotation=(PI/2,0,PI)),'RiderTorso')
attach(h.text('Rider back competition number','07',(0,.29,torso_z(0,.29,False)-.018),.070,pale,rotation=(PI/2,0,PI)),'RiderTorso')

# Tailored reinforcement panels are extracted from the real anatomical skin.
# They keep its exact weight field and curved elbow/knee/shoulder shape.
def skin_patch(name,field,mat,offset=.003):
 # Clip the actual weighted quad skin against an implicit curved panel boundary.
 # New edge vertices interpolate weights/normals; no staircase polygon selection.
 verts=[];faces=[];records=[];lookup={}
 def vertex(p,n,weights):
  key=tuple(round(float(x),7) for x in p)
  if key in lookup:return lookup[key]
  k=len(verts);lookup[key]=k;verts.append(G(p+n*offset));records.append(weights);return k
 for poly in body.data.polygons:
  inp=[]
  for i in poly.vertices:
   v=body.data.vertices[i];inp.append((v.co.copy(),v.normal.copy(),{g.group:g.weight for g in v.groups}))
  out=[]
  for i,p in enumerate(inp):
   q=inp[(i+1)%len(inp)];fp=field(G(p[0]));fq=field(G(q[0]))
   if fp<=0:out.append(p)
   if (fp<=0)!=(fq<=0):
    t=fp/(fp-fq);w={j:p[2].get(j,0)*(1-t)+q[2].get(j,0)*t for j in p[2].keys()|q[2].keys()}
    out.append((p[0].lerp(q[0],t),p[1].lerp(q[1],t).normalized(),w))
  if len(out)>=3:faces.append([vertex(*p) for p in out])
 o=h.mesh(name,verts,faces,mat)
 for vg in body.vertex_groups:o.vertex_groups.new(name=vg.name)
 for i,w in enumerate(records):
  for j,value in w.items():o.vertex_groups[j].add([i],value,'REPLACE')
 mod=o.modifiers.new('Continuous fitted equipment weights','ARMATURE');mod.object=rig;o.parent=rig;equipment.append(o)
 bm=bmesh.new();bm.from_mesh(o.data);bm.verts.ensure_lookup_table();boundary=[e for e in bm.edges if e.is_boundary]
 sv=[];sf=[];sw=[]
 for e in boundary:
  p,q=e.verts;d=(q.co-p.co).normalized();n=(p.normal+q.normal).normalized();w=d.cross(n)*.0005;k=len(sv)
  sv.extend([G(p.co-w+n*.0007),G(p.co+w+n*.0007),G(q.co+w+n*.0007),G(q.co-w+n*.0007)]);sf.append((k,k+1,k+2,k+3));sw.extend([p.index,p.index,q.index,q.index])
 bm.free()
 if sf:
  seams=h.mesh(name+' needle seam',sv,sf,pale)
  for vg in o.vertex_groups:seams.vertex_groups.new(name=vg.name)
  for i,src in enumerate(sw):
   for g in o.data.vertices[src].groups:seams.vertex_groups[g.group].add([i],g.weight,'REPLACE')
  mod=seams.modifiers.new('Stitch skin','ARMATURE');mod.object=rig;seams.parent=rig;equipment.append(seams)
for side in [-1,1]:
 skin_patch('R4 shaped deltoid leather '+str(side),lambda p,s=side:max(((s*p.x-.245)/.105)**2+((p.y-.366)/.081)**2+((p.z-.23)/.14)**2-1,.187-s*p.x),blue,.003)
 skin_patch('R4 forearm abrasion leather '+str(side),lambda p,s=side:((s*p.x-.389)/.075)**2+((p.y-.105)/.064)**2+((p.z-.46)/.108)**2-1,carbon,.003)
 skin_patch('R4 articulated knee abrasion '+str(side),lambda p,s=side:max(((s*p.x-.389)/.105)**2+((p.y+.23)/.105)**2-1,.32-p.z),carbon,.004)
 skin_patch('R4 outer thigh suede '+str(side),lambda p,s=side:max(((s*p.x-.29)/.08)**2+((p.y+.125)/.072)**2+((p.z-.12)/.11)**2-1,.265-s*p.x),navy,.003)

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
profile=[(.560,.070,.095,.275),(.580,.092,.132,.283),(.608,.112,.168,.287),(.642,.125,.173,.290),(.674,.136,.166,.291),(.700,.140,.154,.291),(.746,.145,.149,.289),(.784,.142,.143,.286),(.820,.128,.127,.282),(.854,.105,.105,.279),(.880,.072,.071,.275),(.897,.026,.027,.273),(.899,.002,.002,.273)]
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
helmet_start=len(equipment)
helmetmesh=h.mesh('Racer R4 sculpted full face shell',v,faces,silver,uv);h.finish(helmetmesh,sub=1,thick=.004);attach(helmetmesh)
visor=h.material('Racer neutral smoke optical visor',(.12,.16,.20),.06,.075,.8);visor.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.48;visor.surface_render_method='DITHERED'
def vis(a,t):
 angle=-1.20+a*2.40;edge=.679+.014*abs(math.sin(angle));top=.797-.024*abs(math.sin(angle));y=edge+t*(top-edge)
 return(math.sin(angle)*.151,y,.291+math.cos(angle)*(.164-.014*t))
surface('Team R4 formed optical visor',vis,visor,96,40,'Neck',.0015,1)
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
surface('Racer anatomical balaclava collar',lambda u,t:(math.sin(u*PI*2)*(.113-t*.046),.45+t*.143,.280+t*.010+math.cos(u*PI*2)*(.148-t*.073)),navy,64,36,'Neck',.002,1)
attach(h.text('Helmet competition number','07',(0,.792,.134),.047,blue,rotation=(PI/2,0,PI)))

# Reduce the oversized helmet silhouette to an adult-sized shell. Face and eyes
# receive exactly the same transform; the neck collar stays seated on the neck.
for o in equipment[helmet_start:]+[o for o in retained if any(x in o.name for x in ['face behind','Eye under','Iris under','Eye pupil'])]:
 if 'balaclava' in o.name:continue
 for vertex in o.data.vertices:
  p=G(vertex.co);p=Vector((p.x*.91,.56+(p.y-.56)*.90,.315+(p.z-.28)*.94));vertex.co=B(p)
rig['adultHelmetWidth']=.267

# Build the collar from the actual open neckline loop, not a generic cone.
# Its first ring uses identical positions/weights to the suit; the upper ring tucks
# inside the shifted helmet base. This removes the previous floating bib/gap.
for o in list(equipment):
 if 'balaclava' in o.name:equipment.remove(o);bpy.data.objects.remove(o,do_unlink=True)
bm=bmesh.new();bm.from_mesh(body.data);bm.verts.ensure_lookup_table()
neighbors={}
for e in bm.edges:
 if e.is_boundary and min(v.co.z for v in e.verts)>.4:
  a,b=[v.index for v in e.verts];neighbors.setdefault(a,[]).append(b);neighbors.setdefault(b,[]).append(a)
start=next(iter(neighbors));order=[start];previous=-1;current=start
while True:
 nxt=next(i for i in neighbors[current] if i!=previous)
 if nxt==start:break
 order.append(nxt);previous,current=current,nxt
bm.free();N=len(order);rows=16;v=[];uv=[];f=[]
for j in range(rows+1):
 t=j/rows
 for i,index in enumerate(order):
  p=G(body.data.vertices[index].co);a=math.atan2(p.x/.081,(p.z-.344)/.084)
  top=Vector((math.sin(a)*.071,.575,.315+math.cos(a)*.088))
  v.append(p.lerp(top,t));uv.append((i/N,t))
for j in range(rows):
 for i in range(N):a=j*N+i;b=j*N+(i+1)%N;f.append((a,b,b+N,a+N))
collar=h.mesh('R4 fitted weighted neckline',v,f,navy,uv)
bm=bmesh.new();bm.from_mesh(collar.data);bm.normal_update()
if sum(p.normal.dot(Vector((p.calc_center_median().x,p.calc_center_median().y+.335,0))) for p in bm.faces)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
bm.to_mesh(collar.data);bm.free()
for vg in body.vertex_groups:collar.vertex_groups.new(name=vg.name)
for j in range(rows+1):
 t=j/rows
 for i,index in enumerate(order):
  weights={g.group:g.weight*(1-t) for g in body.data.vertices[index].groups};neck=collar.vertex_groups['Neck'].index;weights[neck]=weights.get(neck,0)+t
  for group,value in weights.items():collar.vertex_groups[group].add([j*N+i],value,'REPLACE')
mod=collar.modifiers.new('Neckline blended anatomical skin','ARMATURE');mod.object=rig;collar.parent=rig;equipment.append(collar)

# Articulated lumbar/chest/clavicles preserve real shoulder mechanics. Reparenting
# leaves rest matrices unchanged; interpolate original torso skin weights by height.
h.select([rig]);bpy.ops.object.mode_set(mode='EDIT')
base=rig.data.edit_bones['RiderTorso'];chest=rig.data.edit_bones.new('RiderChest')
chest.head=B((0,.275,.151));chest.tail=B((0,.46,.25));chest.parent=base
rig.data.edit_bones['Neck'].parent=chest
for side in [-1,1]:
 clav=rig.data.edit_bones.new('Clavicle_'+str(side));clav.head=B((side*.05,.425,.23));clav.tail=rig.data.edit_bones['UpperArm_'+str(side)].head.copy();clav.parent=chest
 rig.data.edit_bones['UpperArm_'+str(side)].parent=clav
bpy.ops.object.mode_set(mode='OBJECT')
for o in [body]+equipment:
 old=o.vertex_groups.get('RiderTorso')
 if not old:continue
 upper=o.vertex_groups.new(name='RiderChest');oid=old.index
 for v in o.data.vertices:
  weight=next((g.weight for g in v.groups if g.group==oid),0)
  if weight<=0:continue
  y=G(v.co).y;t=smoothstep(.19,.355,y)
  if t>0:upper.add([v.index],weight*t,'REPLACE');old.add([v.index],weight*(1-t),'REPLACE')

# The neck gaiter blends into the shoulder girdle instead of rotating as a rigid
# cylinder with the helmet. This closes the old jagged, floating collar opening.
for o in equipment:
 if 'balaclava' not in o.name:continue
 o.vertex_groups.clear();a=o.vertex_groups.new(name='RiderChest');b=o.vertex_groups.new(name='Neck')
 for v in o.data.vertices:
  t=smoothstep(.47,.575,G(v.co).y);a.add([v.index],1-t,'REPLACE');b.add([v.index],t,'REPLACE')

mod=body.modifiers.new('Continuous weighted anatomical race suit','ARMATURE');mod.object=rig;body.parent=rig
rig['heroDetailVersion']=2;rig['riderRebuild']='R4 articulated adult rider with conformal race PFD';rig['articulatedSpine']=True;rig['gloveDigitBones']=28
for im in bpy.data.images:
 if im.filepath:im.filepath=bpy.path.relpath(bpy.path.abspath(im.filepath),start=str(SRC))
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'hero-rider-r4.blend'),compress=True)
h.select([body]+equipment);bpy.ops.object.join();body=bpy.context.object;body.name='R4_ArticulatedRaceRider'
row=h.export('rider.glb',[rig,body]);textures=external_images(OUT/'rider.glb','rider-r4/textures');row['bytes']=(OUT/'rider.glb').stat().st_size;row['textureBytes']=sum(i['bytes'] for i in textures)
manifest=json.loads((OUT/'manifest.json').read_text());manifest['assets']=[row if a['file']==row['file'] else a for a in manifest['assets']]
manifest['method']='Original VECTOR R8 exterior reconstruction and CC0-derived R4 articulated anatomical racing rider'
manifest['heroMethod']='Shared R8 PWC and R4 adult rider with fitted flotation gear, sewn anatomical reinforcements and 46-bone lumbar/thoracic/clavicle posture'
manifest['heroSources']=['assets/racecraft/source/hero-pwc-r8.blend','assets/racecraft/source/hero-rider-r4.blend']
manifest['riderRebuild']={'source':'assets/racecraft/source/hero-rider-r4.blend','method':'CC0 adult anatomical skin, fitted flotation equipment, sewn reinforcement panels, adult-scaled full-face helmet and lumbar/chest/clavicle articulation','bones':len(rig.data.bones),'textures':textures}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2));print('HERO_RIDER_R4',json.dumps(row))
