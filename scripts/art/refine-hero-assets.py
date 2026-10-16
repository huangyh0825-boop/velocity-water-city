"""Hero-only deep reconstruction. Blender 4.5 LTS; Y-up authoring helpers.

Inputs are the editable, CC0-derived baseline scenes, not runtime decimated GLBs.
Never writes the AI/mobile GLBs. No driving, collision or track data is involved.
"""
import bpy, bmesh, math, json, numpy as np
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

R=Path(__file__).resolve().parents[2]; S=R/'assets/racecraft/source'; O=R/'public/models'
T=R/'assets/racecraft/textures/hero'; T.mkdir(parents=True,exist_ok=True)
PI=math.pi
def B(p):return Vector((p[0],-p[2],p[1]))
def G(p):return Vector((p[0],p[2],-p[1]))
def select(obs):
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.hide_set(False);o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0]
def apply(o,mod):
 select([o]);bpy.ops.object.modifier_apply(modifier=mod.name)
def smooth(o):
 for p in o.data.polygons:p.use_smooth=True
 return o
def mesh(name,verts,faces,material,uv=None):
 me=bpy.data.meshes.new(name);me.from_pydata([B(v) for v in verts],[],faces);me.update()
 o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);me.materials.append(material)
 layer=me.uv_layers.new(name='Authored surface UV')
 if uv:
  for l in me.loops:layer.data[l.index].uv=uv[l.vertex_index]
 else:
  for p in me.polygons:
   n=p.normal;axes=[(0,1),(0,2),(1,2)][max(range(3),key=lambda i:abs(n[i]))]
   for li in p.loop_indices:
    v=me.vertices[me.loops[li].vertex_index].co;layer.data[li].uv=(v[axes[0]]*2,v[axes[1]]*2)
 return smooth(o)
def finish(o,sub=0,thick=0,bevel=0):
 if sub:
  m=o.modifiers.new('Authored subdivision curvature','SUBSURF');m.levels=sub;apply(o,m)
 if thick:
  m=o.modifiers.new('Real shell thickness','SOLIDIFY');m.thickness=thick;apply(o,m)
 if bevel:
  m=o.modifiers.new('Machined edge radii','BEVEL');m.width=bevel;m.segments=3;apply(o,m)
 return smooth(o)
def tube(name,points,r,material,res=4):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=1 if len(points)>20 else 12;cu.bevel_depth=r;cu.bevel_resolution=res;cu.use_fill_caps=True
 sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for q,p in zip(sp.bezier_points,points):q.co=B(p);q.handle_left_type=q.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(o);cu.materials.append(material);select([o]);bpy.ops.object.convert(target='MESH');return smooth(bpy.context.object)
def box(name,c,size,material,bevel=.01):
 bpy.ops.mesh.primitive_cube_add(size=1,location=B(c));o=bpy.context.object;o.name=name;o.scale=(size[0],size[2],size[1]);select([o]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 finish(o,bevel=bevel);return o
def ellipsoid(name,c,scale,material,seg=40):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=24,location=B(c));o=bpy.context.object;o.name=name;o.scale=(scale[0],scale[2],scale[1]);select([o]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material);return smooth(o)
def ring(name,c,rx,ry,material,r=.006,axis='z'):
 pts=[]
 for i in range(65):
  a=i/64*2*PI
  if axis=='z':pts.append((c[0]+rx*math.cos(a),c[1]+ry*math.sin(a),c[2]))
  elif axis=='y':pts.append((c[0]+rx*math.cos(a),c[1],c[2]+ry*math.sin(a)))
  else:pts.append((c[0],c[1]+rx*math.cos(a),c[2]+ry*math.sin(a)))
 return tube(name,pts,r,material,2)
def text(name,words,p,size,material,rotation=(PI/2,0,0)):
 cu=bpy.data.curves.new(name,'FONT');cu.body=words;cu.align_x='CENTER';cu.size=size;cu.extrude=.0003;cu.bevel_depth=.00015;cu.resolution_u=8
 o=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(o);o.location=B(p);o.rotation_euler=rotation;cu.materials.append(material);select([o]);bpy.ops.object.convert(target='MESH');return bpy.context.object
def sample(ctrl,t):
 x=t*(len(ctrl)-1);i=min(len(ctrl)-2,int(x));u=x-i
 a=np.array(ctrl[max(0,i-1)]);b=np.array(ctrl[i]);c=np.array(ctrl[i+1]);d=np.array(ctrl[min(len(ctrl)-1,i+2)])
 return .5*((2*b)+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u**3)
def loft(name,sections,material,n=64,m=48,power=1,sub=1):
 # Sections: z, center-x, center-y, x-radius, y-radius. Closed quad rings.
 v=[];uv=[];f=[]
 for j in range(n+1):
  z,x,y,rx,ry=sample(sections,j/n)
  for i in range(m+1):
   a=2*PI*i/m;s=math.sin(a);c=math.cos(a)
   v.append((x+rx*math.copysign(abs(s)**power,s),y+ry*math.copysign(abs(c)**power,c),z));uv.append((i/m,j/n))
 for j in range(n):
  for i in range(m):a=j*(m+1)+i;f.append((a,a+m+1,a+m+2,a+1))
 f.extend([tuple(range(m)),tuple(reversed([n*(m+1)+i for i in range(m)]))])
 return finish(mesh(name,v,f,material,uv),sub=sub)
def material(name,color,metal=0,rough=.5,coat=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;p.inputs['Coat Weight'].default_value=coat;p.inputs['Coat Roughness'].default_value=.17;return m
def pbr(name,color,kind,rough,metal=0,coat=0,size=2048):
 m=material(name,color,metal,rough,coat);nt=m.node_tree;p=nt.nodes.get('Principled BSDF')
 y,x=np.mgrid[:size,:size].astype(np.float32);rng=np.random.default_rng(906);noise=rng.normal(0,1,(size,size)).astype(np.float32)
 if kind=='cloth':
  h=np.sin(x*PI/3)*np.sin(y*PI/3)*.10;h+=np.sin((x+y)*PI/6)*.025;variation=.055*np.sin(x*PI/12)*np.sin(y*PI/12);rr=rough+variation+noise*.02
 elif kind=='carbon':
  cell=((x//12+y//12)%2);h=np.sin((x*(1-cell)+y*cell)*PI/2)*.035;variation=cell*.12+np.sin(x*.15+y*.15)*.03;rr=rough+variation*.3+noise*.012
 elif kind=='rubber':
  h=.1*np.maximum(0,np.sin((x+y)*PI/28)*np.sin((x-y)*PI/28));variation=noise*.04;rr=rough+noise*.025
 elif kind=='leather':
  h=np.sin(x*.8+np.sin(y*.1))*np.sin(y*.6)*.03+noise*.02;variation=noise*.015;rr=rough+noise*.03
 elif kind=='metal':
  h=noise*.004;variation=np.sin(y*1.5)*.045+noise*.015;rr=rough+variation*.9
 else:
  h=noise*.0007;variation=noise*.009;rr=rough+noise*.008
 base=np.clip(np.array(color,dtype=np.float32)[None,None,:]*(1+variation[...,None]),0,1)
 gy,gx=np.gradient(h);nz=np.ones_like(x);length=np.sqrt(1+gx*gx+gy*gy);normal=np.stack([.5-gx/length*.5,.5-gy/length*.5,.5+nz/length*.5],-1)
 orm=np.stack([np.clip(1-abs(h)*.2,.7,1),np.clip(rr,.04,.96),np.full_like(x,metal)],-1)
 for key,arr in [('basecolor',base),('normal',normal),('orm',orm)]:
  im=bpy.data.images.new(name+' '+key,width=size,height=size);im.colorspace_settings.name='sRGB' if key=='basecolor' else 'Non-Color'
  rgba=np.concatenate([arr,np.ones((size,size,1),dtype=np.float32)],-1).astype(np.float32);im.pixels.foreach_set(rgba.ravel());im.filepath_raw=str(T/(name.replace(' ','-')+'-'+key+'.png'));im.file_format='PNG';im.save();im.pack()
  node=nt.nodes.new('ShaderNodeTexImage');node.image=im
  if key=='basecolor':nt.links.new(node.outputs['Color'],p.inputs['Base Color'])
  elif key=='normal':
   nm=nt.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.5;nt.links.new(node.outputs['Color'],nm.inputs['Color']);nt.links.new(nm.outputs['Normal'],p.inputs['Normal'])
  else:
   split=nt.nodes.new('ShaderNodeSeparateColor');nt.links.new(node.outputs['Color'],split.inputs['Color']);nt.links.new(split.outputs['Green'],p.inputs['Roughness']);nt.links.new(split.outputs['Blue'],p.inputs['Metallic'])
   ng=bpy.data.node_groups.new('glTF Material Output '+name,'ShaderNodeTree');ng.interface.new_socket('Occlusion',in_out='INPUT',socket_type='NodeSocketFloat');ng.nodes.new('NodeGroupOutput');gn=nt.nodes.new('ShaderNodeGroup');gn.node_tree=ng;nt.links.new(split.outputs['Red'],gn.inputs['Occlusion'])
 return m
def export(file,objects):
 select(objects);bpy.ops.export_scene.gltf(filepath=str(O/file),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_skins=True,export_extras=True,export_materials='EXPORT')
 return {'file':'public/models/'+file,'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects if o.type=='MESH'),'draws':sum(len(o.data.materials) for o in objects if o.type=='MESH'),'bytes':(O/file).stat().st_size}
def merge_materials(objects,prefix):
 # Keep the editable scene saved first. Runtime grouping preserves each modeled part in source.
 groups={}
 for o in objects:
  if o.type=='MESH' and len(o.data.materials)==1:groups.setdefault(o.data.materials[0],[]).append(o)
 result=[o for o in objects if o.type!='MESH' or len(o.data.materials)!=1]
 for mat,obs in groups.items():
  select(obs)
  if len(obs)>1:bpy.ops.object.join()
  o=bpy.context.object;o.name=prefix+mat.name.replace(' ','_');result.append(o)
 return result

def craft():
 bpy.ops.wm.open_mainfile(filepath=str(S/'racecraft.blend'))
 for o in list(bpy.context.scene.objects):
  if o.type=='MESH' and not any(k in o.name for k in ['structural floor','saddle spine']):bpy.data.objects.remove(o,do_unlink=True)
 # Existing collision envelope and six sockets are retained. Replace major visual components.
 old=bpy.data.materials.get('Paint')
 if old:old.name='Baseline paint (unused)'
 paint=pbr('Paint',(.82,.86,.90),'paint',.22,.34,.7)
 pearl=pbr('Pearl ceramic silver',(.62,.69,.74),'paint',.30,.26,.5)
 carbon=pbr('Forged carbon composite',(.045,.063,.082),'carbon',.40,.25,.15)
 metal=pbr('Brushed titanium',(.39,.45,.51),'metal',.28,.88)
 rubber=pbr('Molded traction rubber',(.045,.052,.06),'rubber',.78)
 leather=pbr('Perforated marine saddle',(.035,.042,.055),'leather',.63)
 dark=material('Recess cavity',(.009,.016,.021),.10,.65);white=material('Ceramic markings',(.72,.83,.87),.14,.38)
 light=material('Ice navigation lens',(.14,.72,.85),.25,.2,.6);p=light.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(.08,.5,.7,1);p.inputs['Emission Strength'].default_value=.65
 for o in bpy.context.scene.objects:
  if o.type=='MESH':
   o.data.materials.clear();o.data.materials.append(pearl if ('hull' in o.name or 'perimeter' in o.name) else dark)
 # Rebuild the lower hull: rising bow, molded chines and transom replace the old boat-like prow.
 hull_sections=[(-1.90,.46,.32,-.14),(-1.67,.59,.32,-.19),(-1.20,.68,.32,-.205),(-.50,.70,.32,-.20),(.25,.64,.32,-.15),(.95,.49,.32,-.015),(1.48,.29,.30,.12),(1.83,.105,.282,.22),(1.99,.008,.27,.253)]
 v=[];uv=[];faces=[];N=20
 for j in range(97):
  z,w,top,bottom=sample(hull_sections,j/96)
  cross=[(0,top),(.78*w,top),(.93*w,top-.012),(w,top-.04),(.99*w,top-.07),(.96*w,bottom+.07),(.90*w,bottom+.045),(.60*w,bottom+.005),(.30*w,bottom),(0,bottom-.008),(-.30*w,bottom),(-.60*w,bottom+.005),(-.90*w,bottom+.045),(-.96*w,bottom+.07),(-.99*w,top-.07),(-w,top-.04),(-.93*w,top-.012),(-.78*w,top),(-.39*w,top),(0,top)]
  for i,(x,y) in enumerate(cross):v.append((x,y,z));uv.append((i/(N-1),j/96))
 for j in range(96):
  for i in range(N-1):k=j*N+i;faces.append((k,k+N,k+N+1,k+1))
 faces.extend([tuple(range(N-1)),tuple(reversed([96*N+i for i in range(N-1)]))])
 hull=mesh('Retopologized rising bow and double chine hull',v,faces,pearl,uv)
 hull.data.materials.append(carbon)
 for p in hull.data.polygons:
  if p.index<96*(N-1) and 5<=p.index%(N-1)<=12:p.material_index=1
 finish(hull,sub=2)
 # Rebuild cowl from designed longitudinal sections, with distinct crown and shoulder surfaces.
 loft('Sculpted bow crown',[(.08,0,.50,.30,.245),(.34,0,.53,.40,.27),(.72,0,.52,.405,.25),(1.10,0,.46,.35,.20),(1.48,0,.37,.25,.125),(1.80,0,.29,.10,.06),(1.95,0,.27,.012,.009)],paint,n=80,m=64,power=.86,sub=2)
 # Separate formed shoulder panels follow the cowl with a real gap and layered edge.
 ctrl=[(.08,0,.50,.30,.245),(.34,0,.53,.40,.27),(.72,0,.52,.405,.25),(1.10,0,.46,.35,.20),(1.48,0,.37,.25,.125),(1.80,0,.29,.10,.06),(1.95,0,.27,.012,.009)]
 for side in [-1,1]:
  v=[];uv=[];f=[]
  for j in range(33):
   z,x,y,rx,ry=sample(ctrl,.11+j/32*.65)
   for i in range(9):
    a=.62+i/8*.53;v.append((side*(rx*math.sin(a)**.86+.004),y+ry*math.cos(a)**.86+.003,z));uv.append((i/8,j/32))
  for j in range(32):
   for i in range(8):k=j*9+i;f.append((k,k+1,k+10,k+9) if side<0 else (k,k+9,k+10,k+1))
  finish(mesh('Formed silver bow shoulder',v,f,pearl,uv),sub=2,thick=.004,bevel=.001)
 for side in [-1,1]:
  # Separate flank fairings; inset side cooling louvres stay open above the shell.
  loft('Layered rear flank '+str(side),[(-1.73,side*.35,.345,.09,.06),(-1.42,side*.39,.42,.13,.13),(-.9,side*.37,.47,.14,.18),(-.30,side*.34,.49,.12,.19),(.13,side*.34,.49,.10,.15)],paint,n=48,m=32,power=.65,sub=2)
  rail=[]
  for t in np.linspace(0,1,65):
   z,w,top,bottom=sample(hull_sections,t);rail.append((side*w*.98,top-.016,z))
  tube('Bonded hull rub rail',rail,.015,rubber)
  tube('Silver chine accent',[(side*.62,.30,-1.67),(side*.655,.30,-.80),(side*.63,.30,.20),(side*.40,.30,1.18)],.010,pearl)
  tube('Cowl panel joint',[(side*.16,.70,.22),(side*.25,.685,.61),(side*.24,.57,1.03),(side*.12,.41,1.58)],.004,dark)
  # Tangential layered intake: recessed opening + gasket + visible vanes and lip.
  v=[(side*.395,.56,.34),(side*.417,.53,.85),(side*.35,.43,.96),(side*.36,.43,.36)]
  mesh('Deep intake throat '+str(side),v,[(0,1,2,3)],dark)
  tube('Intake molded perimeter',v+[v[0]],.014,carbon)
  for i in range(6):
   z=.42+i*.075;tube('Swept intake vane',[(side*.399,.52,z),(side*.38,.46,z+.045)],.009,metal,2)
  # Full wet footwell, drain fittings, physically modeled diamond ridges.
  box('Recessed footwell traction insert',(side*.497,.326,-.59),(.225,.018,1.30),rubber,.023)
  for j in range(22):
   z=-1.19+j*.056;tube('Raised chevron grip',[(side*.40,.338,z-.025),(side*.49,.341,z+.012),(side*.585,.338,z-.025)],.0028,rubber,1)
  for z in [-1.16,-.72,-.27]:
   ring('Footwell scupper rim',(side*.60,.328,z),.016,.016,metal,.003,'y');box('Scupper shadow',(side*.60,.327,z),(.019,.004,.024),dark,.003)
  tube('Footwell molded side wall',[(side*.62,.34,-1.27),(side*.64,.37,-.55),(side*.61,.37,.08)],.018,carbon)
  # Slim lens and layered wing mirror at the front, no spaceship silhouette.
  tube('Inset running light',[(side*.67,.29,-.90),(side*.67,.29,-.35),(side*.635,.29,.12)],.007,light)
  ellipsoid('Mirror aerodynamic housing',(side*.47,.71,.42),(.095,.038,.16),carbon)
  ellipsoid('Mirror reflective insert',(side*.478,.714,.384),(.077,.024,.09),metal)
  for z in [-1.62,-1.05,.0,1.20]:
   ring('Captive deck fastener',(side*(.45 if z<.5 else .28),.36 if z<.5 else .48,z),.009,.009,metal,.0025,'y')
 # Two distinct saddle zones: narrowed front, rear rise, contrasting top upholstery.
 loft('Saddle injection molded cradle',[(-1.52,0,.52,.13,.08),(-1.25,0,.61,.23,.13),(-.82,0,.63,.22,.13),(-.38,0,.60,.19,.13),(.08,0,.57,.16,.11),(.30,0,.51,.09,.05)],carbon,n=64,m=40,power=.65,sub=2)
 loft('Rider saddle sculpted cushion',[(-1.44,0,.68,.12,.065),(-1.18,0,.73,.215,.105),(-.83,0,.72,.21,.10),(-.48,0,.685,.17,.075),(-.12,0,.68,.14,.070),(.18,0,.62,.10,.055)],leather,n=64,m=48,power=.55,sub=2)
 for side in [-1,1]:
  tube('Double stitched saddle welt',[(side*.10,.72,.08),(side*.15,.755,-.4),(side*.19,.80,-.85),(side*.19,.80,-1.15),(side*.10,.73,-1.42)],.0023,white,2)
  for j in range(32):
   z=-1.25+j*.04;x=side*(.19 if z<-.65 else .15);tube('Saddle thread stitch',[(x,.803 if z<-.65 else .758,z),(x,.803 if z<-.65 else .758,z+.012)],.0008,white,1)
 # Rear boarding deck, grab handle and mechanical attachments.
 box('Embossed rear boarding pad',(0,.365,-1.72),(.76,.018,.28),rubber,.035)
 for i in range(13):tube('Boarding pad channels',[(-.32,.377,-1.84+i*.018),(.32,.377,-1.84+i*.018)],.002,rubber,1)
 tube('Rear cast grab handle',[(-.43,.39,-1.60),(-.44,.48,-1.53),(0,.51,-1.55),(.44,.48,-1.53),(.43,.39,-1.60)],.022,carbon)
 for side in [-1,1]:
  box('Grab handle mounting shoe',(side*.43,.398,-1.60),(.075,.055,.12),metal,.012)
  ring('Grab attachment bolt',(side*.43,.431,-1.60),.010,.010,dark,.003,'y')
  tube('Rear brake light',[(side*.12,.43,-1.63),(side*.32,.42,-1.67)],.010,light)
 # Steering assembly. Grip sockets stay precisely where they were in the baseline.
 tube('Forged steering riser',[(0,.65,.65),(0,.81,.57),(0,.978,.49)],.029,metal)
 tube('Swept race handlebar',[(-.48,.9995,.47436),(-.29,1.006,.487),(-.15,1.044,.54),(0,1.055,.55),(.15,1.044,.54),(.29,1.006,.487),(.48,.9995,.47436)],.014,metal)
 for side in [-1,1]:
  tube('Textured ergonomic handgrip',[(side*.337,.99953,.47436),(side*.49,.99953,.47436)],.021,rubber)
  for i in range(15):ring('Grip rib',(side*(.345+i*.0095),.99953,.47436),.021,.021,rubber,.0015,'x')
  box('Handle switch module',(side*.302,1.012,.495),(.05,.065,.065),carbon,.012)
  ellipsoid('Tactile switch',(side*.305,1.046,.48),(.012,.004,.015),light,20)
  tube('Finger throttle lever',[(side*.31,.979,.50),(side*.34,.956,.50),(side*.425,.953,.50)],.0055,metal)
  tube('Hydraulic control line',[(side*.30,.988,.522),(side*.18,.92,.56),(side*.10,.77,.66)],.004,dark)
  box('Handlebar clamp',(side*.075,1.035,.548),(.09,.07,.075),carbon,.012)
  for z in [.525,.572]:ring('Clamp cap screw',(side*.075,1.073,z),.006,.006,metal,.002,'y')
 # Original wide LCD with readable, UV-authored screen and beveled protective cover.
 box('Instrument console',(0,.793,.68),(.34,.11,.255),carbon,.035)
 screen=material('Original LCD display',(.02,.07,.09),.10,.23)
 N=1024;y,x=np.mgrid[:N,:N];rgba=np.ones((N,N,4),np.float32);rgba[:,:,:3]=(.006,.018,.027)
 r=np.hypot((x-390),(y-510));mask=(r>215)&(r<230)&(np.arctan2(y-510,x-390)>-.6);rgba[mask,:3]=(.025,.67,.83)
 for i in range(9):rgba[200:230,105+i*91:155+i*91,:3]=(.05,.25+i*.05,.48+i*.035)
 for i in range(5):rgba[460+i*60:480+i*60,700:910-i*14,:3]=(.1,.7,.77)
 # Seven-segment 180, orientation mapped to the operator.
 segments=[(0,1,2,3,4,5),(1,2),(0,1,6,4,3),(0,1,6,2,3),(5,6,1,2),(0,5,6,2,3),(0,5,6,4,2,3),(0,1,2),(0,1,2,3,4,5,6),(0,1,2,3,5,6)]
 for k,d in enumerate([1,8,0]):
  ox=155+k*153;oy=430
  rect=[(14,0,91,12),(91,10,103,98),(91,111,103,200),(14,200,91,212),(1,111,13,200),(1,10,13,98),(14,100,91,112)]
  for seg in segments[d]:a,b,c,d0=rect[seg];rgba[oy+b:oy+d0,ox+a:ox+c,:3]=(.67,.91,.94)
 im=bpy.data.images.new('Hero original LCD 1K',width=N,height=N);im.pixels.foreach_set(rgba.ravel());im.filepath_raw=str(T/'Original-LCD.png');im.file_format='PNG';im.save();im.pack();nt=screen.node_tree;n=nt.nodes.new('ShaderNodeTexImage');n.image=im;p=nt.nodes.get('Principled BSDF');nt.links.new(n.outputs['Color'],p.inputs['Base Color']);nt.links.new(n.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=.35
 mesh('LCD bonded panel',[(-.136,.852,.582),(.136,.852,.582),(.136,.852,.774),(-.136,.852,.774)],[(3,2,1,0)],screen,[(0,0),(1,0),(1,1),(0,1)])
 tube('Display sealing gasket',[(-.14,.854,.58),(.14,.854,.58),(.14,.854,.778),(-.14,.854,.778),(-.14,.854,.58)],.006,dark,3)
 for side in [-1,1]:
  for j in range(3):ellipsoid('Console sealed keypad',(side*.156,.852,.62+j*.055),(.008,.004,.013),rubber,20)
 # Bow hatch latch, cap and industrial graphics.
 for name,rx,rz,y,mat0,radius in [('Recessed fuel cap gasket',.047,.050,.694,dark,.004),('Machined filler cap',.036,.039,.698,metal,.005)]:
  tube(name,[(rx*math.cos(a),y-.31*rz*math.sin(a),1.02+rz*math.sin(a)) for a in np.linspace(0,2*PI,65)],radius,mat0,3)
 tube('Flush cap latch',[(-.017,.702,1.02),(.017,.702,1.02)],.004,carbon)
 text('Bow identity','V / 07',(0,.407,1.52),.062,white,rotation=(0,0,0))
 text('Saddle rear identity','VELOCITY',(0,.391,-1.75),.057,white,rotation=(0,0,0))
 # Nozzle, steering collar, inner stator and reverse bucket. Open at its center.
 for z,rx,ry in [(-1.92,.15,.135),(-2.00,.143,.125),(-2.09,.12,.105),(-2.16,.117,.10)]:ring('Jet nozzle machined ring',(0,.04,z),rx,ry,metal,.016)
 for i in range(8):
  a=i/8*2*PI;tube('Pump longitudinal casting rib',[(.16*math.cos(a),.04+.14*math.sin(a),-1.89),(.125*math.cos(a),.04+.109*math.sin(a),-2.12)],.007,carbon,2)
  tube('Jet stator vane',[(.025*math.cos(a),.04+.025*math.sin(a),-2.12),(.10*math.cos(a+.2),.04+.085*math.sin(a+.2),-2.09)],.006,metal,2)
 ellipsoid('Jet hub',(0,.04,-2.08),(.033,.033,.07),metal)
 tube('Reverse bucket hoop',[(-.15,.08,-2.14),(-.16,.16,-2.12),(0,.20,-2.13),(.16,.16,-2.12),(.15,.08,-2.14)],.018,carbon)
 for side in [-1,1]:
  tube('Reverse actuator link',[(side*.20,.14,-1.80),(side*.18,.18,-2.10)],.009,metal)
  ring('Rear drain plug',(side*.32,.13,-1.89),.021,.021,dark,.008)
 bpy.data.objects['JetOutlet'].location=B((0,.04,-2.19))
 for o in bpy.context.scene.objects:
  if o.type=='MESH':o['heroPart']=True
 bpy.context.scene['heroDetailVersion']=2
 bpy.ops.wm.save_as_mainfile(filepath=str(S/'hero-craft.blend'),compress=True)
 return export('watercraft.glb',merge_materials(list(bpy.context.scene.objects),'HeroPWC_'))

def rider():
 bpy.ops.wm.open_mainfile(filepath=str(S/'racer.blend'));body=bpy.data.objects['Tailored_neoprene_suit'];rig=bpy.data.objects['RaceRig']
 for o in list(bpy.context.scene.objects):
  if o not in [body,rig]:bpy.data.objects.remove(o,do_unlink=True)
 for m in list(body.modifiers):body.modifiers.remove(m)
 # Repose both anatomical mesh and rest skeleton: lowered, bent elbows instead of splayed mannequin arms.
 changes={}
 for side in [-1,1]:
  a=G(rig.data.bones['UpperArm_'+str(side)].head_local);h=G(rig.data.bones['Hand_'+str(side)].head_local);axis=(h-a).normalized();l1=rig.data.bones['UpperArm_'+str(side)].length;l2=rig.data.bones['Forearm_'+str(side)].length;d=(h-a).length;along=(d*d+l1*l1-l2*l2)/(2*d);bend=Vector((side*.45,-.85,-.10));bend=(bend-axis*bend.dot(axis)).normalized();e=a+axis*along+bend*math.sqrt(max(0,l1*l1-along*along))
  changes['UpperArm_'+str(side)]=(B(a),B(e));changes['Forearm_'+str(side)]=(B(e),B(h))
 old={n:(rig.data.bones[n].head_local.copy(),rig.data.bones[n].tail_local.copy()) for n in changes}
 for v in body.data.vertices:
  delta=Vector()
  for g in v.groups:
   n=body.vertex_groups[g.group].name
   if n in changes:
    a,b=old[n];c,d=changes[n];q=(b-a).rotation_difference(d-c);delta+=(c+q@(v.co-a)-v.co)*g.weight
  v.co+=delta
 select([rig]);bpy.ops.object.mode_set(mode='EDIT')
 for n,(a,b) in changes.items():rig.data.edit_bones[n].head=a;rig.data.edit_bones[n].tail=b
 bpy.ops.object.mode_set(mode='OBJECT')
 # Remove the old open fingers; purpose-authored gloves are closed around the real handlebar.
 bm=bmesh.new();bm.from_mesh(body.data);bm.verts.ensure_lookup_table();kill=[]
 for v in body.data.vertices:
  if sum(g.weight for g in v.groups if body.vertex_groups[g.group].name.startswith('Hand_'))>.48:kill.append(bm.verts[v.index])
 bmesh.ops.delete(bm,geom=kill,context='VERTS');bm.to_mesh(body.data);bm.free()
 navy=pbr('Hero stretch racing textile',(.105,.17,.245),'cloth',.77)
 blue=pbr('Hero blue leather panels',(.025,.21,.43),'leather',.52,0,.12)
 silver=pbr('Hero pearl helmet',(.62,.72,.80),'paint',.24,.22,.65)
 carbon=pbr('Hero woven protection',(.065,.083,.105),'carbon',.43,.18,.2)
 rubber=pbr('Hero glove and boot grip',(.045,.055,.07),'rubber',.79)
 metal=pbr('Hero satin hardware',(.38,.45,.51),'metal',.33,.82)
 pale=material('Hero reflective piping',(.64,.75,.82),.20,.42)
 black=material('Hero cavity and visor gasket',(.008,.013,.02),0,.7)
 body.data.materials.clear();body.data.materials.append(navy)
 for p in body.data.polygons:p.material_index=0
 # The base is a person, not a skintight mannequin: allowance and soft garment folds.
 for v in body.data.vertices:
  p=G(v.co);w={body.vertex_groups[g.group].name:g.weight for g in v.groups}
  torso=w.get('RiderTorso',0)+w.get('Pelvis',0)
  if torso>.6 and -.03<p.y<.50:
   center=.08+p.y*.48;radial=Vector((p.x,0,p.z-center));radial.normalize()
   p+=radial*(.012+.005*math.sin(p.y*110+p.x*31))*(torso-.6)/.4
   v.co=B(p)
 finish(body,sub=2)
 kd=KDTree(len(body.data.vertices))
 for v in body.data.vertices:kd.insert(v.co,v.index)
 kd.balance();bvh=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get());equipment=[]
 def attach(o,bone=None):
  o.data.transform(o.matrix_basis);o.matrix_basis=Matrix.Identity(4)
  if bone:
   vg=o.vertex_groups.new(name=bone);vg.add(list(range(len(o.data.vertices))),1,'REPLACE')
  else:
   for g in body.vertex_groups:o.vertex_groups.new(name=g.name)
   for v in o.data.vertices:
    _,index,_=kd.find(v.co)
    for g in body.data.vertices[index].groups:o.vertex_groups[g.group].add([v.index],g.weight,'REPLACE')
  m=o.modifiers.new('Hero anatomical skin','ARMATURE');m.object=rig;o.parent=rig;equipment.append(o);return o
 def surf(x,y,front=True):
  ray=B((0,0,-1 if front else 1));p,_,_,_=bvh.ray_cast(B((x,y,1.4 if front else -.6)),ray,3)
  return G(p).z if p else .12+(y-.10)*.45
 def sleeve(name,a,b,r1,r2,material,bone):
  axis=(b-a).normalized();cross=axis.cross(Vector((1,0,0))).normalized();other=axis.cross(cross).normalized();v=[];uv=[];f=[]
  for j in range(17):
   t=j/16;center=a.lerp(b,t);radius=(r1*(1-t)+r2*t)*(1+.014*math.sin(j*2.5));radius*=.88+.12*math.sin(t*PI)**.3
   for i in range(33):
    angle=i/32*2*PI;v.append(center+cross*math.cos(angle)*radius+other*math.sin(angle)*radius*.88);uv.append((i/32,t))
  for j in range(16):
   for i in range(32):k=j*33+i;f.append((k,k+1,k+34,k+33))
  return attach(finish(mesh(name,v,f,material,uv),sub=2,thick=.003),bone)
 def panel(name,outline,material,front=True):
  # Clip the anatomical quads against actual garment cutting lines. Unlike selecting
  # whole faces, this produces smooth panel borders instead of a stair-stepped mask.
  area=sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(outline,outline[1:]+outline[:1]));sign=1 if area>0 else -1
  verts=[];uv=[];faces=[]
  for p in body.data.polygons:
   center=sum((G(body.data.vertices[i].co) for i in p.vertices),Vector())/len(p.vertices)
   if center.y<min(q[1] for q in outline)-.02 or center.y>max(q[1] for q in outline)+.02:continue
   if (center.z-(.08+center.y*.48))*(1 if front else -1)<0:continue
   if sum(g.weight for g in body.data.vertices[p.vertices[0]].groups if body.vertex_groups[g.group].name in ['Pelvis','RiderTorso'])<.1:continue
   poly=[G(body.data.vertices[i].co+body.data.vertices[i].normal*.014) for i in p.vertices]
   for a,b in zip(outline,outline[1:]+outline[:1]):
    if not poly:break
    def distance(q):return sign*((b[0]-a[0])*(q.y-a[1])-(b[1]-a[1])*(q.x-a[0]))
    clipped=[];previous=poly[-1];dp=distance(previous)
    for current in poly:
     dc=distance(current)
     if (dp>=0)!=(dc>=0):clipped.append(previous.lerp(current,dp/(dp-dc)))
     if dc>=0:clipped.append(current)
     previous=current;dp=dc
    poly=clipped
   if len(poly)<3:continue
   start=len(verts);verts.extend(poly);uv.extend([(q.x*3,q.y*3) for q in poly]);faces.append(tuple(range(start,len(verts))))
  o=mesh(name,verts,faces,material,uv);bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bm.to_mesh(o.data);bm.free()
  return attach(finish(o,thick=.004))
 for side in [-1,1]:
  flip=lambda ps:[(side*x,y) for x,y in ps]
  panel('Tailored shoulder chest panel',flip([(.012,.42),(.115,.485),(.195,.445),(.182,.32),(.115,.145),(.012,.18)]),blue)
  panel('Lateral jacket gusset',flip([(.14,.32),(.185,.36),(.17,.17),(.12,.04),(.08,.10)]),carbon)
  panel('Shaped back racing yoke',flip([(.015,.445),(.145,.48),(.193,.42),(.155,.20),(.095,.09),(.015,.12)]),blue,False)
  # Visible tailored piping conforms to garment surface, not floating vertical lines.
  for front in [True,False]:
   pts=[(side*x,y,surf(side*x,y,front)+(.015 if front else -.015)) for x,y in [(.17,.425),(.15,.35),(.12,.23),(.09,.10)]]
   attach(tube('Stitched jacket panel seam',pts,.0025,pale,2))
  s=str(side);u=G(rig.data.bones['UpperArm_'+s].head_local);e=G(rig.data.bones['Forearm_'+s].head_local);h=G(rig.data.bones['Hand_'+s].head_local)
  sleeve('Cut and sewn upper sleeve',u.lerp(e,.12),u.lerp(e,.90),.072,.056,blue,'UpperArm_'+s)
  sleeve('Tapered forearm gauntlet',e.lerp(h,.13),e.lerp(h,.82),.060,.039,carbon,'Forearm_'+s)
  # Curved fitted arm protectors use the joint surface, with elbow flexion bellows.
  # Slim shoulder insert, blended into the sewn sleeve instead of a spherical robot cap.
  attach(ellipsoid('Anatomical shoulder cap',u+Vector((side*.016,-.018,-.005)),(.074,.036,.061),silver),'UpperArm_'+s)
  attach(ellipsoid('Elbow protective shell',e+Vector((side*.010,-.016,-.015)),(.064,.063,.065),carbon),'Forearm_'+s)
  for j in range(5):
   p=e.lerp(h,.15+j*.08);attach(tube('Forearm articulated seam',[p+Vector((-side*.035,.025,-.02)),p+Vector((side*.035,.026,-.02))],.0025,pale,2),'Forearm_'+s)
  knee=G(rig.data.bones['Shin_'+s].head_local)
  hip=G(rig.data.bones['Thigh_'+s].head_local);ankle=G(rig.data.bones['Foot_'+s].head_local)
  sleeve('Shaped leather thigh panel',hip.lerp(knee,.20),hip.lerp(knee,.82),.089,.070,blue,'Thigh_'+s)
  sleeve('Seamed shin racing panel',knee.lerp(ankle,.16),knee.lerp(ankle,.73),.065,.048,blue,'Shin_'+s)
  attach(ellipsoid('Contoured patella guard',knee+Vector((0,-.005,.04)),(.072,.065,.044),blue),'Shin_'+s)
  for j in range(3):attach(tube('Knee flexion pleat',[(side*.33,-.18-j*.025,.31),(side*.40,-.18-j*.025,.31)],.004,carbon,2),'Thigh_'+s)
  # Shaped lower boot: actual heel, instep and toe volume, not a sphere at the foot.
  x=side*.50
  boot=loft('Sculpted race boot '+s,[(-.16,x,-.49,.045,.035),(-.10,x,-.49,.068,.060),(-.02,x,-.49,.068,.060),(.07,x,-.507,.067,.042),(.17,x,-.512,.058,.032),(.20,x,-.515,.025,.024)],carbon,n=40,m=40,power=.58,sub=2);attach(boot,'Foot_'+s)
  sole=loft('Layered rubber outsole '+s,[(-.16,x,-.546,.044,.011),(-.09,x,-.548,.071,.011),(.04,x,-.548,.074,.011),(.17,x,-.548,.063,.011),(.21,x,-.547,.025,.009)],rubber,n=32,m=32,power=.55,sub=1);attach(sole,'Foot_'+s)
  attach(ellipsoid('Ankle flexion cuff',(x,-.416,-.09),(.064,.085,.065),navy),'Shin_'+s)
  for j in range(3):attach(tube('Boot closure strap',[(x-.06,-.46+j*.027,-.038),(x,-.451+j*.027,-.02),(x+.06,-.46+j*.027,-.038)],.008,blue,3),'Foot_'+s)
  for j in range(9):attach(tube('Outsole tread',[(x-.06,-.559,-.11+j*.03),(x+.06,-.559,-.11+j*.03)],.003,rubber,1),'Foot_'+s)
  # Palm is sculpted and every digit curls around the cylindrical bar. Fingers have their own bones.
  attach(ellipsoid('Shaped leather glove palm',h+Vector((0,.017,-.008)),(.058,.027,.05),blue),'Hand_'+s)
  attach(ellipsoid('Glove knuckle protector',h+Vector((0,.037,-.003)),(.052,.014,.035),carbon),'Hand_'+s)
  # New closed hand bones retain the runtime Hand socket and its inverse bind orientation.
  digits=[]
  for k in range(4):
   xx=h.x+(k-1.5)*.026;length=[.048,.057,.055,.044][k]
   points=[Vector((xx,h.y+.027,h.z+.008)),Vector((xx,h.y+.017,h.z+.038)),Vector((xx,h.y-.013,h.z+.029)),Vector((xx,h.y-.021,h.z+.002))]
   for j in range(3):digits.append((f'Finger{k}_{j}_{s}',points[j],points[j+1],('Hand_'+s if j==0 else f'Finger{k}_{j-1}_{s}')))
  th=[h+Vector((side*.055,.010,-.025)),h+Vector((side*.041,-.014,-.031)),h+Vector((side*.018,-.024,-.005))]
  for j in range(2):digits.append((f'Thumb{j}_{s}',th[j],th[j+1],('Hand_'+s if j==0 else f'Thumb{j-1}_{s}')))
  select([rig]);bpy.ops.object.mode_set(mode='EDIT')
  for n,a,b,pa in digits:eb=rig.data.edit_bones.new(n);eb.head=B(a);eb.tail=B(b);eb.parent=rig.data.edit_bones[pa]
  bpy.ops.object.mode_set(mode='OBJECT')
  for n,a,b,pa in digits:attach(tube('Anatomical articulated glove digit',[a,a.lerp(b,.5)+Vector((0,.001,0)),b],.0095,rubber,4),n)
  wrist=e.lerp(h,.86);attach(tube('Glove cuff gaiter',[wrist,h.lerp(e,.07)],.034,navy,4),'Forearm_'+s)
 # Back design, stitched abdominal closure and waist support; geometry follows the real torso.
 panel('Segmented dorsal protector',[(-.053,.40),(.053,.40),(.065,.23),(.035,.12),(-.035,.12),(-.065,.23)],carbon,False)
 # Printed race identifiers live on the garment, not as a floating HUD.
 attach(text('Back competition number','07',(0,.34,surf(0,.34,False)-.024),.10,pale,rotation=(PI/2,0,PI)),'RiderTorso')
 attach(text('Back race team','VELOCITY',(0,.433,surf(0,.433,False)-.025),.027,pale,rotation=(PI/2,0,PI)),'RiderTorso')
 for side in [-1,1]:
  pts=[(side*x,y,surf(side*x,y,False)-.018) for x,y in [(.15,.08),(.12,.065),(.065,.055),(.005,.05)]]
  attach(tube('Lumbar support belt',pts,.018,carbon,3),'Pelvis')
 for j in range(5):
  y=.17+j*.043;attach(tube('Back flex channel',[(-.046,y,surf(-.046,y,False)-.018),(0,y,surf(0,y,False)-.022),(.046,y,surf(.046,y,False)-.018)],.003,pale,2))
 for j in range(22):
  y=.14+j*.011;attach(box('Front zipper tooth',(0,y,surf(0,y)+.013),(.008,.006,.004),metal,.001))
 attach(tube('Zipper leather welt',[(0,y,surf(0,y)+.01) for y in [.12,.20,.30,.405]],.004,carbon,2))
 # Full-face helmet: ring-edited shell, real eye opening, separate visor, chin vent and rear spoiler.
 rings=[(.565,.082,.105,.285),(.60,.112,.127,.292),(.645,.130,.148,.300),(.685,.139,.150,.304),(.725,.143,.147,.300),(.775,.140,.140,.296),(.825,.121,.123,.290),(.870,.078,.079,.282),(.888,.008,.008,.278)]
 v=[];uv=[];f=[];N=96
 for j,(y,rx,rz,z) in enumerate(rings):
  for i in range(N+1):
   a=-PI+i/N*2*PI;front=max(0,math.cos(a));chin=(.055 if y<.685 else .008)*front**4
   v.append((math.sin(a)*rx,y,z+math.cos(a)*rz+chin));uv.append((i/N,j/(len(rings)-1)))
 for j in range(len(rings)-1):
  for i in range(N):
   a=-PI+(i+.5)/N*2*PI
   if j in [3,4] and abs(a)<1.13:continue
   k=j*(N+1)+i;f.append((k,k+1,k+N+2,k+N+1))
 attach(finish(mesh('Sculpted full face helmet shell',v,f,silver,uv),sub=2,thick=.004),'Neck')
 # Small anatomical face insert retained from the actual human base, behind the smoked lens.
 with bpy.data.libraries.load(str(S/'human-base-cc0.blend'),link=False) as (a,b):b.objects=['GEO-body_male_realistic']
 face=b.objects[0];bpy.context.collection.objects.link(face);face.name='Anatomical face behind visor'
 for m in list(face.modifiers):face.modifiers.remove(m)
 face.vertex_groups.clear();face.data.materials.clear();skin=material('Warm facial skin',(.36,.205,.135),0,.62);face.data.materials.append(skin)
 bm=bmesh.new();bm.from_mesh(face.data);bmesh.ops.delete(bm,geom=[q for q in bm.verts if q.co.z<1.45],context='VERTS');bm.to_mesh(face.data);bm.free()
 for q in face.data.vertices:
  x=q.co.x+2.2643022537;y=q.co.y;z=q.co.z;q.co=B((x*1.08,.57+(z-1.45)*1.08,.29-y*1.08))
 for p in face.data.polygons:p.material_index=0
 attach(finish(face,sub=2),'Neck')
 eye=material('Anatomical eye white',(.39,.41,.40),0,.3,.2);iris=material('Natural iris',(.055,.035,.018),0,.4);pupil=material('Eye pupil',(.002,.003,.004),0,.23)
 for side in [-1,1]:
  attach(ellipsoid('Eye under optical visor',(side*.031,.724,.425),(.014,.009,.013),eye),'Neck')
  attach(ellipsoid('Iris under optical visor',(side*.031,.724,.438),(.0055,.0055,.0015),iris,24),'Neck')
  attach(ellipsoid('Eye pupil under optical visor',(side*.031,.724,.4395),(.0027,.0027,.001),pupil,20),'Neck')
 visor=material('Optical smoke visor',(.09,.19,.25),.26,.115,.85);p=visor.node_tree.nodes.get('Principled BSDF');p.inputs['Alpha'].default_value=.82;visor.surface_render_method='DITHERED'
 verts=[];uv=[];faces=[]
 for j in range(13):
  t=j/12;y=.684+t*.099
  for i in range(49):
   a=-1.16+i/48*2.32;verts.append((math.sin(a)*.147,y,.301+math.cos(a)*(.158-.011*t)));uv.append((i/48,j/12))
 for j in range(12):
  for i in range(48):k=j*49+i;faces.append((k,k+1,k+50,k+49))
 attach(finish(mesh('Curved optical visor with true eye opening',verts,faces,visor,uv),thick=.0015),'Neck')
 for y,rz in [(.684,.158),(.783,.147)]:
  attach(tube('Visor continuous rubber seal',[(math.sin(a)*.148,y,.301+math.cos(a)*rz) for a in np.linspace(-1.16,1.16,49)],.0035,black,3),'Neck')
 for side in [-1,1]:
  attach(ring('Visor ratchet hinge',(side*.139,.72,.345),.021,.021,carbon,.006,'x'),'Neck')
  attach(ring('Visor hinge center',(side*.146,.72,.345),.008,.008,metal,.003,'x'),'Neck')
  # Crown band, recessed intake slots and flowing rear exhaust spoiler.
  attach(tube('Helmet blue crown stripe',[(side*.044,.85,.215),(side*.050,.878,.28),(side*.062,.857,.355),(side*.065,.817,.406)],.007,blue,3),'Neck')
  attach(tube('Helmet brow intake',[(side*.075,.805,.420),(side*.105,.79,.401)],.005,black,3),'Neck')
  attach(tube('Helmet rear spoiler',[(side*.10,.76,.18),(side*.11,.81,.165),(side*.072,.85,.19)],.012,carbon,3),'Neck')
  attach(tube('Cheek sculpted panel line',[(side*.11,.68,.40),(side*.10,.635,.45),(side*.045,.61,.46)],.003,blue,3),'Neck')
  attach(tube('Neck roll seal',[(side*.073,.575,.26),(side*.069,.579,.33)],.014,black,3),'Neck')
 # Chin intake is an actual open grille in front of the thicker chin protection.
 attach(box('Chin vent recess',(0,.634,.493),(.095,.025,.006),black,.009),'Neck')
 for i in range(6):attach(tube('Chin vent grille',[(i*.013-.033,.623,.498),(i*.013-.033,.645,.498)],.0018,metal,2),'Neck')
 attach(text('Helmet race identity','07',(0,.79,.153),.046,blue,rotation=(PI/2,0,PI)),'Neck')
 # All equipment shares the seated rig. Rigid pieces use one bone; garments inherit skin weights.
 mod=body.modifiers.new('Continuous anatomical hero skin','ARMATURE');mod.object=rig;body.parent=rig
 rig['heroDetailVersion']=2;rig['gloveDigitBones']=28
 for o in equipment:o['heroPart']=True
 bpy.ops.wm.save_as_mainfile(filepath=str(S/'hero-racer.blend'),compress=True)
 select([body]+equipment);bpy.ops.object.join();body=bpy.context.object;body.name='HeroRacer_tailored_equipment'
 return export('rider.glb',[rig,body])

if __name__=='__main__':
 rows=[craft(),rider()]
 manifest=json.loads((O/'manifest.json').read_text());manifest['heroMethod']='Blender quad lofts, layered industrial parts, tailored anatomical skin and 43-bone rider; no hero decimation'
 for row in rows:
  for i,old in enumerate(manifest['assets']):
   if old['file']==row['file']:manifest['assets'][i]=row
 manifest['heroSources']=['assets/racecraft/source/hero-craft.blend','assets/racecraft/source/hero-racer.blend']
 (O/'manifest.json').write_text(json.dumps(manifest,indent=2));print('HERO_ASSETS',json.dumps(rows))
